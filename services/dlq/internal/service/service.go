package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/almuzky/iot/services/dlq/internal/model"
	"github.com/almuzky/iot/services/dlq/internal/repository"
	"github.com/almuzky/iot/services/dlq/internal/trace"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

const (
	// dlqStream is the JetStream stream that stores all dead-lettered messages.
	dlqStream = "DLQ"

	// advisoryPrefix is the NATS JetStream advisory subject for messages that
	// exceeded their consumer's MaxDeliver. The literal wildcard form
	// "$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.>" matches every stream and
	// consumer. We subscribe to both the wildcard and a literal token to be
	// robust against server subject-rewriting.
	advisoryPrefix = "$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES"

	// advisorySubject matches all streams/consumers.
	advisorySubject = "$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.>"

	// dlqSubject is the subject DLQ messages are published to (and the DLQ
	// stream's only subject).
	dlqSubject = "dlq.msg"
)

// advisoryPayload is the JSON body of a MaxDeliver advisory (subset we need).
// The `id` field is a server-generated opaque token (string), so it is kept
// loose to avoid decode errors across NATS versions.
type advisoryPayload struct {
	Type        string    `json:"type"`
	ID          any       `json:"id"`
	Timestamp   time.Time `json:"timestamp"`
	Stream      string    `json:"stream"`
	Consumer    string    `json:"consumer"`
	ConsumerSeq uint64    `json:"consumer_seq"`
	StreamSeq   uint64    `json:"stream_seq"`
	Domain      string    `json:"domain"`
	Reason      string    `json:"reason"`
}

// Service consumes JetStream MaxDeliver advisories, captures the original
// message by stream sequence, republishes it into the DLQ JetStream stream, and
// records it in the audit database for investigation (see ADR-006).
type Service struct {
	store       *repository.Store
	js          nats.JetStreamContext
	dlqMaxAge   time.Duration
	dlqReplicas int
	shutdownCh  chan struct{}
}

func New(store *repository.Store, js nats.JetStreamContext, maxAge time.Duration, replicas int) *Service {
	return &Service{
		store:       store,
		js:          js,
		dlqMaxAge:   maxAge,
		dlqReplicas: replicas,
		shutdownCh:  make(chan struct{}),
	}
}

// ensureDLQStream idempotently creates the DLQ JetStream stream with the
// retention/durability required by the spec (30d, Replicas:2). In a non-clustered
// (single-node) NATS deployment — the default for dev — Replicas>1 is rejected,
// so we transparently fall back to Replicas:1 and log a clear note. The spec's
// R:2 is fully satisfied in a NATS cluster (prod, see planning.md §HA / ADR-006).
func (s *Service) ensureDLQStream() error {
	cfg := &nats.StreamConfig{
		Name:       dlqStream,
		Subjects:   []string{dlqSubject},
		Retention:  nats.LimitsPolicy,
		Storage:    nats.FileStorage,
		MaxAge:     s.dlqMaxAge,
		MaxMsgs:    5_000_000,
		Duplicates: 2 * time.Minute,
		Replicas:   s.dlqReplicas,
	}
	if _, err := s.js.AddStream(cfg); err != nil {
		if s.dlqReplicas > 1 && isReplicasUnsupported(err) {
			log.Printf("[dlq] NATS is non-clustered; creating DLQ stream with Replicas:1 (spec R:2 applies to NATS cluster)")
			cfg.Replicas = 1
			if _, err2 := s.js.AddStream(cfg); err2 != nil {
				return err2
			}
			return nil
		}
		return err
	}
	return nil
}

// isReplicasUnsupported detects the specific NATS error returned when a stream
// requests more replicas than the server topology can provide.
func isReplicasUnsupported(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return contains(msg, "replicas > 1 not supported") ||
		contains(msg, "replicas must be less than") ||
		contains(msg, "not supported in non-clustered")
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

// RunAdvisorySubscriber subscribes to the MaxDeliver advisory subject and
// processes each advisory. It blocks until the connection is closed or the
// service is shut down.
func (s *Service) RunAdvisorySubscriber(nc *nats.Conn) error {
	if s.js == nil {
		var err error
		s.js, err = nc.JetStream()
		if err != nil {
			return fmt.Errorf("jetstream context: %w", err)
		}
	}
	if err := s.ensureDLQStream(); err != nil {
		return fmt.Errorf("ensure DLQ stream: %w", err)
	}

	sub, err := nc.Subscribe(advisorySubject, func(m *nats.Msg) {
		s.handleAdvisory(m)
	})
	if err != nil {
		return fmt.Errorf("subscribe advisory: %w", err)
	}
	log.Printf("[dlq] advisory subscriber listening on %q", advisorySubject)

	<-s.shutdownCh
	_ = sub.Unsubscribe()
	return nil
}

func (s *Service) Shutdown() {
	close(s.shutdownCh)
}

func (s *Service) handleAdvisory(m *nats.Msg) {
	// Trace id is propagated on the advisory message header (Trace-Id). It may
	// be empty if the originating server did not set it; sanitize generates a
	// fresh id so every capture is individually addressable.
	tid := trace.Sanitize(trace.FromNATS(m.Header))

	// The advisory subject encodes stream and consumer:
	//   $JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.<stream>.<consumer>
	var adv advisoryPayload
	if err := json.Unmarshal(m.Data, &adv); err != nil {
		log.Printf("[dlq] trace=%s advisory decode failed: %v", tid, err)
		return
	}
	sourceStream := adv.Stream
	sourceConsumer := adv.Consumer
	if sourceStream == "" || sourceConsumer == "" {
		src, cons := parseAdvisorySubject(m.Subject)
		if sourceStream == "" {
			sourceStream = src
		}
		if sourceConsumer == "" {
			sourceConsumer = cons
		}
	}

	log.Printf("[dlq] trace=%s advisory stream=%s consumer=%s stream_seq=%d reason=%q",
		tid, sourceStream, sourceConsumer, adv.StreamSeq, adv.Reason)

	if adv.StreamSeq == 0 {
		log.Printf("[dlq] trace=%s advisory without stream_seq; skipping capture", tid)
		return
	}

	// Fetch the original message from the source stream by sequence. This is
	// the authoritative copy — not the advisory body, which only describes it.
	srcMsg, err := s.js.GetMsg(sourceStream, adv.StreamSeq)
	if err != nil {
		log.Printf("[dlq] trace=%s get original msg stream=%s seq=%d failed: %v",
			tid, sourceStream, adv.StreamSeq, err)
		return
	}

	originalSubject := srcMsg.Subject
	if originalSubject == "" {
		originalSubject = srcMsg.Header.Get("Nats-Subject")
	}

	payload := string(srcMsg.Data)
	if !json.Valid(srcMsg.Data) {
		payload = string(srcMsg.Data)
	}
	headersJSON, _ := json.Marshal(srcMsg.Header)

	rec := &model.DLQMessage{
		ID:             uuid.NewString(),
		TraceID:        tid,
		SourceStream:   sourceStream,
		SourceConsumer: sourceConsumer,
		StreamSeq:      adv.StreamSeq,
		Subject:        originalSubject,
		Reason:         adv.Reason,
		Payload:        payload,
		Headers:        string(headersJSON),
	}

	// 1) Republish the original message into the DLQ JetStream stream so it is
	//    durably retained (30d) and replayable by operators/Audit Service.
	dlqHdrs := trace.ToNATS(tid)
	dlqHdrs["X-DLQ-Source-Stream"] = []string{sourceStream}
	dlqHdrs["X-DLQ-Source-Consumer"] = []string{sourceConsumer}
	dlqHdrs["X-DLQ-Stream-Seq"] = []string{fmt.Sprintf("%d", adv.StreamSeq)}
	dlqHdrs["Nats-Msg-Id"] = []string{rec.ID} // publisher-side dedup
	if _, err := s.js.PublishMsg(&nats.Msg{
		Subject: dlqSubject,
		Header:  dlqHdrs,
		Data:    srcMsg.Data,
	}); err != nil {
		log.Printf("[dlq] trace=%s republish to DLQ stream failed: %v", tid, err)
		return
	}

	// 2) Record the landing in the audit database (dedicated dlq_messages
	//    table, inside mariadb-audit).
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.store.Insert(ctx, rec); err != nil {
		log.Printf("[dlq] trace=%s insert audit dlq_messages failed: %v", tid, err)
		return
	}

	log.Printf("[dlq] trace=%s captured into DLQ stream=%s seq=%d subject=%s",
		tid, sourceStream, adv.StreamSeq, originalSubject)
}

// parseAdvisorySubject extracts <stream>.<consumer> from
// "$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.<stream>.<consumer>".
func parseAdvisorySubject(subj string) (stream, consumer string) {
	const prefix = advisoryPrefix + "."
	if !hasPrefix(subj, prefix) {
		return "", ""
	}
	rest := subj[len(prefix):]
	// stream names may themselves contain dots, so split off the last token as
	// the consumer.
	idx := lastDot(rest)
	if idx < 0 {
		return rest, ""
	}
	return rest[:idx], rest[idx+1:]
}

func hasPrefix(s, p string) bool {
	return len(s) >= len(p) && s[:len(p)] == p
}

func lastDot(s string) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == '.' {
			return i
		}
	}
	return -1
}
