package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/almuzky/iot/services/module/internal/model"
	"github.com/almuzky/iot/services/module/internal/service"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	svc *service.ModuleService
}

func New(svc *service.ModuleService) *Handler {
	return &Handler{svc: svc}
}

// ─── Health ──────────────────────────────────────────────────────────────────

func Health(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ─── Modules ─────────────────────────────────────────────────────────────────

func (h *Handler) CreateModule(w http.ResponseWriter, r *http.Request) {
	var req model.CreateModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	m, err := h.svc.CreateModule(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrNameRequired) {
			respondError(w, http.StatusBadRequest, "name is required")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create module")
		return
	}
	respond(w, http.StatusCreated, m)
}

func (h *Handler) ListModules(w http.ResponseWriter, r *http.Request) {
	mods, err := h.svc.ListModules(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list modules")
		return
	}
	respond(w, http.StatusOK, map[string]any{"modules": mods, "count": len(mods)})
}

func (h *Handler) GetModule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	m, err := h.svc.GetModule(r.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrModuleNotFound) {
			respondError(w, http.StatusNotFound, "module not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get module")
		return
	}
	respond(w, http.StatusOK, m)
}

func (h *Handler) UpdateModule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	m, err := h.svc.UpdateModule(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, service.ErrModuleNotFound) {
			respondError(w, http.StatusNotFound, "module not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update module")
		return
	}
	respond(w, http.StatusOK, m)
}

func (h *Handler) DeleteModule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.svc.DeleteModule(r.Context(), id); err != nil {
		if errors.Is(err, service.ErrModuleNotFound) {
			respondError(w, http.StatusNotFound, "module not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to delete module")
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "module deleted; its nodes were unpaired"})
}

// ─── Nodes ───────────────────────────────────────────────────────────────────

func (h *Handler) ListNodes(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var paired *bool
	if v := q.Get("paired"); v != "" {
		b := v == "true" || v == "1"
		paired = &b
	}
	nodes, err := h.svc.ListNodes(r.Context(), paired, q.Get("module_id"), q.Get("status"))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list nodes")
		return
	}
	respond(w, http.StatusOK, map[string]any{"nodes": nodes, "count": len(nodes)})
}

// ListDiscovered returns unpaired devices — the onboarding candidates.
func (h *Handler) ListDiscovered(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.svc.ListDiscovered(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list discovered nodes")
		return
	}
	respond(w, http.StatusOK, map[string]any{"nodes": nodes, "count": len(nodes)})
}

func (h *Handler) GetNode(w http.ResponseWriter, r *http.Request) {
	nodeID := chi.URLParam(r, "node_id")
	n, err := h.svc.GetNode(r.Context(), nodeID)
	if err != nil {
		if errors.Is(err, service.ErrNodeNotFound) {
			respondError(w, http.StatusNotFound, "node not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get node")
		return
	}
	respond(w, http.StatusOK, n)
}

func (h *Handler) PairNode(w http.ResponseWriter, r *http.Request) {
	nodeID := chi.URLParam(r, "node_id")
	var req model.PairRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	n, err := h.svc.Pair(r.Context(), nodeID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNodeNotFound):
			respondError(w, http.StatusNotFound, "node not found")
		case errors.Is(err, service.ErrModuleNotFound):
			respondError(w, http.StatusBadRequest, "module_id is required and must reference an existing module")
		default:
			respondError(w, http.StatusInternalServerError, "failed to pair node")
		}
		return
	}
	respond(w, http.StatusOK, n)
}

func (h *Handler) UnpairNode(w http.ResponseWriter, r *http.Request) {
	nodeID := chi.URLParam(r, "node_id")
	n, err := h.svc.Unpair(r.Context(), nodeID)
	if err != nil {
		if errors.Is(err, service.ErrNodeNotFound) {
			respondError(w, http.StatusNotFound, "node not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to unpair node")
		return
	}
	respond(w, http.StatusOK, n)
}

func (h *Handler) DeleteNode(w http.ResponseWriter, r *http.Request) {
	nodeID := chi.URLParam(r, "node_id")
	if err := h.svc.DeleteNode(r.Context(), nodeID); err != nil {
		if errors.Is(err, service.ErrNodeNotFound) {
			respondError(w, http.StatusNotFound, "node not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to delete node")
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "node deleted"})
}

// ─── Node tag mapping (modular telemetry acquisition) ────────────────────────

// GetNodeTags returns the telemetry tag-mapping config for a node.
func (h *Handler) GetNodeTags(w http.ResponseWriter, r *http.Request) {
	nodeID := chi.URLParam(r, "node_id")
	tags, err := h.svc.GetNodeTags(r.Context(), nodeID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to load tags")
		return
	}
	if tags == nil {
		tags = []model.NodeTag{}
	}
	respond(w, http.StatusOK, map[string]any{"node_id": nodeID, "tags": tags})
}

// SaveNodeTags replaces the full tag-mapping set for a node (attach/detach).
func (h *Handler) SaveNodeTags(w http.ResponseWriter, r *http.Request) {
	nodeID := chi.URLParam(r, "node_id")
	var reqs []model.NodeTagRequest
	if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.SaveNodeTags(r.Context(), nodeID, reqs); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save tags")
		return
	}
	tags, _ := h.svc.GetNodeTags(r.Context(), nodeID)
	respond(w, http.StatusOK, map[string]any{"node_id": nodeID, "tags": tags})
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respond(w, status, map[string]string{"error": msg})
}
