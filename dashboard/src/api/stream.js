//   Capture: POST /streams/{id}/snapshot     (operator/admin) → MinIO
//   Record:  POST /streams/{id}/record/start (operator/admin)
//            POST /streams/{id}/record/stop  (operator/admin) → cover snapshot
//   Snapshots (MinIO, served via /storage proxy):
//     List:   GET  /snapshots                (optional ?kind=snapshot|recording)
//     Get:    GET  /snapshots/{id}
//     Delete: DELETE /snapshots/{id}         (operator/admin)
// ============================================================================

import { request } from './client';

// The Stream Service returns the standardized response wrapper
// { success, data }. Unwrap `data` so callers keep using the inner
// payload (e.g. { streams }, { snapshots }, a StreamView, ...).
const unwrap = async (path, opts) => {
  const res = await request(path, opts);
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

function qs(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export const streamApi = {
  // ─── List all streams (with live status + playback URLs) ─────────────
  // params: { module_id } — scope streams to a single module.
  list: (params) => unwrap(`/streams${qs(params)}`, { auth: true }),

  // ─── Get a single stream detail ──────────────────────────────────────
  get: (id) => unwrap(`/streams/${encodeURIComponent(id)}`, { auth: true }),

  // ─── Register a new CCTV stream ──────────────────────────────────────
  // body: { name, device_label?, location?, source_rtsp?, node_id?, module_id? }
  create: (body) => unwrap('/streams', { method: 'POST', auth: true, body }),

  // ─── Update label / location / enabled / name / source ───────────────
  update: (id, body) => unwrap(`/streams/${encodeURIComponent(id)}`, { method: 'PUT', auth: true, body }),

  // ─── Unregister a stream (removes MediaMTX path + DB row) ────────────
  remove: (id) => unwrap(`/streams/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),

  // ─── Capture a snapshot of the live feed → MinIO ─────────────────────
  // opts.detect = true also runs the captured frame through the AI vision model
  // and stores the detection result in the gallery's DETECTION tab.
  captureSnapshot: (id, opts = {}) =>
    unwrap(`/streams/${encodeURIComponent(id)}/snapshot${opts.detect ? '?detect=true' : ''}`, { method: 'POST', auth: true }),

  // ─── Recording control (MediaMTX record on/off) ─────────────────────
  startRecording: (id) =>
    unwrap(`/streams/${encodeURIComponent(id)}/record/start`, { method: 'POST', auth: true }),
  stopRecording: (id) =>
    unwrap(`/streams/${encodeURIComponent(id)}/record/stop`, { method: 'POST', auth: true }),

  // ─── Snapshots & recordings (MinIO) ─────────────────────────────────
  // params: { kind?, module_id? } — scope gallery items to a single module.
  listSnapshots: (params) => unwrap(`/snapshots${qs(params)}`, { auth: true }),
  getSnapshot: (id) => unwrap(`/snapshots/${encodeURIComponent(id)}`, { auth: true }),
  deleteSnapshot: (id) => unwrap(`/snapshots/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
};

export default streamApi;
