package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
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

// MetricsHandler returns an aggregated time-series for a node/metric.
//   Query: ?node_id&metric&interval=1h&from&to
func (h *Handler) MetricsHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	nodeID := q.Get("node_id")
	metric := q.Get("metric")
	if nodeID == "" || metric == "" {
		badRequest(w, "node_id and metric are required")
		return
	}
	interval := q.Get("interval")
	if interval == "" {
		interval = "1h"
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

	resp, err := h.svc.QuerySeries(r.Context(), nodeID, metric, from, to, interval)
	if err != nil {
		log.Printf("[handler] query series failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	writeJSON(w, http.StatusOK, resp)
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
}
