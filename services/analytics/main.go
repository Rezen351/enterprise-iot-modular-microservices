package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/almuzky/iot/services/analytics/internal/config"
	"github.com/almuzky/iot/services/analytics/internal/handler"
	"github.com/almuzky/iot/services/analytics/internal/middleware"
	natsub "github.com/almuzky/iot/services/analytics/internal/nats"
	"github.com/almuzky/iot/services/analytics/internal/service"
	"github.com/almuzky/iot/services/analytics/internal/tsdb"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	// ─── TimescaleDB (own rollup store) ───────────────────────────────
	var store *tsdb.Store
	for i := 0; i < 10; i++ {
		store, err = tsdb.New(cfg.TimescaleDSN)
		if err == nil {
			break
		}
		log.Printf("timescaledb connect attempt %d/10 failed: %v", i+1, err)
		time.Sleep(3 * time.Second)
	}
	if store == nil {
		log.Fatalf("timescaledb unreachable: %v", err)
	}
	defer store.Close()
	log.Println("timescaledb connected")

	// ─── NATS (telemetry.batch consumer) ──────────────────────────────
	var nc *nats.Conn
	for i := 0; i < 10; i++ {
		nc, err = nats.Connect(cfg.NATSUrl,
			nats.Name("analytics-svc"),
			nats.MaxReconnects(-1),
			nats.ReconnectWait(3*time.Second),
		)
		if err == nil {
			break
		}
		log.Printf("NATS connect attempt %d/10 failed: %v", i+1, err)
		time.Sleep(3 * time.Second)
	}
	if nc == nil {
		log.Fatalf("NATS unreachable: %v", err)
	}
	defer nc.Drain()
	log.Println("NATS connected")

	// ─── Wire dependencies ────────────────────────────────────────────
	svc := service.New(store)
	h := handler.New(svc)

	if err := natsub.SubscribeBatch(nc, svc); err != nil {
		log.Printf("WARN: telemetry.batch subscribe failed: %v — analytics will not ingest", err)
	}

	// ─── Router ───────────────────────────────────────────────────────
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.Recoverer)
	r.Use(middleware.PrometheusMiddleware)

	r.Handle("/metrics", promhttp.Handler())
	r.Get("/health", handler.Health)
	h.Routes(r)

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
		log.Printf("analytics-svc listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	log.Println("shutting down analytics-svc...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("analytics-svc stopped")
}
