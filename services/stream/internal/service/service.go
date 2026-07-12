package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/almuzky/iot/services/stream/internal/client/mediamtx"
	mlclient "github.com/almuzky/iot/services/stream/internal/client/ml"
	miniosvc "github.com/almuzky/iot/services/stream/internal/client/minio"
	"github.com/almuzky/iot/services/stream/internal/model"
	"github.com/almuzky/iot/services/stream/internal/repository"
	"github.com/google/uuid"
)

// Errors surfaced to the handler.
var (
	ErrNotFound      = repository.ErrNotFound
	ErrMediaMTX      = errors.New("mediamtx operation failed")
	ErrMinIO         = errors.New("minio operation failed")
	ErrDuplicateName = errors.New("stream name already exists")
)

// StreamService coordinates DB metadata with MediaMTX path registration.
type StreamService struct {
	repo     *repository.Repository
	media    *mediamtx.Client
	minio    *miniosvc.Client
	ml       *mlclient.Client
	kongURL  string
	cctvRTSP string
}

func New(repo *repository.Repository, media *mediamtx.Client, minioClient *miniosvc.Client, mlClient *mlclient.Client, kongURL, cctvRTSP string) *StreamService {
	return &StreamService{repo: repo, media: media, minio: minioClient, ml: mlClient, kongURL: kongURL, cctvRTSP: cctvRTSP}
}

// CreateStream inserts the DB row then registers the path in MediaMTX.
// If MediaMTX registration fails, the DB row is rolled back (deleted) so the
// two systems never diverge.
func (s *StreamService) CreateStream(ctx context.Context, req model.CreateStreamRequest) (*model.StreamView, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	source := req.SourceRTSP
	if strings.TrimSpace(source) == "" {
		if s.cctvRTSP == "" {
			return nil, fmt.Errorf("source_rtsp is required (no default CCTV_RTSP_URL configured)")
		}
		source = s.cctvRTSP
	}

	// Best-effort duplicate guard before touching MediaMTX (race tolerated).
	if existing, _ := s.repo.GetStreamByName(ctx, name); existing != nil {
		return nil, ErrDuplicateName
	}

	st, err := s.repo.CreateStream(ctx, name, req.DeviceLabel, req.Location, source)
	if err != nil {
		// Likely a duplicate-key on `name` at the DB layer.
		if isDuplicateErr(err) {
			return nil, ErrDuplicateName
		}
		return nil, err
	}

	if err := s.media.AddPath(ctx, name, source); err != nil {
		// Roll back the DB row so metadata & MediaMTX stay consistent.
		if delErr := s.repo.DeleteStream(ctx, st.ID); delErr != nil && delErr != repository.ErrNotFound {
			return nil, fmt.Errorf("mediamtx add failed and rollback failed: %v (original: %v)", delErr, err)
		}
		return nil, fmt.Errorf("%w: %v", ErrMediaMTX, err)
	}

	return s.toView(ctx, st), nil
}

// GetStream returns metadata + live status + playback URLs.
func (s *StreamService) GetStream(ctx context.Context, id string) (*model.StreamView, error) {
	st, err := s.repo.GetStream(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.toView(ctx, st), nil
}

// ListStreams returns all streams with live status + playback URLs.
func (s *StreamService) ListStreams(ctx context.Context) ([]model.StreamView, error) {
	streams, err := s.repo.ListStreams(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]model.StreamView, 0, len(streams))
	for i := range streams {
		out = append(out, *s.toView(ctx, &streams[i]))
	}
	return out, nil
}

// UpdateStream patches metadata. MediaMTX path is NOT re-registered (source is
// immutable after creation in Fase 5); changing the source requires delete+create.
// UpdateStream patches metadata. When the name or source changes, the
// MediaMTX path is re-registered (old path removed, new path added with the
// updated name/source) so live playback keeps working.
func (s *StreamService) UpdateStream(ctx context.Context, id string, req model.UpdateStreamRequest) (*model.StreamView, error) {
	current, err := s.repo.GetStream(ctx, id)
	if err != nil {
		return nil, err
	}
	oldName := current.Name

	st, err := s.repo.UpdateStream(ctx, id, req)
	if err != nil {
		return nil, err
	}

	changed := (req.Name != nil && *req.Name != oldName) ||
		(req.SourceRTSP != nil && *req.SourceRTSP != current.SourceRTSP)
	if changed {
		// Best-effort removal of the old path; ignore "not found".
		if err := s.media.RemovePath(ctx, oldName); err != nil {
			if !mediamtx.IsNotFound(err) {
				return nil, err
			}
		}
		source := st.SourceRTSP
		if req.SourceRTSP != nil && *req.SourceRTSP != "" {
			source = *req.SourceRTSP
		}
		if err := s.media.AddPath(ctx, st.Name, source); err != nil {
			return nil, fmt.Errorf("%w: %v", ErrMediaMTX, err)
		}
	}

	return s.toView(ctx, st), nil
}

// DeleteStream removes the MediaMTX path first, then the DB row — even if the
// DB delete already succeeded we still attempt the MediaMTX removal so the
// server does not keep pulling a deleted stream.
func (s *StreamService) DeleteStream(ctx context.Context, id string) error {
	st, err := s.repo.GetStream(ctx, id)
	if err != nil {
		return err
	}
	// Best-effort MediaMTX cleanup; do not block on it fatally.
	if err := s.media.RemovePath(ctx, st.Name); err != nil {
		return fmt.Errorf("%w: %v", ErrMediaMTX, err)
	}
	if err := s.repo.DeleteStream(ctx, id); err != nil {
		return err
	}
	return nil
}

// toView enriches a stream with MediaMTX status and playback URLs.
func (s *StreamService) toView(ctx context.Context, st *model.Stream) *model.StreamView {
	status := "idle"
	if st.Enabled {
		status = s.media.GetPathStatus(ctx, st.Name)
	}
	return &model.StreamView{
		ID:          st.ID,
		Name:        st.Name,
		DeviceLabel: st.DeviceLabel,
		Location:    st.Location,
		SourceRTSP:  st.SourceRTSP,
		Enabled:     st.Enabled,
		Status:      status,
		HlsURL:      s.hlsURL(st.Name),
		WebRTCURL:   s.webrtcURL(st.Name),
		CreatedAt:   st.CreatedAt,
		UpdatedAt:   st.UpdatedAt,
	}
}

// hlsURL builds the gateway HLS URL: {kong}/hls/{name}/index.m3u8.
func (s *StreamService) hlsURL(name string) string {
	base := strings.TrimRight(s.kongURL, "/")
	return fmt.Sprintf("%s/hls/%s/index.m3u8", base, name)
}

// webrtcURL builds the host-direct WHEP playback URL. WebRTC media/STUN cannot
// traverse Kong, so it points at the MediaMTX WebRTC port (8889) on the host
// that the browser resolves. The host is derived from KONG_PUBLIC_URL. WHEP is
// an HTTP POST of the SDP offer (not a raw ws:// connection).
func (s *StreamService) webrtcURL(name string) string {
	host := "localhost"
	if u, err := url.Parse(s.kongURL); err == nil && u.Hostname() != "" {
		host = u.Hostname()
	}
	return fmt.Sprintf("http://%s:8889/%s/whep", host, name)
}

func isDuplicateErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "1062") || strings.Contains(msg, "unique")
}

// ─── Snapshots & Recordings ───────────────────────────────────────────────────

// CaptureSnapshot grabs the current frame of a stream from MediaMTX, uploads it
// to the MinIO stream bucket, and stores the metadata row. When detect is true
// the captured frame is additionally sent to the AI vision model; the raw frame
// is stored as a regular snapshot and the detection result (with inline
// bounding boxes) is stored as a separate "detection" snapshot so the gallery
// can render it in its own tab.
func (s *StreamService) CaptureSnapshot(ctx context.Context, id string, detect bool) (*model.SnapshotView, error) {
	if s.minio == nil {
		return nil, fmt.Errorf("%w: client not configured", ErrMinIO)
	}
	st, err := s.repo.GetStream(ctx, id)
	if err != nil {
		return nil, err
	}

	data, ct, err := s.media.CaptureSnapshot(ctx, st.Name)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMediaMTX, err)
	}

	key := fmt.Sprintf("snapshots/%s/%s.jpg", st.Name, uuid.New().String())
	url, err := s.minio.UploadObject(key, ct, data)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMinIO, err)
	}

	// Always persist the plain snapshot (the original frame, viewable in /storage).
	snap := &model.Snapshot{
		ID:          uuid.New().String(),
		StreamID:    st.ID,
		StreamName:  st.Name,
		ObjectKey:   key,
		URL:         url,
		ContentType: ct,
		Size:        int64(len(data)),
		Kind:        "snapshot",
		CreatedAt:   time.Now(),
	}
	if _, err := s.repo.CreateSnapshot(ctx, snap); err != nil {
		return nil, err
	}

	if !detect {
		return toSnapshotView(snap), nil
	}

	// Run AI vision detection on the captured frame.
	if s.ml == nil {
		return nil, fmt.Errorf("%w: AI vision client not configured", ErrMinIO)
	}
	result, derr := s.ml.Detect(ctx, data, fmt.Sprintf("%s_%s.jpg", st.Name, uuid.New().String()))
	if derr != nil {
		// The plain snapshot is already stored; surface the detection error so
		// the dashboard can tell the user detection failed.
		return nil, fmt.Errorf("ai vision detection failed: %w", derr)
	}
	if result == nil {
		return nil, fmt.Errorf("ai vision returned no result")
	}

	classesJSON, _ := json.Marshal(result.Classes)
	detJSON, _ := json.Marshal(result.Detections)
	detSnap := &model.Snapshot{
		ID:            uuid.New().String(),
		StreamID:      st.ID,
		StreamName:    st.Name,
		ObjectKey:     key,
		URL:           url, // original frame; the dashboard overlays the boxes
		ContentType:   ct,
		Size:          int64(len(data)),
		Kind:          "detection",
		ModelID:       result.ModelID,
		ModelName:     result.ModelName,
		NumDetections: result.NumDetections,
		Classes:       string(classesJSON),
		Detections:    string(detJSON),
		ConfidenceAvg: result.ConfidenceAvg,
		CreatedAt:     time.Now(),
	}
	if _, err := s.repo.CreateSnapshot(ctx, detSnap); err != nil {
		return nil, err
	}
	return toSnapshotView(detSnap), nil
}

// ListSnapshots returns snapshots/recordings newest-first (optional kind filter).
func (s *StreamService) ListSnapshots(ctx context.Context, kind string) ([]model.SnapshotView, error) {
	snaps, err := s.repo.ListSnapshots(ctx, kind)
	if err != nil {
		return nil, err
	}
	out := make([]model.SnapshotView, 0, len(snaps))
	for i := range snaps {
		out = append(out, *toSnapshotView(&snaps[i]))
	}
	return out, nil
}

// GetSnapshot returns a single snapshot view.
func (s *StreamService) GetSnapshot(ctx context.Context, id string) (*model.SnapshotView, error) {
	snap, err := s.repo.GetSnapshot(ctx, id)
	if err != nil {
		return nil, err
	}
	return toSnapshotView(snap), nil
}

// DeleteSnapshot removes the DB row and the MinIO object.
func (s *StreamService) DeleteSnapshot(ctx context.Context, id string) error {
	snap, err := s.repo.GetSnapshot(ctx, id)
	if err != nil {
		return err
	}
	if s.minio != nil {
		_ = s.minio.DeleteObject(snap.ObjectKey)
	}
	return s.repo.DeleteSnapshot(ctx, id)
}

// StartRecording enables MediaMTX recording for the path. The recorded segments
// are written by MediaMTX; the cover frame is captured on stop.
func (s *StreamService) StartRecording(ctx context.Context, id string) error {
	st, err := s.repo.GetStream(ctx, id)
	if err != nil {
		return err
	}
	if err := s.media.SetRecord(ctx, st.Name, true); err != nil {
		return fmt.Errorf("%w: %v", ErrMediaMTX, err)
	}
	return nil
}

// StopRecording disables MediaMTX recording and stores a cover snapshot
// (kind="recording") in the MinIO stream bucket.
func (s *StreamService) StopRecording(ctx context.Context, id string) (*model.SnapshotView, error) {
	st, err := s.repo.GetStream(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.media.SetRecord(ctx, st.Name, false); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMediaMTX, err)
	}

	if s.minio == nil {
		return nil, fmt.Errorf("%w: client not configured", ErrMinIO)
	}
	data, ct, err := s.media.CaptureSnapshot(ctx, st.Name)
	if err != nil {
		// Recording stopped; cover capture is best-effort.
		return nil, fmt.Errorf("%w: cover capture failed: %v", ErrMediaMTX, err)
	}
	key := fmt.Sprintf("recordings/%s/%s.jpg", st.Name, uuid.New().String())
	u, err := s.minio.UploadObject(key, ct, data)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMinIO, err)
	}
	snap := &model.Snapshot{
		ID:          uuid.New().String(),
		StreamID:    st.ID,
		StreamName:  st.Name,
		ObjectKey:   key,
		URL:         u,
		ContentType: ct,
		Size:        int64(len(data)),
		Kind:        "recording",
		CreatedAt:   time.Now(),
	}
	if _, err := s.repo.CreateSnapshot(ctx, snap); err != nil {
		return nil, err
	}
	return toSnapshotView(snap), nil
}

func toSnapshotView(s *model.Snapshot) *model.SnapshotView {
	return &model.SnapshotView{
		ID:            s.ID,
		StreamID:      s.StreamID,
		StreamName:    s.StreamName,
		URL:           s.URL,
		Kind:          s.Kind,
		Size:          s.Size,
		CreatedAt:     s.CreatedAt,
		ModelID:       s.ModelID,
		ModelName:     s.ModelName,
		NumDetections: s.NumDetections,
		Classes:       s.Classes,
		Detections:    s.Detections,
		ConfidenceAvg: s.ConfidenceAvg,
	}
}
