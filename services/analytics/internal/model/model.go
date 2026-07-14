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

// SeriesPoint is one sample returned by the metrics endpoint. For analog
// metrics V carries the bucket's last value (used for digital detection and
// legacy clients) while Min/Max/Avg carry the bucket statistics so wide-range
// views can draw a min–max envelope instead of losing the range.
type SeriesPoint struct {
	T   string   `json:"t"`
	V   float64  `json:"v"`
	Min *float64 `json:"min,omitempty"`
	Max *float64 `json:"max,omitempty"`
	Avg *float64 `json:"avg,omitempty"`
}

// SeriesResponse is the aggregated time-series for a single node/metric.
type SeriesResponse struct {
	NodeID   string        `json:"node_id"`
	Metric   string        `json:"metric"`
	Interval string        `json:"interval"`
	Points   []SeriesPoint `json:"points"`
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
	NodeID   string   `json:"node_id"`
	ModuleID string   `json:"module_id"`
	Metrics  []string `json:"metrics"`
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
