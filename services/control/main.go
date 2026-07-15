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

	"github.com/almuzky/iot/services/control/internal/config"
	"github.com/almuzky/iot/services/control/internal/handler"
	"github.com/almuzky/iot/services/control/internal/middleware"
	mqttcli "github.com/almuzky/iot/services/control/internal/mqtt"
	"github.com/almuzky/iot/services/control/internal/repository"
	"github.com/almuzky/iot/services/control/internal/scheduler"
	"github.com/almuzky/iot/services/control/internal/service"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	_ "github.com/go-sql-driver/mysql"
	"github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	// ─── MariaDB (commands, schedules, targets, modes) ──────────────────
	db, err := openDB(cfg.DBDSN)
	if err != nil {
		log.Fatalf("db error: %v", err)
	}
	defer db.Close()
	log.Println("mariadb connected")

	if err := runMigrations(cfg.DBDSN); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	// ─── NATS (audit + events) ──────────────────────────────────────────
	var natsConn *nats.Conn
	natsConn, err = nats.Connect(cfg.NATSUrl,
		nats.Name("control-svc"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(3*time.Second),
	)
	if err != nil {
		log.Printf("WARN: NATS connect failed: %v — audit events disabled", err)
	} else {
		defer natsConn.Drain()
		log.Println("NATS connected")
	}

	// ─── Wire dependencies ──────────────────────────────────────────────
	repo := repository.New(db)
	var natsPub service.NATSPublisher
	if natsConn != nil {
		natsPub = natsConn
	}
	// Default actuator source reads the Module Service tag-mapping (same schema
	// as Sensor/Analytics). Per-request sources (with the caller's token) are
	// built in the handler for authenticated reads.
	defaultActuators := service.NewModuleActuatorSource(cfg.ModuleURL, "")
	svc := service.New(repo, nil, natsPub, defaultActuators)

	// ─── MQTT (publish actuator, subscribe confirm/telemetry) ───────────
	mqttClient, err := mqttcli.New(mqttcli.Config{
		BrokerURL:   cfg.MQTTURL,
		Username:    cfg.MQTTUser,
		Password:    cfg.MQTTPass,
		ClientID:    cfg.MQTTClientID,
		TopicPrefix: cfg.MQTTTopicPrefix,
	}, svc.OnConfirm, svc.OnTelemetry)
	if err != nil {
		log.Printf("WARN: MQTT init failed: %v — control disabled", err)
	} else {
		svc.SetPublisher(mqttClient)
		defer mqttClient.Disconnect()
	}

	// ─── Scheduler engine (server-side automatic control) ───────────────
	bgCtx, bgCancel := context.WithCancel(context.Background())
	defer bgCancel()
	schedLoc, err := time.LoadLocation(cfg.Timezone)
	if err != nil {
		log.Printf("WARN: invalid TIMEZONE %q (%v) — falling back to UTC for schedule windows", cfg.Timezone, err)
		schedLoc = time.UTC
	}
	log.Printf("scheduler timezone: %s", schedLoc)
	engine := scheduler.New(svc, schedLoc)
	svc.SetScheduler(engine)
	go engine.Run(bgCtx)

	// ─── Command timeout sweep ──────────────────────────────────────────
	ackTimeout := time.Duration(cfg.AckTimeoutSeconds) * time.Second
	go func() {
		t := time.NewTicker(10 * time.Second)
		defer t.Stop()
		for {
			select {
			case <-bgCtx.Done():
				return
			case <-t.C:
				sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				svc.TimeoutStale(sctx, ackTimeout)
				cancel()
			}
		}
	}()

	h := handler.New(svc, cfg.ModuleURL)

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
	r.Route("/control", func(r chi.Router) {
		r.Use(middleware.JWTAuth(secret))

		// Read routes — any authenticated user.
		r.Get("/commands", h.ListCommands)
		r.Get("/targets", h.ListTargets)
		r.Get("/outputs", h.ListOutputs)
		r.Get("/schedules", h.ListSchedules)
		r.Get("/schedules/{id}", h.GetSchedule)
		r.Get("/modes/{node_id}", h.GetNodeMode)

		// Write routes — operator/admin only.
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireRole(secret, "admin", "operator"))

			r.Post("/command", h.PostCommand)
			r.Post("/schedules", h.CreateSchedule)
			r.Put("/schedules/{id}", h.UpdateSchedule)
			r.Post("/schedules/{id}/enable", h.EnableSchedule)
			r.Post("/schedules/{id}/disable", h.DisableSchedule)
			r.Delete("/schedules/{id}", h.DeleteSchedule)
			r.Put("/modes/{node_id}", h.SetNodeMode)
			r.Post("/modes/{node_id}/resume", h.ResumeNode)
			r.Put("/modes/{node_id}/{output}", h.SetMode)
		})
	})

	// ─── HTTP Server ────────────────────────────────────────────────────
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
		log.Printf("control-svc listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	log.Println("shutting down control-svc...")
	bgCancel()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("control-svc stopped")
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
