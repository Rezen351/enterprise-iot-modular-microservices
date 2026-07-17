package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/almuzky/iot/services/alert/internal/cache"
	"github.com/almuzky/iot/services/alert/internal/config"
	"github.com/almuzky/iot/services/alert/internal/handler"
	"github.com/almuzky/iot/services/alert/internal/middleware"
	"github.com/almuzky/iot/services/alert/internal/outbox"
	"github.com/almuzky/iot/services/alert/internal/repository"
	"github.com/almuzky/iot/services/alert/internal/service"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	_ "github.com/go-sql-driver/mysql"
	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	// ─── MariaDB (thresholds + alert history) ───────────────────────────
	db, err := openDB(cfg.DBDSN)
	if err != nil {
		log.Fatalf("db error: %v", err)
	}
	defer db.Close()
	log.Println("mariadb connected")

	if err := runMigrations(cfg.DBDSN); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	gdb, err := gorm.Open(mysql.Open(cfg.DBDSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("gorm error: %v", err)
	}
	store := repository.New(gdb)

	// ─── Redis (threshold + active-alert cache) ─────────────────────────
	alertCache := cache.New(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	pctx, pcancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := alertCache.Ping(pctx); err != nil {
		log.Printf("WARN: redis ping failed: %v — threshold cache degraded", err)
	} else {
		log.Println("redis connected")
	}
	pcancel()
	defer alertCache.Close()

	// ─── NATS (consume telemetry.ingest) ────────────────────────────────
	var natsConn *nats.Conn
	// svc is created up-front so threshold CRUD stays cache-coherent even if
	// NATS is temporarily unavailable.
	svc := service.New(store, alertCache, natsConn)
	natsConn, err = nats.Connect(cfg.NATSUrl,
		nats.Name("alert-svc"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(3*time.Second),
		nats.DisconnectErrHandler(func(c *nats.Conn, e error) {
			log.Printf("WARN: NATS disconnected: %v", e)
		}),
		nats.ReconnectHandler(func(c *nats.Conn) {
			log.Printf("NATS reconnected -> %s", c.ConnectedUrl())
		}),
		nats.ClosedHandler(func(c *nats.Conn) {
			log.Printf("WARN: NATS connection closed")
		}),
	)
	if err != nil {
		log.Printf("WARN: NATS connect failed: %v — alert evaluation disabled until reconnect", err)
	} else {
		defer natsConn.Drain()
		log.Println("NATS connected")
		// Wire the connected NATS conn into the Service so it can publish
		// alert.triggered/alert.resolved and system.status events.
		svc.SetNATS(natsConn)
		if err := svc.RunSubscriber(natsConn); err != nil {
			log.Printf("WARN: alert subscriber not started: %v", err)
		}
	}

	h := handler.New(store, svc)

	// ─── Outbox relay (ADR-007) ───────────────────────────────────────
	// Drains the outbox table and publishes events to NATS JetStream with a
	// Nats-Msg-Id dedupe header. Started within its own context that is
	// cancelled on shutdown.
	relayCtx, relayCancel := context.WithCancel(context.Background())
	defer relayCancel()
	relay := outbox.New(store, nil)
	if natsConn != nil {
		relay.SetNATS(natsConn)
	}
	go relay.Start(relayCtx)

	// ─── Router ─────────────────────────────────────────────────────────
	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.PrometheusMiddleware)

	r.Handle("/metrics", promhttp.Handler())
	r.Get("/health", handler.Health)

	secret := cfg.JWTSecret
	authMw := middleware.JWTAuth(secret)
	writeMw := middleware.RequireRole(secret, "admin", "operator")

	// Exact (no trailing-slash) paths so Kong's forwarded `/alerts` request
	// matches, consistent with the other services' route registration.
	r.With(authMw).Get("/alerts", h.ListAlerts)
	r.With(authMw, writeMw).Put("/alerts/{id}/ack", h.AckAlert)

	r.With(authMw).Get("/thresholds", h.ListThresholds)
	r.With(authMw, writeMw).Post("/thresholds", h.CreateThreshold)
	r.With(authMw, writeMw).Put("/thresholds/{id}", h.UpdateThreshold)
	r.With(authMw, writeMw).Delete("/thresholds/{id}", h.DeleteThreshold)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("alert-svc listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	log.Println("shutting down alert-svc...")
	if natsConn != nil {
		_ = natsConn.Drain()
	}
	relayCancel()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("alert-svc stopped")
}

func openDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	for i := range 10 {
		if err = db.Ping(); err == nil {
			return db, nil
		}
		log.Printf("db ping attempt %d/10 failed: %v", i+1, err)
		time.Sleep(3 * time.Second)
	}
	return nil, fmt.Errorf("database unreachable after 10 attempts: %w", err)
}
