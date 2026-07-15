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

	"github.com/almuzky/iot/services/audit/internal/config"
	"github.com/almuzky/iot/services/audit/internal/handler"
	"github.com/almuzky/iot/services/audit/internal/middleware"
	"github.com/almuzky/iot/services/audit/internal/repository"
	"github.com/almuzky/iot/services/audit/internal/service"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	_ "github.com/go-sql-driver/mysql"
	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

const auditSubject = "audit.log"

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	// ─── MariaDB (append-only audit store) ────────────────────────────────
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
	svc := service.New(store)

	// ─── NATS (consume audit.log) ─────────────────────────────────────────
	var natsConn *nats.Conn
	natsConn, err = nats.Connect(cfg.NATSUrl,
		nats.Name("audit-svc"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(3*time.Second),
	)
	if err != nil {
		log.Printf("WARN: NATS connect failed: %v — audit ingestion disabled until reconnect", err)
	} else {
		defer natsConn.Drain()
		log.Println("NATS connected")
		go svc.RunSubscriber(natsConn, auditSubject)
	}

	// ─── Router ───────────────────────────────────────────────────────────
	h := handler.New(store)
	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.PrometheusMiddleware)

	r.Handle("/metrics", promhttp.Handler())
	r.Get("/health", handler.Health)

	secret := cfg.JWTSecret
	r.Route("/audit", func(r chi.Router) {
		r.Use(middleware.JWTAuth(secret))
		r.Use(middleware.RequireRole(secret, "admin"))
		r.Get("/logs", h.ListLogs)
	})

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
		log.Printf("audit-svc listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	log.Println("shutting down audit-svc...")
	if natsConn != nil {
		_ = natsConn.Drain()
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("audit-svc stopped")
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
