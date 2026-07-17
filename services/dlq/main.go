package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/almuzky/iot/services/dlq/internal/config"
	"github.com/almuzky/iot/services/dlq/internal/handler"
	"github.com/almuzky/iot/services/dlq/internal/repository"
	"github.com/almuzky/iot/services/dlq/internal/service"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
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

	dsn := cfg.DBDSN
	if err := runMigrations(dsn); err != nil {
		log.Fatalf("migration error: %v", err)
	}
	gdb, err := openGORM(dsn)
	if err != nil {
		log.Fatalf("gorm error: %v", err)
	}
	store := repository.New(gdb)
	svc := service.New(store, nil, time.Duration(cfg.DLQMaxAgeHours)*time.Hour, cfg.DLQReplicas)

	// ─── NATS (subscribe to MaxDeliver advisories) ─────────────────────────
	nc, err := nats.Connect(cfg.NATSUrl,
		nats.Name("dlq-saga-worker"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(3*time.Second),
	)
	if err != nil {
		log.Fatalf("NATS connect failed: %v", err)
	}
	defer nc.Drain()
	log.Println("NATS connected")

	js, err := nc.JetStream()
	if err != nil {
		log.Fatalf("jetstream context: %v", err)
	}
	svc = service.New(store, js, time.Duration(cfg.DLQMaxAgeHours)*time.Hour, cfg.DLQReplicas)

	// ─── Router ───────────────────────────────────────────────────────────
	h := handler.New(store)
	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Handle("/metrics", promhttp.Handler())
	h.Routes(r, cfg.JWTSecret)

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
		log.Printf("dlq-saga-worker listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Advisory subscriber runs in its own goroutine; blocks until shutdown.
	go func() {
		if err := svc.RunAdvisorySubscriber(nc); err != nil {
			log.Printf("WARN: advisory subscriber stopped: %v", err)
		}
	}()

	<-quit
	log.Println("shutting down dlq-saga-worker...")
	svc.Shutdown()
	_ = nc.Drain()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("dlq-saga-worker stopped")
}

func openGORM(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	return db, nil
}
