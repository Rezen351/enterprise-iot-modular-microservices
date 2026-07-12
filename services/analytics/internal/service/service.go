package service

import (
	"context"
	"log"
	"time"

	"github.com/almuzky/iot/services/analytics/internal/model"
	"github.com/almuzky/iot/services/analytics/internal/tsdb"
)

// Service implements the Analytics business logic: ingest batch aggregates
// from NATS and serve aggregated queries to the dashboard.
type Service struct {
	store *tsdb.Store
}

// New wires the Analytics Service with its TimescaleDB store.
func New(store *tsdb.Store) *Service {
	return &Service{store: store}
}

// IngestBatch upserts every aggregate row from a telemetry.batch message.
func (s *Service) IngestBatch(ctx context.Context, rows []model.BatchRow) error {
	for i := range rows {
		if err := s.store.UpsertRollup(ctx, rows[i]); err != nil {
			// Log and continue — one bad row must not drop the rest of the batch.
			log.Printf("[svc] ingest rollup failed node=%s metric=%s: %v", rows[i].NodeID, rows[i].Metric, err)
		}
	}
	return nil
}

// QuerySeries proxies to the store with resolved time bounds.
func (s *Service) QuerySeries(ctx context.Context, nodeID, metric string, from, to time.Time, interval string, discrete bool) (*model.SeriesResponse, error) {
	return s.store.QuerySeries(ctx, nodeID, metric, from, to, interval, discrete)
}

// QuerySummary proxies to the store with resolved time bounds.
func (s *Service) QuerySummary(ctx context.Context, nodeID, metric string, from, to time.Time) (*model.SummaryResponse, error) {
	return s.store.QuerySummary(ctx, nodeID, metric, from, to)
}

// ListNodes proxies to the store.
func (s *Service) ListNodes(ctx context.Context) ([]model.NodeMetric, error) {
	return s.store.ListNodes(ctx)
}
