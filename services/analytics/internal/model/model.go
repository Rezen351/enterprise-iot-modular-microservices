package model

import "time"

// BatchRow is a single per-(node, metric) aggregate produced by the Module
// Service every batch window (1 minute) and published on telemetry.batch.
type BatchRow struct {
	NodeID   string  `json:"node_id"`
	ModuleID string  `json:"module_id"`
	Metric   string  `json:"metric"`
	Count    int     `json:"count"`
	Sum      float64 `json:"sum"`
	Min      float64 `json:"min"`
	Max      float64 `json:"max"`
	Avg      float64 `json:"avg"`
	Last     float64 `json:"last"`
	FirstTS  int64   `json:"first_ts"`
	LastTS   int64   `json:"last_ts"`
}

// BatchMessage is the envelope published on telemetry.batch.
type BatchMessage struct {
	Window   string     `json:"window"`
	RowCount int        `json:"row_count"`
	Rows     []BatchRow `json:"rows"`
	Ts       int64      `json:"ts"`
}

// SeriesPoint is one (time, value) sample returned by the metrics endpoint.
type SeriesPoint struct {
	T string  `json:"t"`
	V float64 `json:"v"`
}

// SeriesResponse is the aggregated time-series for a single node/metric.
type SeriesResponse struct {
	NodeID  string       `json:"node_id"`
	Metric  string       `json:"metric"`
	Interval string      `json:"interval"`
	Points  []SeriesPoint `json:"points"`
}

// SummaryResponse is the statistical summary for a node/metric over a window.
type SummaryResponse struct {
	NodeID  string  `json:"node_id"`
	Metric  string  `json:"metric"`
	Count   int     `json:"count"`
	Min     float64 `json:"min"`
	Max     float64 `json:"max"`
	Avg     float64 `json:"avg"`
	Last    float64 `json:"last"`
	FirstTS int64   `json:"first_ts"`
	LastTS  int64   `json:"last_ts"`
}

// NodeMetric describes a node that has telemetry and the metrics available.
type NodeMetric struct {
	NodeID  string   `json:"node_id"`
	ModuleID string  `json:"module_id"`
	Metrics []string `json:"metrics"`
}

// NodesResponse lists nodes with telemetry and their available metrics.
type NodesResponse struct {
	Nodes []NodeMetric `json:"nodes"`
}

// ExportRow is one aggregated sample returned by the CSV export endpoint.
// It carries the full statistical payload (not just `last`) so researchers
// can compute their own aggregates from the exported history.
type ExportRow struct {
	Bucket time.Time `json:"bucket"`
	NodeID string    `json:"node_id"`
	Metric string    `json:"metric"`
	Count  int       `json:"count"`
	Sum    float64   `json:"sum"`
	Min    float64   `json:"min"`
	Max    float64   `json:"max"`
	Avg    float64   `json:"avg"`
	Last   float64   `json:"last"`
}
