package handler

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/almuzky/iot/services/analytics/internal/service"
	"github.com/almuzky/iot/services/analytics/internal/tsdb"
	"github.com/go-chi/chi/v5"
)

// Handler serves the Analytics REST API.
type Handler struct {
	svc *service.Service
}

// New builds the Analytics handler.
func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// Health is a liveness probe for Kong upstream healthchecks.
func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// writeJSON encodes a payload as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// badRequest is a convenience for 400 errors.
func badRequest(w http.ResponseWriter, msg string) {
	writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
}

// parseTime accepts RFC3339 or unix-seconds strings.
func parseTime(v string) (time.Time, bool) {
	if v == "" {
		return time.Time{}, false
	}
	if t, err := time.Parse(time.RFC3339, v); err == nil {
		return t, true
	}
	if sec, err := strconv.ParseInt(v, 10, 64); err == nil {
		return time.Unix(sec, 0).UTC(), true
	}
	return time.Time{}, false
}

// MetricsHandler returns aggregated time-series for one or more nodes/metrics.
//   Query: ?node_id&metric&interval=1h&from&to&discrete
//   node_id and metric accept comma-separated lists (batched) so the dashboard
//   can fetch an entire node's telemetry in a single request instead of one
//   HTTP call per metric — this keeps the endpoint below Kong's rate limit and
//   scales to many nodes × many sensors.
//   discrete=true (bool) applies to every requested metric; discrete may also
//   be a comma-separated list of metric names to mark only those as digital/state
//   (0/1) so they stay at raw 1-minute resolution instead of the hourly/daily
//   aggregates.
//   Response: { interval, series: { node_id: { metric: [{t,v}] } } }
func (h *Handler) MetricsHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	nodeParam := q.Get("node_id")
	metricParam := q.Get("metric")
	if nodeParam == "" || metricParam == "" {
		badRequest(w, "node_id and metric are required")
		return
	}
	nodeIDs := splitCSV(nodeParam)
	metrics := splitCSV(metricParam)
	if len(nodeIDs) == 0 || len(metrics) == 0 {
		badRequest(w, "node_id and metric are required")
		return
	}

	interval := q.Get("interval")
	if interval == "" {
		interval = "1h"
	}

	// discrete: bool => all metrics; comma list => only those metric names.
	discreteSet := map[string]bool{}
	if v := q.Get("discrete"); v != "" {
		if strings.Contains(v, ",") {
			for _, m := range splitCSV(v) {
				discreteSet[m] = true
			}
		} else if b, _ := strconv.ParseBool(v); b {
			for _, m := range metrics {
				discreteSet[m] = true
			}
		}
	}

	to := time.Now().UTC()
	from := to.Add(-tsdb.WindowForInterval(interval))
	if v := q.Get("to"); v != "" {
		if t, ok := parseTime(v); ok {
			to = t
		} else {
			badRequest(w, "invalid 'to' (use RFC3339 or unix seconds)")
			return
		}
	}
	if v := q.Get("from"); v != "" {
		if t, ok := parseTime(v); ok {
			from = t
		} else {
			badRequest(w, "invalid 'from' (use RFC3339 or unix seconds)")
			return
		}
	}

	series, err := h.svc.QuerySeriesMulti(r.Context(), nodeIDs, metrics, from, to, interval, discreteSet)
	if err != nil {
		log.Printf("[handler] query series failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"interval": interval, "series": series})
}

// splitCSV splits a comma-separated query value into trimmed, non-empty parts.
func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// SummaryHandler returns a statistical summary for a node/metric.
//   Query: ?node_id&metric&from&to
func (h *Handler) SummaryHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	nodeID := q.Get("node_id")
	metric := q.Get("metric")
	if nodeID == "" || metric == "" {
		badRequest(w, "node_id and metric are required")
		return
	}

	to := time.Now().UTC()
	from := to.Add(-24 * time.Hour)
	if v := q.Get("to"); v != "" {
		if t, ok := parseTime(v); ok {
			to = t
		} else {
			badRequest(w, "invalid 'to'")
			return
		}
	}
	if v := q.Get("from"); v != "" {
		if t, ok := parseTime(v); ok {
			from = t
		} else {
			badRequest(w, "invalid 'from'")
			return
		}
	}

	resp, err := h.svc.QuerySummary(r.Context(), nodeID, metric, from, to)
	if err != nil {
		log.Printf("[handler] query summary failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// NodesHandler lists nodes with telemetry and their available metrics.
func (h *Handler) NodesHandler(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.svc.ListNodes(r.Context())
	if err != nil {
		log.Printf("[handler] list nodes failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"nodes": nodes})
}

// Routes registers the Analytics HTTP routes.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/analytics/metrics", h.MetricsHandler)
	r.Get("/analytics/summary", h.SummaryHandler)
	r.Get("/analytics/nodes", h.NodesHandler)
	r.Get("/analytics/export", h.ExportHandler)
}

// ExportHandler streams a CSV export of aggregated telemetry for research use.
//   Query: ?node_id&metric&resolution=day&from&to
//   resolution: raw | hour | day  (default day — best for long-range research)
// The CSV carries bucket, node_id, metric, count, sum, min, max, avg, last so
// a researcher can recompute their own aggregates from the exported history.
func (h *Handler) ExportHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	nodeID := q.Get("node_id")
	metric := q.Get("metric")
	if nodeID == "" || metric == "" {
		badRequest(w, "node_id and metric are required")
		return
	}
	resolution := q.Get("resolution")
	if resolution == "" {
		resolution = "day"
	}

	to := time.Now().UTC()
	from := to.Add(-24 * time.Hour)
	if v := q.Get("to"); v != "" {
		if t, ok := parseTime(v); ok {
			to = t
		} else {
			badRequest(w, "invalid 'to' (use RFC3339 or unix seconds)")
			return
		}
	}
	if v := q.Get("from"); v != "" {
		if t, ok := parseTime(v); ok {
			from = t
		} else {
			badRequest(w, "invalid 'from' (use RFC3339 or unix seconds)")
			return
		}
	}

	rows, err := h.svc.ExportSeries(r.Context(), nodeID, metric, from, to, resolution)
	if err != nil {
		log.Printf("[handler] export failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "export failed"})
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename=telemetry_%s_%s_%s_%s.csv",
			nodeID, metric, from.Format("20060102"), to.Format("20060102")))
	w.WriteHeader(http.StatusOK)

	cw := csv.NewWriter(w)
	if err := cw.Write([]string{"bucket", "node_id", "metric", "count", "sum", "min", "max", "avg", "last"}); err != nil {
		log.Printf("[handler] csv header write failed: %v", err)
		return
	}
	for _, r := range rows {
		if err := cw.Write([]string{
			r.Bucket.UTC().Format(time.RFC3339),
			r.NodeID,
			r.Metric,
			strconv.Itoa(r.Count),
			strconv.FormatFloat(r.Sum, 'f', -1, 64),
			strconv.FormatFloat(r.Min, 'f', -1, 64),
			strconv.FormatFloat(r.Max, 'f', -1, 64),
			strconv.FormatFloat(r.Avg, 'f', -1, 64),
			strconv.FormatFloat(r.Last, 'f', -1, 64),
		}); err != nil {
			log.Printf("[handler] csv row write failed: %v", err)
			return
		}
	}
	cw.Flush()
	if err := cw.Error(); err != nil {
		log.Printf("[handler] csv flush failed: %v", err)
	}
}
