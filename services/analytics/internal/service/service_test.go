package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/almuzky/iot/services/analytics/internal/model"
)

// ─── Stub store (implements the Store interface seam) ───────────────────────

type stubStore struct {
	upsertErr   error
	upsertCount int

	series    map[string]map[string][]model.SeriesPoint
	seriesErr error

	summary    *model.SummaryResponse
	summaryErr error

	nodes    []model.NodeMetric
	nodesErr error

	export    []model.ExportRow
	exportErr error
}

func (s *stubStore) UpsertRollup(ctx context.Context, row model.BatchRow) error {
	s.upsertCount++
	if s.upsertErr != nil {
		return s.upsertErr
	}
	return nil
}

func (s *stubStore) QuerySeriesMulti(ctx context.Context, nodeIDs, metrics []string, from, to time.Time, interval string, discreteSet map[string]bool) (map[string]map[string][]model.SeriesPoint, error) {
	if s.seriesErr != nil {
		return nil, s.seriesErr
	}
	return s.series, nil
}

func (s *stubStore) QuerySummary(ctx context.Context, nodeID, metric string, from, to time.Time) (*model.SummaryResponse, error) {
	if s.summaryErr != nil {
		return nil, s.summaryErr
	}
	if s.summary == nil {
		return &model.SummaryResponse{NodeID: nodeID, Metric: metric}, nil
	}
	return s.summary, nil
}

func (s *stubStore) ListNodes(ctx context.Context) ([]model.NodeMetric, error) {
	if s.nodesErr != nil {
		return nil, s.nodesErr
	}
	return s.nodes, nil
}

func (s *stubStore) ExportSeries(ctx context.Context, nodeID, metric string, from, to time.Time, resolution string) ([]model.ExportRow, error) {
	if s.exportErr != nil {
		return nil, s.exportErr
	}
	return s.export, nil
}

// ─── IngestBatch ─────────────────────────────────────────────────────────────

func TestIngestBatchAllSucceed(t *testing.T) {
	st := &stubStore{}
	svc := New(st)
	rows := []model.BatchRow{
		{NodeID: "n1", Metric: "temp"},
		{NodeID: "n2", Metric: "ph"},
	}
	if err := svc.IngestBatch(context.Background(), rows); err != nil {
		t.Fatal(err)
	}
	if st.upsertCount != 2 {
		t.Fatalf("expected 2 upserts, got %d", st.upsertCount)
	}
}

func TestIngestBatchContinuesOnError(t *testing.T) {
	st := &stubStore{upsertErr: errors.New("db down")}
	svc := New(st)
	// One bad row must not drop the rest of the batch nor return an error.
	rows := []model.BatchRow{
		{NodeID: "n1", Metric: "temp"},
		{NodeID: "n2", Metric: "ph"},
	}
	if err := svc.IngestBatch(context.Background(), rows); err != nil {
		t.Fatalf("IngestBatch should not return error on partial failure, got %v", err)
	}
	if st.upsertCount != 2 {
		t.Fatalf("expected every row attempted (2), got %d", st.upsertCount)
	}
}

func TestIngestBatchEmpty(t *testing.T) {
	st := &stubStore{}
	svc := New(st)
	if err := svc.IngestBatch(context.Background(), nil); err != nil {
		t.Fatal(err)
	}
	if st.upsertCount != 0 {
		t.Fatalf("expected 0 upserts, got %d", st.upsertCount)
	}
}

// ─── QuerySeriesMulti ────────────────────────────────────────────────────────

func TestQuerySeriesMultiProxies(t *testing.T) {
	series := map[string]map[string][]model.SeriesPoint{
		"n1": {"temp": {{T: "2024-01-01T00:00:00Z", V: 1}}},
	}
	st := &stubStore{series: series}
	svc := New(st)
	got, err := svc.QuerySeriesMulti(context.Background(), []string{"n1"}, []string{"temp"}, time.Now().Add(-time.Hour), time.Now(), "1h", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(got["n1"]["temp"]) != 1 {
		t.Fatalf("expected proxied series, got %+v", got)
	}
}

func TestQuerySeriesMultiError(t *testing.T) {
	st := &stubStore{seriesErr: errors.New("query failed")}
	svc := New(st)
	if _, err := svc.QuerySeriesMulti(context.Background(), []string{"n1"}, []string{"temp"}, time.Now().Add(-time.Hour), time.Now(), "1h", nil); err == nil {
		t.Fatal("expected error")
	}
}

// ─── QuerySummary ────────────────────────────────────────────────────────────

func TestQuerySummaryProxies(t *testing.T) {
	want := &model.SummaryResponse{NodeID: "n1", Metric: "temp", Count: 5, Avg: 2.5}
	st := &stubStore{summary: want}
	svc := New(st)
	got, err := svc.QuerySummary(context.Background(), "n1", "temp", time.Now().Add(-time.Hour), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if got.Count != 5 || got.Avg != 2.5 {
		t.Fatalf("expected proxied summary, got %+v", got)
	}
}

func TestQuerySummaryError(t *testing.T) {
	st := &stubStore{summaryErr: errors.New("boom")}
	svc := New(st)
	if _, err := svc.QuerySummary(context.Background(), "n1", "temp", time.Now().Add(-time.Hour), time.Now()); err == nil {
		t.Fatal("expected error")
	}
}

// ─── ListNodes ───────────────────────────────────────────────────────────────

func TestListNodesProxies(t *testing.T) {
	nodes := []model.NodeMetric{{NodeID: "n1", Metrics: []string{"temp"}}}
	st := &stubStore{nodes: nodes}
	svc := New(st)
	got, err := svc.ListNodes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].NodeID != "n1" {
		t.Fatalf("expected proxied nodes, got %+v", got)
	}
}

func TestListNodesError(t *testing.T) {
	st := &stubStore{nodesErr: errors.New("down")}
	svc := New(st)
	if _, err := svc.ListNodes(context.Background()); err == nil {
		t.Fatal("expected error")
	}
}

// ─── ExportSeries ────────────────────────────────────────────────────────────

func TestExportSeriesProxies(t *testing.T) {
	rows := []model.ExportRow{{NodeID: "n1", Metric: "temp", Count: 3}}
	st := &stubStore{export: rows}
	svc := New(st)
	got, err := svc.ExportSeries(context.Background(), "n1", "temp", time.Now().Add(-time.Hour), time.Now(), "day")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Count != 3 {
		t.Fatalf("expected proxied export rows, got %+v", got)
	}
}

func TestExportSeriesError(t *testing.T) {
	st := &stubStore{exportErr: errors.New("fail")}
	svc := New(st)
	if _, err := svc.ExportSeries(context.Background(), "n1", "temp", time.Now().Add(-time.Hour), time.Now(), "day"); err == nil {
		t.Fatal("expected error")
	}
}
