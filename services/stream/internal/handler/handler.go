package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/almuzky/iot/services/stream/internal/model"
	"github.com/almuzky/iot/services/stream/internal/service"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	svc *service.StreamService
}

func New(svc *service.StreamService) *Handler {
	return &Handler{svc: svc}
}

// Health is a public liveness probe (no JWT required at the service; Kong
// also exposes it, but the container healthcheck hits it directly).
func Health(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ListStreams returns all registered streams with live status + playback URLs.
func (h *Handler) ListStreams(w http.ResponseWriter, r *http.Request) {
	streams, err := h.svc.ListStreams(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list streams")
		return
	}
	respond(w, http.StatusOK, map[string]any{"streams": streams, "count": len(streams)})
}

// CreateStream registers a new CCTV stream (DB + MediaMTX path).
func (h *Handler) CreateStream(w http.ResponseWriter, r *http.Request) {
	var req model.CreateStreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "name is required")
		return
	}
	view, err := h.svc.CreateStream(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrDuplicateName):
			respondError(w, http.StatusConflict, "stream name already exists")
		case errors.Is(err, service.ErrMediaMTX):
			respondError(w, http.StatusBadGateway, "failed to register path with MediaMTX")
		default:
			respondError(w, http.StatusInternalServerError, "failed to create stream")
		}
		return
	}
	respond(w, http.StatusCreated, view)
}

// GetStream returns metadata + status + playback URLs for a single stream.
func (h *Handler) GetStream(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	view, err := h.svc.GetStream(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respondError(w, http.StatusNotFound, "stream not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get stream")
		return
	}
	respond(w, http.StatusOK, view)
}

// UpdateStream patches label/location/enabled.
func (h *Handler) UpdateStream(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateStreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	view, err := h.svc.UpdateStream(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respondError(w, http.StatusNotFound, "stream not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update stream")
		return
	}
	respond(w, http.StatusOK, view)
}

// DeleteStream unregisters a stream (MediaMTX path + DB row).
func (h *Handler) DeleteStream(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.svc.DeleteStream(r.Context(), id); err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respondError(w, http.StatusNotFound, "stream not found")
			return
		}
		if errors.Is(err, service.ErrMediaMTX) {
			respondError(w, http.StatusBadGateway, "failed to remove path from MediaMTX")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to delete stream")
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "stream deleted"})
}

// CaptureSnapshot grabs the current frame and stores it in MinIO. When the
// `detect` query param is "true" the frame is also sent to the AI vision model
// and the detection result is stored as a "detection" snapshot.
func (h *Handler) CaptureSnapshot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	detect := r.URL.Query().Get("detect") == "true" || r.URL.Query().Get("detect") == "1"
	view, err := h.svc.CaptureSnapshot(r.Context(), id, detect)
	if err != nil {
		respondError(w, http.StatusBadGateway, err.Error())
		return
	}
	respond(w, http.StatusCreated, view)
}

// ListSnapshots returns all snapshots/recordings (newest first).
func (h *Handler) ListSnapshots(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	snaps, err := h.svc.ListSnapshots(r.Context(), kind)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list snapshots")
		return
	}
	respond(w, http.StatusOK, map[string]any{"snapshots": snaps, "count": len(snaps)})
}

// GetSnapshot returns a single snapshot.
func (h *Handler) GetSnapshot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	view, err := h.svc.GetSnapshot(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respondError(w, http.StatusNotFound, "snapshot not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get snapshot")
		return
	}
	respond(w, http.StatusOK, view)
}

// DeleteSnapshot removes the snapshot and its MinIO object.
func (h *Handler) DeleteSnapshot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.svc.DeleteSnapshot(r.Context(), id); err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respondError(w, http.StatusNotFound, "snapshot not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to delete snapshot")
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "snapshot deleted"})
}

// StartRecording begins MediaMTX recording for the path.
func (h *Handler) StartRecording(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.svc.StartRecording(r.Context(), id); err != nil {
		respondError(w, http.StatusBadGateway, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "recording started"})
}

// StopRecording ends MediaMTX recording and stores a cover snapshot.
func (h *Handler) StopRecording(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	view, err := h.svc.StopRecording(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusBadGateway, err.Error())
		return
	}
	respond(w, http.StatusCreated, view)
}

func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respond(w, status, map[string]string{"error": msg})
}
