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
		s.handleMessage(m)
	})
	if err != nil {
		log.Printf("WARN: audit subscriber failed: %v", err)
		return err
	}
	log.Printf("audit subscriber listening on %q", subject)
	return nil
}

// handleMessage persists an audit event, applying consumer-side idempotency
// (ADR-007): if the event carries a msg_id (Nats-Msg-Id header or payload
// field) that has already been processed, it is skipped to avoid duplicates
// on redelivery.
func (s *Service) handleMessage(m *nats.Msg) {
	body := m.Data
	msgID := m.Header.Get("Nats-Msg-Id")

	var raw rawAudit
	if err := json.Unmarshal(body, &raw); err != nil {
		log.Printf("WARN: audit message not JSON, storing raw: %v", err)
		raw.Event = "unknown"
		raw.Data = json.RawMessage(body)
	}
	if raw.Event == "" {
		raw.Event = "unknown"
	}
	// Fall back to payload msg_id when the NATS header is absent (Core NATS).
	if msgID == "" {
		var withID struct {
			MsgID string `json:"msg_id"`
		}
		if json.Unmarshal(body, &withID) == nil {
			msgID = withID.MsgID
		}
	}
	payload := string(raw.Data)
	if !json.Valid(raw.Data) {
		payload = string(body)
	}

	if msgID != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		seen, serr := s.store.SeenMsgID(ctx, msgID, "audit.log")
		cancel()
		if serr != nil {
			log.Printf("WARN: dedup check failed for msg_id=%s: %v", msgID, serr)
		} else if seen {
			log.Printf("[dedup] skip already-processed audit msg_id=%s", msgID)
			return
		}
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
		return
	}
	if msgID != "" {
		if err := s.store.MarkMsgID(ctx, msgID, "audit.log"); err != nil {
			log.Printf("WARN: failed to mark msg_id=%s processed: %v", msgID, err)
		}
	}
}
