package nats

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/almuzky/iot/services/analytics/internal/model"
	"github.com/almuzky/iot/services/analytics/internal/service"
	"github.com/nats-io/nats.go"
)

// streamName / durable consumer used for the telemetry.batch aggregate. The
// producer (Module Service) publishes to a JetStream stream so this consumer
// can replay any windows missed while Analytics was offline/restarting.
const (
	batchStream     = "TELEMETRY_BATCH"
	batchSubject    = "telemetry.batch"
	batchDurable    = "analytics-batch"
	batchQueueGroup = "analytics"
)

// ensureBatchStream idempotently creates the JetStream stream for telemetry.batch
// so the consumer works regardless of which service started first.
func ensureBatchStream(js nats.JetStreamContext) error {
	_, err := js.AddStream(&nats.StreamConfig{
		Name:     batchStream,
		Subjects: []string{batchSubject},
		Retention: nats.LimitsPolicy,
		Storage:  nats.FileStorage,
		MaxAge:   24 * time.Hour,
		MaxMsgs:  1_000_000,
		Replicas: 1,
	})
	return err
}

// SubscribeBatch wires a durable JetStream consumer to telemetry.batch. A missed
// window (Analytics down at the 1-minute tick) is replayed on reconnect instead
// of being lost. The handler acks only after the upsert succeeds, so a failed
// ingest is redelivered.
func SubscribeBatch(nc *nats.Conn, svc *service.Service) error {
	js, err := nc.JetStream()
	if err != nil {
		return err
	}
	if err := ensureBatchStream(js); err != nil {
		log.Printf("[nats] ensure telemetry.batch stream failed: %v", err)
		return err
	}

	sub, err := js.QueueSubscribe(batchSubject, batchQueueGroup,
		func(m *nats.Msg) {
			if m.Data == nil {
				_ = m.Ack()
				return
			}
			var bm model.BatchMessage
			if err := json.Unmarshal(m.Data, &bm); err != nil {
				log.Printf("[nats] telemetry.batch decode failed: %v", err)
				_ = m.Ack() // poison pill: do not redeliver unparseable payloads
				return
			}
			if len(bm.Rows) == 0 {
				_ = m.Ack()
				return
			}
			if err := svc.IngestBatch(context.Background(), bm.Rows); err != nil {
				log.Printf("[nats] ingest batch failed: %v", err)
				return // no ack -> JetStream redelivers
			}
			_ = m.Ack()
		},
		nats.Durable(batchDurable),
		nats.DeliverAll(),
		nats.ManualAck(),
		nats.AckExplicit(),
	)
	if err != nil {
		return err
	}
	_ = sub
	log.Println("[nats] subscribed to telemetry.batch (JetStream durable consumer)")
	return nil
}
