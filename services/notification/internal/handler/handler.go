package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/almuzky/iot/services/notification/internal/middleware"
	"github.com/almuzky/iot/services/notification/internal/model"
	"github.com/almuzky/iot/services/notification/internal/service"
)

// Handler serves the notification HTTP API.
type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler { return &Handler{svc: svc} }

// Health reports service liveness.
func Health(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GetSettings returns the non-secret settings view (any authenticated user).
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK, h.svc.GetSettingsDTO())
}

// PutSettings updates settings (admin only). Validates targets and encrypts
// any provided secrets server-side.
func (h *Handler) PutSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Telegram model.ChannelInput `json:"telegram"`
		Email    model.ChannelInput `json:"email"`
		Push     model.ChannelInput `json:"push"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON body")
		return
	}
	if req.Telegram.Enabled {
		if err := validateTelegramTarget(req.Telegram.Target); err != nil {
			respondError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
			return
		}
	}
	if req.Email.Enabled {
		if err := validateEmail(req.Email.Target); err != nil {
			respondError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
			return
		}
	}
	if req.Push.Enabled && strings.TrimSpace(req.Push.Target) == "" {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "push target (device token) must not be empty")
		return
	}

	userID := middleware.UserIDFromContext(r.Context())
	dto, err := h.svc.UpdateSettings(r.Context(), model.SettingsPatch{
		Telegram: req.Telegram,
		Email:    req.Email,
		Push:     req.Push,
	}, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update settings")
		return
	}
	respond(w, http.StatusOK, dto)
}

// GetLogs returns delivery logs (any authenticated user).
func (h *Handler) GetLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := atoiDefault(q.Get("limit"), 50)
	if limit < 1 || limit > 500 {
		limit = 50
	}
	offset := atoiDefault(q.Get("offset"), 0)
	if offset < 0 {
		offset = 0
	}
	logs, total, err := h.svc.ListLogs(r.Context(), q.Get("channel"), q.Get("status"), limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to query logs")
		return
	}
	dtos := make([]model.LogDTO, 0, len(logs))
	for _, l := range logs {
		dtos = append(dtos, model.ToLogDTO(l))
	}
	respond(w, http.StatusOK, map[string]any{
		"logs":   dtos,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// TestSend enqueues a real (dummy) notification (admin only).
func (h *Handler) TestSend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Channel string `json:"channel"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	userID := middleware.UserIDFromContext(r.Context())
	count, err := h.svc.SendTest(r.Context(), strings.ToLower(strings.TrimSpace(req.Channel)), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to enqueue test notification")
		return
	}
	if count == 0 {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "no enabled channel configured to send test")
		return
	}
	respond(w, http.StatusAccepted, map[string]any{"enqueued": count, "message": "test notification(s) queued for delivery"})
}

// ─── Validation ──────────────────────────────────────────────────────────

var (
	emailRe  = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	chatIDRe = regexp.MustCompile(`^-?\d+$`)
)

func validateEmail(s string) error {
	if !emailRe.MatchString(s) {
		return errors.New("invalid email address format")
	}
	return nil
}

func validateTelegramTarget(s string) error {
	if !chatIDRe.MatchString(s) {
		return errors.New("invalid telegram chat id (must be numeric, e.g. 123456789 or -1001234567890)")
	}
	return nil
}

// ─── Response helpers (standard wrapper, AGENTS.md §4.4) ──────────────────

func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "data": v})
}

func respondError(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "error": map[string]string{"code": code, "message": msg}})
}

func atoiDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}
