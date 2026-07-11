package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/almuzky/iot/services/wsgateway/internal/config"
	"github.com/almuzky/iot/services/wsgateway/internal/handler"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	cfg := config.Load()

	// ─── NATS (event bus from module/other services) ───────────────────────
	var nc *nats.Conn
	var err error
	for i := 0; i < 10; i++ {
		nc, err = nats.Connect(cfg.NATSUrl,
			nats.Name("ws-gateway"),
			nats.MaxReconnects(-1),
			nats.ReconnectWait(3*time.Second),
		)
		if err == nil {
			break
		}
		log.Printf("[ws-gateway] NATS connect attempt %d/10 failed: %v", i+1, err)
		time.Sleep(3 * time.Second)
	}
	if nc == nil {
		log.Fatalf("[ws-gateway] NATS unreachable: %v", err)
	}
	defer nc.Drain()
	log.Println("[ws-gateway] NATS connected")

	h := handler.New(nc, cfg.JWTSecret)

	// ─── Router ───────────────────────────────────────────────────────────
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.Recoverer)
	r.Handle("/metrics", promhttp.Handler())
	r.Get("/health", handler.Health)

	// Real-time node MQTT payloads (published by Module Service to mqtt.{node_id}).
	// Secured by JWT: dashboard must send a valid access token via the
	// Authorization header or ?token= query param on the WS handshake.
	r.Get("/ws/nodes/{node_id}/live", h.NodeLive)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("[ws-gateway] listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[ws-gateway] server error: %v", err)
		}
	}()

	<-quit
	log.Println("[ws-gateway] shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[ws-gateway] shutdown error: %v", err)
	}
	log.Println("[ws-gateway] stopped")
}
