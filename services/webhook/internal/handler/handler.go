package handler

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/almuzky/iot/services/webhook/internal/middleware"
	"github.com/almuzky/iot/services/webhook/internal/model"
	"github.com/almuzky/iot/services/webhook/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler { return &Handler{svc: svc} }

func Health(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK, h.svc.GetSettingsDTO())
}

func (h *Handler) PutSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Telegram model.ChannelInput `json:"telegram"`
		Email    model.ChannelInput `json:"email"`
		Webhook  model.ChannelInput `json:"webhook"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON body")
		return
	}
	if req.Telegram.Enabled && !validateTelegramTarget(req.Telegram.Target) {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid telegram chat id")
		return
	}
	if req.Email.Enabled && !validateEmail(req.Email.Target) {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid email address")
		return
	}
	userID := middleware.UserIDFromContext(r.Context())
	dto, err := h.svc.UpdateSettings(r.Context(), model.SettingsPatch{
		Telegram: req.Telegram,
		Email:    req.Email,
		Webhook:  req.Webhook,
	}, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update settings")
		return
	}
	respond(w, http.StatusOK, dto)
}

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

func (h *Handler) TestSend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Channel string `json:"channel"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	userID := middleware.UserIDFromContext(r.Context())
	count, err := h.svc.SendTest(r.Context(), strings.ToLower(strings.TrimSpace(req.Channel)), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to enqueue test")
		return
	}
	if count == 0 {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "no enabled channel configured")
		return
	}
	respond(w, http.StatusAccepted, map[string]any{"enqueued": count, "message": "test webhook queued for delivery"})
}

func (h *Handler) ReceiveTelegram(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "BAD_REQUEST", "POST required")
		return
	}
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}
	b, _ := json.Marshal(payload)
	_ = h.svc.HandleIncoming(r.Context(), "telegram", "", "Telegram Update", string(b), "", "")
	respond(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}

func (h *Handler) ReceiveEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "BAD_REQUEST", "POST required")
		return
	}
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}
	b, _ := json.Marshal(payload)
	_ = h.svc.HandleIncoming(r.Context(), "email", "", "Email Webhook", string(b), "", "")
	respond(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}

func (h *Handler) ReceiveGeneric(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "BAD_REQUEST", "POST required")
		return
	}
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}
	b, _ := json.Marshal(payload)
	_ = h.svc.HandleIncoming(r.Context(), "webhook", "", "Incoming Webhook", string(b), "", "")
	respond(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}

func (h *Handler) ReceiveDelivery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "BAD_REQUEST", "POST required")
		return
	}
	var ev service.DeliveryEvent
	if err := json.NewDecoder(r.Body).Decode(&ev); err != nil {
		respondError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}
	_ = h.svc.HandleIncoming(r.Context(), ev.Channel, ev.Target, ev.Subject, ev.Body, ev.AlertID, ev.UserID)
	respond(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}

var (
	emailRe  = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	chatIDRe = regexp.MustCompile(`^-?\d+$`)
)

func validateEmail(s string) bool          { return emailRe.MatchString(s) }
func validateTelegramTarget(s string) bool { return chatIDRe.MatchString(s) }

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
