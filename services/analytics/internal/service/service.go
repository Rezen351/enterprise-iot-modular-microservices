package service

import (
	"context"
	"log"
	"time"

	"github.com/almuzky/iot/services/analytics/internal/model"
)

// Store is the data-access seam for the Analytics service. It is satisfied by
// *tsdb.Store (live TimescaleDB) and by in-memory fakes in unit tests, so the
// service layer can be exercised offline.
type Store interface {
	UpsertRollup(ctx context.Context, row model.BatchRow) error
	QuerySeriesMulti(ctx context.Context, nodeIDs, metrics []string, from, to time.Time, interval string, discreteSet map[string]bool) (map[string]map[string][]model.SeriesPoint, error)
	QuerySummary(ctx context.Context, nodeID, metric string, from, to time.Time) (*model.SummaryResponse, error)
	ListNodes(ctx context.Context) ([]model.NodeMetric, error)
	ExportSeries(ctx context.Context, nodeID, metric string, from, to time.Time, resolution string) ([]model.ExportRow, error)
}

// Service implements the Analytics business logic: ingest batch aggregates
// from NATS and serve aggregated queries to the dashboard.
type Service struct {
	store Store
}

// New wires the Analytics Service with its TimescaleDB store.
func New(store Store) *Service {
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

// QuerySeriesMulti proxies a batched (multi-node, multi-metric) query to the
// store. discreteSet marks which metric names must stay at raw 1-minute
// resolution (digital/state 0/1 metrics).
func (s *Service) QuerySeriesMulti(ctx context.Context, nodeIDs, metrics []string, from, to time.Time, interval string, discreteSet map[string]bool) (map[string]map[string][]model.SeriesPoint, error) {
	return s.store.QuerySeriesMulti(ctx, nodeIDs, metrics, from, to, interval, discreteSet)
}

// QuerySummary proxies to the store with resolved time bounds.
func (s *Service) QuerySummary(ctx context.Context, nodeID, metric string, from, to time.Time) (*model.SummaryResponse, error) {
	return s.store.QuerySummary(ctx, nodeID, metric, from, to)
}

// ListNodes proxies to the store.
func (s *Service) ListNodes(ctx context.Context) ([]model.NodeMetric, error) {
	return s.store.ListNodes(ctx)
}

// ExportSeries proxies to the store for bulk CSV research export.
func (s *Service) ExportSeries(ctx context.Context, nodeID, metric string, from, to time.Time, resolution string) ([]model.ExportRow, error) {
	return s.store.ExportSeries(ctx, nodeID, metric, from, to, resolution)
}
