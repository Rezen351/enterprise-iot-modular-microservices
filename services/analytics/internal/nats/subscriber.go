package nats

import (
	"context"
	"encoding/json"
	"log"

	"github.com/almuzky/iot/services/analytics/internal/model"
	"github.com/almuzky/iot/services/analytics/internal/service"
	"github.com/nats-io/nats.go"
)

// SubscribeBatch wires a core NATS subscription to telemetry.batch. The Module
// Service publishes each 1-minute aggregate to this subject; Analytics upserts
// the rows into its own TimescaleDB. A plain subscription (matching the
// ws-gateway pattern) is used because telemetry.batch is emitted on core NATS.
func SubscribeBatch(nc *nats.Conn, svc *service.Service) error {
	_, err := nc.Subscribe("telemetry.batch", func(m *nats.Msg) {
		if m.Data == nil {
			return
		}
		var bm model.BatchMessage
		if err := json.Unmarshal(m.Data, &bm); err != nil {
			log.Printf("[nats] telemetry.batch decode failed: %v", err)
			return
		}
		if len(bm.Rows) == 0 {
			return
		}
		if err := svc.IngestBatch(context.Background(), bm.Rows); err != nil {
			log.Printf("[nats] ingest batch failed: %v", err)
		}
	})
	if err != nil {
		return err
	}
	log.Println("[nats] subscribed to telemetry.batch")
	return nil
}
