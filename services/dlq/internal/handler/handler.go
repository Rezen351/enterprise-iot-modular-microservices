package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/almuzky/iot/services/dlq/internal/repository"
	"github.com/almuzky/iot/services/dlq/internal/trace"
	"github.com/go-chi/chi/v5"
)

// Health reports the service status. Public (no auth) so Docker/Kong can probe.
func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data":    map[string]any{"status": "healthy", "uptime_s": 0},
	})
}

// Handler bundles the HTTP endpoints for the DLQ worker.
type Handler struct {
	store *repository.Store
}

func New(store *repository.Store) *Handler {
	return &Handler{store: store}
}

// Routes registers the worker's HTTP API. The DLQ list endpoint is admin-only
// (defense in depth) — mirroring the audit service policy.
func (h *Handler) Routes(r chi.Router, jwtSecret string) {
	r.Get("/health", Health)
	r.Route("/dlq", func(r chi.Router) {
		r.Use(JWTAuth(jwtSecret))
		r.Use(RequireRole(jwtSecret, "admin"))
		r.Get("/messages", h.ListMessages)
	})
}

// ListMessages returns captured DLQ messages, newest first. Supports filtering
// by ?source_stream= and ?trace_id=, plus limit/offset pagination.
func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	tid := trace.Sanitize(trace.FromHTTP(r))
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	source := r.URL.Query().Get("source_stream")
	trc := r.URL.Query().Get("trace_id")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	rows, total, err := h.store.List(ctx, source, trc, limit, offset)
	if err != nil {
		log.Printf("[dlq] trace=%s list dlq failed: %v", tid, err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list dlq messages")
		return
	}
	writeOK(w, map[string]any{
		"messages": rows,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

// writeOK emits the standardized success envelope {success:true,data:...}.
func writeOK(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "data": data})
}

// writeError emits the standardized error envelope
// {success:false,error:{code,message}} (AGENTS.md §4.4).
func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": false,
		"error":   map[string]string{"code": code, "message": message},
	})
}
