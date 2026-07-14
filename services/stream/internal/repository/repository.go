package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/almuzky/iot/services/stream/internal/model"
	"github.com/google/uuid"
)

// ErrNotFound is returned when a stream record does not exist.
var ErrNotFound = errors.New("stream not found")

type Repository struct {
	db *sql.DB
}

func New(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// CreateStream inserts a new stream row. sourceRTSP must be non-empty (the
// caller resolves the default CCTV_RTSP_URL when the request omits it).
func (r *Repository) CreateStream(ctx context.Context, name, deviceLabel, location, sourceRTSP, nodeID, moduleID string) (*model.Stream, error) {
	s := &model.Stream{
		ID:          uuid.New().String(),
		Name:        name,
		DeviceLabel: deviceLabel,
		Location:    location,
		SourceRTSP:  sourceRTSP,
		NodeID:      nodeID,
		ModuleID:    moduleID,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO streams (id, name, device_label, location, source_rtsp, node_id, module_id, enabled, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.Name, s.DeviceLabel, s.Location, s.SourceRTSP, s.NodeID, s.ModuleID, s.Enabled, s.CreatedAt, s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *Repository) GetStream(ctx context.Context, id string) (*model.Stream, error) {
	return r.scanOne(r.db.QueryRowContext(ctx, streamSelect+` WHERE id = ?`, id))
}

// GetStreamByName resolves a stream by its MediaMTX path name.
func (r *Repository) GetStreamByName(ctx context.Context, name string) (*model.Stream, error) {
	return r.scanOne(r.db.QueryRowContext(ctx, streamSelect+` WHERE name = ?`, name))
}

func (r *Repository) ListStreams(ctx context.Context, moduleID string) ([]model.Stream, error) {
	q := streamSelect + ` ORDER BY created_at DESC`
	var rows *sql.Rows
	var err error
	if moduleID != "" {
		rows, err = r.db.QueryContext(ctx, streamSelect+` WHERE module_id = ? ORDER BY created_at DESC`, moduleID)
	} else {
		rows, err = r.db.QueryContext(ctx, q)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Stream{}
	for rows.Next() {
		s, err := scanRows(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

// UpdateStream patches mutable fields. Only non-nil fields are applied.
func (r *Repository) UpdateStream(ctx context.Context, id string, req model.UpdateStreamRequest) (*model.Stream, error) {
	s, err := r.GetStream(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		s.Name = *req.Name
	}
	if req.DeviceLabel != nil {
		s.DeviceLabel = *req.DeviceLabel
	}
	if req.Location != nil {
		s.Location = *req.Location
	}
	if req.SourceRTSP != nil {
		s.SourceRTSP = *req.SourceRTSP
	}
	if req.Enabled != nil {
		s.Enabled = *req.Enabled
	}
	if req.NodeID != nil {
		s.NodeID = *req.NodeID
	}
	if req.ModuleID != nil {
		s.ModuleID = *req.ModuleID
	}
	s.UpdatedAt = time.Now()
	_, err = r.db.ExecContext(ctx,
		`UPDATE streams SET name = ?, device_label = ?, location = ?, source_rtsp = ?, node_id = ?, module_id = ?, enabled = ?, updated_at = ? WHERE id = ?`,
		s.Name, s.DeviceLabel, s.Location, s.SourceRTSP, s.NodeID, s.ModuleID, s.Enabled, s.UpdatedAt, id)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// DeleteStream removes the stream row. Returns ErrNotFound when absent.
func (r *Repository) DeleteStream(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM streams WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

const streamSelect = `SELECT id, name, device_label, location, source_rtsp, node_id, module_id, enabled, created_at, updated_at FROM streams`

type scanner interface {
	Scan(dest ...any) error
}

func (r *Repository) scanOne(row scanner) (*model.Stream, error) {
	s, err := scanRows(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return s, err
}

func scanRows(s scanner) (*model.Stream, error) {
	var st model.Stream
	var deviceLabel, location, nodeID, moduleID sql.NullString
	var enabled int
	if err := s.Scan(&st.ID, &st.Name, &deviceLabel, &location, &st.SourceRTSP, &nodeID, &moduleID, &enabled, &st.CreatedAt, &st.UpdatedAt); err != nil {
		return nil, err
	}
	st.DeviceLabel = deviceLabel.String
	st.Location = location.String
	st.NodeID = nodeID.String
	st.ModuleID = moduleID.String
	st.Enabled = enabled != 0
	return &st, nil
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

const snapshotSelect = `SELECT id, stream_id, stream_name, module_id, object_key, url, content_type, size, kind, model_id, model_name, num_detections, classes, detections, confidence_avg, duration, created_at FROM snapshots`

// CreateSnapshot inserts a snapshot/recording metadata row.
func (r *Repository) CreateSnapshot(ctx context.Context, s *model.Snapshot) (*model.Snapshot, error) {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO snapshots (id, stream_id, stream_name, module_id, object_key, url, content_type, size, kind, model_id, model_name, num_detections, classes, detections, confidence_avg, duration, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.StreamID, s.StreamName, s.ModuleID, s.ObjectKey, s.URL, s.ContentType, s.Size, s.Kind,
		s.ModelID, s.ModelName, s.NumDetections, s.Classes, s.Detections, s.ConfidenceAvg, s.Duration, s.CreatedAt)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// ListSnapshots returns snapshots newest-first, optionally filtered by kind
// and/or the owning module (module_id is denormalized from the parent stream).
func (r *Repository) ListSnapshots(ctx context.Context, kind, moduleID string) ([]model.Snapshot, error) {
	q := snapshotSelect + ` ORDER BY created_at DESC`
	var rows *sql.Rows
	var err error
	switch {
	case kind != "" && moduleID != "":
		rows, err = r.db.QueryContext(ctx, snapshotSelect+` WHERE kind = ? AND module_id = ? ORDER BY created_at DESC`, kind, moduleID)
	case kind != "":
		rows, err = r.db.QueryContext(ctx, snapshotSelect+` WHERE kind = ? ORDER BY created_at DESC`, kind)
	case moduleID != "":
		rows, err = r.db.QueryContext(ctx, snapshotSelect+` WHERE module_id = ? ORDER BY created_at DESC`, moduleID)
	default:
		rows, err = r.db.QueryContext(ctx, q)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Snapshot{}
	for rows.Next() {
		var s model.Snapshot
		var streamID, streamName, moduleID, objectKey, url, contentType, kind, modelID, modelName, classes, detections sql.NullString
		var size, numDetections sql.NullInt64
		var confidenceAvg, duration sql.NullFloat64
		var createdAt sql.NullTime
		if err := rows.Scan(&s.ID, &streamID, &streamName, &moduleID, &objectKey, &url, &contentType, &size, &kind, &modelID, &modelName, &numDetections, &classes, &detections, &confidenceAvg, &duration, &createdAt); err != nil {
			return nil, err
		}
		s.StreamID = streamID.String
		s.StreamName = streamName.String
		s.ModuleID = moduleID.String
		s.ObjectKey = objectKey.String
		s.URL = url.String
		s.ContentType = contentType.String
		s.Size = size.Int64
		s.Kind = kind.String
		s.ModelID = modelID.String
		s.ModelName = modelName.String
		s.NumDetections = int(numDetections.Int64)
		s.Classes = classes.String
		s.Detections = detections.String
		s.ConfidenceAvg = confidenceAvg.Float64
		s.Duration = duration.Float64
		if createdAt.Valid {
			s.CreatedAt = createdAt.Time
		}
		if s.Kind == "" {
			s.Kind = "snapshot"
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// GetSnapshot fetches a single snapshot by id.
func (r *Repository) GetSnapshot(ctx context.Context, id string) (*model.Snapshot, error) {
	row := r.db.QueryRowContext(ctx, snapshotSelect+` WHERE id = ?`, id)
	var s model.Snapshot
	var streamID, streamName, moduleID, objectKey, url, contentType, kind, modelID, modelName, classes, detections sql.NullString
	var size, numDetections sql.NullInt64
	var confidenceAvg, duration sql.NullFloat64
	var createdAt sql.NullTime
	if err := row.Scan(&s.ID, &streamID, &streamName, &moduleID, &objectKey, &url, &contentType, &size, &kind, &modelID, &modelName, &numDetections, &classes, &detections, &confidenceAvg, &duration, &createdAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	s.StreamID = streamID.String
	s.StreamName = streamName.String
	s.ModuleID = moduleID.String
	s.ObjectKey = objectKey.String
	s.URL = url.String
	s.ContentType = contentType.String
	s.Size = size.Int64
	s.Kind = kind.String
	s.ModelID = modelID.String
	s.ModelName = modelName.String
	s.NumDetections = int(numDetections.Int64)
	s.Classes = classes.String
	s.Detections = detections.String
	s.ConfidenceAvg = confidenceAvg.Float64
	s.Duration = duration.Float64
	if createdAt.Valid {
		s.CreatedAt = createdAt.Time
	}
	if s.Kind == "" {
		s.Kind = "snapshot"
	}
	return &s, nil
}

// DeleteSnapshot removes a snapshot row. Returns ErrNotFound when absent.
func (r *Repository) DeleteSnapshot(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM snapshots WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}
