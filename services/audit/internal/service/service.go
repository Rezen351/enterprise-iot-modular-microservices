package service

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/almuzky/iot/services/audit/internal/model"
	"github.com/almuzky/iot/services/audit/internal/repository"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

// Service consumes audit.log events from NATS and persists them.
type Service struct {
	store *repository.Store
}

func New(store *repository.Store) *Service {
	return &Service{store: store}
}

// rawAudit is the wire format published by Auth/Module/Control services:
// {"event":"...","data":{...}}.
type rawAudit struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

// RunSubscriber subscribes to the audit.log subject on Core NATS and persists
// every event. A queue group lets multiple Audit Service replicas share load.
// The subscription runs on NATS-managed goroutines, so the caller's main loop
// (HTTP server) keeps the process alive.
func (s *Service) RunSubscriber(nc *nats.Conn, subject string) error {
	_, err := nc.QueueSubscribe(subject, "audit-workers", func(m *nats.Msg) {
		s.handleMessage(m.Data)
	})
	if err != nil {
		log.Printf("WARN: audit subscriber failed: %v", err)
		return err
	}
	log.Printf("audit subscriber listening on %q", subject)
	return nil
}

func (s *Service) handleMessage(body []byte) {
	var raw rawAudit
	if err := json.Unmarshal(body, &raw); err != nil {
		log.Printf("WARN: audit message not JSON, storing raw: %v", err)
		raw.Event = "unknown"
		raw.Data = json.RawMessage(body)
	}
	if raw.Event == "" {
		raw.Event = "unknown"
	}
	payload := string(raw.Data)
	if !json.Valid(raw.Data) {
		payload = string(body)
	}

	rec := &model.AuditLog{
		ID:      uuid.NewString(),
		Event:   raw.Event,
		Payload: payload,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.store.Insert(ctx, rec); err != nil {
		log.Printf("ERROR: failed to persist audit event %q: %v", raw.Event, err)
	}
}
