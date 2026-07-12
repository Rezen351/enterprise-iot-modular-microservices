package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/almuzky/iot/services/control/internal/model"
	"github.com/google/uuid"
)

// ErrNotFound is returned when a record does not exist.
var ErrNotFound = errors.New("record not found")

type Repository struct {
	db *sql.DB
}

func New(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// ─── Control modes ────────────────────────────────────────────────────────────

func (r *Repository) SetMode(ctx context.Context, m *model.ControlMode) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO control_modes (node_id, output_name, mode, active_schedule_id, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE mode = VALUES(mode), active_schedule_id = VALUES(active_schedule_id), updated_at = VALUES(updated_at)`,
		m.NodeID, m.OutputName, m.Mode, m.ActiveScheduleID, now)
	return err
}

func (r *Repository) GetMode(ctx context.Context, nodeID, output string) (*model.ControlMode, error) {
	var m model.ControlMode
	var schedID sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT node_id, output_name, mode, active_schedule_id, updated_at
		 FROM control_modes WHERE node_id = ? AND output_name = ?`, nodeID, output).
		Scan(&m.NodeID, &m.OutputName, &m.Mode, &schedID, &m.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if schedID.Valid {
		m.ActiveScheduleID = &schedID.String
	}
	return &m, nil
}

// ─── Node-level control modes ────────────────────────────────────────────
// Node mode uses a sentinel output_name "*" so a single row per node
// drives arbitration for ALL of that node's outputs/schedules.

func (r *Repository) SetNodeMode(ctx context.Context, nodeID, mode string, prevMode *string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO control_modes (node_id, output_name, mode, prev_mode, updated_at)
		 VALUES (?, '*', ?, ?, ?)
		 ON DUPLICATE KEY UPDATE mode = VALUES(mode), prev_mode = VALUES(prev_mode), updated_at = VALUES(updated_at)`,
		nodeID, mode, prevMode, now)
	return err
}

// EnterEmergency sets the node to EMERGENCY mode while persisting the mode that
// was active immediately before (so ResumeNode can restore it later).
func (r *Repository) EnterEmergency(ctx context.Context, nodeID, prevMode string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO control_modes (node_id, output_name, mode, prev_mode, updated_at)
		 VALUES (?, '*', 'EMERGENCY', ?, ?)
		 ON DUPLICATE KEY UPDATE mode = VALUES(mode), prev_mode = VALUES(prev_mode), updated_at = VALUES(updated_at)`,
		nodeID, prevMode, now)
	return err
}

// ResumeNode exits EMERGENCY by restoring the persisted prev_mode (defaults to
// MODE_AUTO when none was recorded), then clears prev_mode. Returns the mode set.
func (r *Repository) ResumeNode(ctx context.Context, nodeID string) (string, error) {
	var prev sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT prev_mode FROM control_modes WHERE node_id = ? AND output_name = '*'`, nodeID).
		Scan(&prev)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	newMode := model.ModeAuto
	if prev.Valid && prev.String != "" {
		newMode = prev.String
	}
	now := time.Now()
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO control_modes (node_id, output_name, mode, prev_mode, updated_at)
		 VALUES (?, '*', ?, NULL, ?)
		 ON DUPLICATE KEY UPDATE mode = VALUES(mode), prev_mode = VALUES(prev_mode), updated_at = VALUES(updated_at)`,
		nodeID, newMode, now)
	if err != nil {
		return "", err
	}
	return newMode, nil
}

func (r *Repository) GetNodeMode(ctx context.Context, nodeID string) (string, error) {
	var mode string
	err := r.db.QueryRowContext(ctx,
		`SELECT mode FROM control_modes WHERE node_id = ? AND output_name = '*'`, nodeID).
		Scan(&mode)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return mode, nil
}

func (r *Repository) GetNodeModeMap(ctx context.Context) (map[string]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT node_id, mode FROM control_modes WHERE output_name = '*'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var nodeID, mode string
		if err := rows.Scan(&nodeID, &mode); err != nil {
			return nil, err
		}
		out[nodeID] = mode
	}
	return out, rows.Err()
}

// ─── Schedules ────────────────────────────────────────────────────────────────

func (r *Repository) CreateSchedule(ctx context.Context, s *model.Schedule) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	now := time.Now()
	s.CreatedAt, s.UpdatedAt = now, now
	params := string(s.Params)
	if params == "" {
		params = "{}"
	}
	tagName := ""
	if s.TagName != "" {
		tagName = s.TagName
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO schedules (id, node_id, output_name, tag_name, type, params, enabled, next_run_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.NodeID, s.OutputName, tagName, s.Type, params, s.Enabled, s.NextRunAt, s.CreatedAt, s.UpdatedAt)
	return err
}

func (r *Repository) ListSchedules(ctx context.Context, nodeID string, enabledOnly bool) ([]model.Schedule, error) {
	q := `SELECT id, node_id, output_name, tag_name, type, params, enabled, next_run_at, created_at, updated_at FROM schedules WHERE 1=1`
	var args []any
	if nodeID != "" {
		q += ` AND node_id = ?`
		args = append(args, nodeID)
	}
	if enabledOnly {
		q += ` AND enabled = 1`
	}
	q += ` ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Schedule{}
	for rows.Next() {
		s, err := scanSchedule(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

func (r *Repository) GetSchedule(ctx context.Context, id string) (*model.Schedule, error) {
	return scanScheduleRow(r.db.QueryRowContext(ctx,
		`SELECT id, node_id, output_name, tag_name, type, params, enabled, next_run_at, created_at, updated_at FROM schedules WHERE id = ?`, id))
}

func (r *Repository) UpdateSchedule(ctx context.Context, id string, req model.ScheduleRequest) (*model.Schedule, error) {
	s, err := r.GetSchedule(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.NodeID != "" {
		s.NodeID = req.NodeID
	}
	if req.OutputName != "" {
		s.OutputName = req.OutputName
	}
	if req.Type != "" {
		s.Type = req.Type
	}
	if len(req.Params) > 0 {
		s.Params = req.Params
	}
	if req.Enabled != nil {
		s.Enabled = *req.Enabled
	}
	s.UpdatedAt = time.Now()
	params := string(s.Params)
	if params == "" {
		params = "{}"
	}
	_, err = r.db.ExecContext(ctx,
		`UPDATE schedules SET node_id = ?, output_name = ?, tag_name = ?, type = ?, params = ?, enabled = ?, updated_at = ? WHERE id = ?`,
		s.NodeID, s.OutputName, s.TagName, s.Type, params, s.Enabled, s.UpdatedAt, id)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *Repository) UpdateScheduleTagName(ctx context.Context, id, tagName string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE schedules SET tag_name = ? WHERE id = ?`, tagName, id)
	return err
}

func (r *Repository) SetScheduleEnabled(ctx context.Context, id string, enabled bool) error {
	res, err := r.db.ExecContext(ctx, `UPDATE schedules SET enabled = ?, updated_at = ? WHERE id = ?`, enabled, time.Now(), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) DeleteSchedule(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM schedules WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ─── Commands (log + status tracking) ─────────────────────────────────────────

func (r *Repository) CreateCommand(ctx context.Context, c *model.Command) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	c.CreatedAt = time.Now()
	if c.Status == "" {
		c.Status = model.StatusPending
	}
	if c.Source == "" {
		c.Source = model.SourceManual
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO commands (id, req_id, node_id, target, tag_name, control_type, value, source, schedule_id, status, issued_by, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.ReqID, c.NodeID, c.Target, c.TagName, c.ControlType, c.Value, c.Source, c.ScheduleID, c.Status, c.IssuedBy, c.CreatedAt)
	return err
}

func (r *Repository) UpdateCommandStatus(ctx context.Context, id, status string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE commands SET status = ? WHERE id = ?`, status, id)
	return err
}

// MarkAckedByReqID sets a command to acked when its /confirm arrives. Returns
// true if a matching pending/sent command was updated.
func (r *Repository) MarkAckedByReqID(ctx context.Context, reqID string) (bool, error) {
	now := time.Now()
	res, err := r.db.ExecContext(ctx,
		`UPDATE commands SET status = ?, acked_at = ? WHERE req_id = ? AND status IN (?, ?)`,
		model.StatusAcked, now, reqID, model.StatusPending, model.StatusSent)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// TimeoutStaleCommands flips still-unacked commands older than cutoff to timeout.
func (r *Repository) TimeoutStaleCommands(ctx context.Context, cutoff time.Time) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`UPDATE commands SET status = ? WHERE status IN (?, ?) AND created_at < ?`,
		model.StatusTimeout, model.StatusPending, model.StatusSent, cutoff)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}

func (r *Repository) ListCommands(ctx context.Context, nodeID string, limit int) ([]model.Command, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	q := `SELECT id, req_id, node_id, target, tag_name, control_type, value, source, schedule_id, status, issued_by, created_at, acked_at
	      FROM commands WHERE 1=1`
	var args []any
	if nodeID != "" {
		q += ` AND node_id = ?`
		args = append(args, nodeID)
	}
	q += ` ORDER BY created_at DESC LIMIT ?`
	args = append(args, limit)
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Command{}
	for rows.Next() {
		var c model.Command
		var schedID sql.NullString
		var acked sql.NullTime
		if err := rows.Scan(&c.ID, &c.ReqID, &c.NodeID, &c.Target, &c.TagName, &c.ControlType, &c.Value, &c.Source, &schedID, &c.Status, &c.IssuedBy, &c.CreatedAt, &acked); err != nil {
			return nil, err
		}
		if schedID.Valid {
			c.ScheduleID = &schedID.String
		}
		if acked.Valid {
			c.AckedAt = &acked.Time
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ─── scan helpers ─────────────────────────────────────────────────────────────

type scanner interface {
	Scan(dest ...any) error
}

func scanSchedule(s scanner) (*model.Schedule, error) {
	var sc model.Schedule
	var params sql.NullString
	var next sql.NullTime
	if err := s.Scan(&sc.ID, &sc.NodeID, &sc.OutputName, &sc.TagName, &sc.Type, &params, &sc.Enabled, &next, &sc.CreatedAt, &sc.UpdatedAt); err != nil {
		return nil, err
	}
	if params.Valid {
		sc.Params = json.RawMessage(params.String)
	}
	if next.Valid {
		sc.NextRunAt = &next.Time
	}
	return &sc, nil
}

func scanScheduleRow(row scanner) (*model.Schedule, error) {
	s, err := scanSchedule(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return s, err
}
