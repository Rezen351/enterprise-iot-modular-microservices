//   Capture: POST /streams/{id}/snapshot     (operator/admin) → MinIO
//   Record:  POST /streams/{id}/record/start (operator/admin)
//            POST /streams/{id}/record/stop  (operator/admin) → cover snapshot
//   Snapshots (MinIO, served via /storage proxy):
//     List:   GET  /snapshots                (optional ?kind=snapshot|recording)
//     Get:    GET  /snapshots/{id}
//     Delete: DELETE /snapshots/{id}         (operator/admin)
// ============================================================================

import { request } from './client';

function qs(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export const streamApi = {
  // ─── List all streams (with live status + playback URLs) ─────────────
  // params: { module_id } — scope streams to a single module.
  list: (params) => request(`/streams${qs(params)}`, { auth: true }),

  // ─── Get a single stream detail ──────────────────────────────────────
  get: (id) => request(`/streams/${encodeURIComponent(id)}`, { auth: true }),

  // ─── Register a new CCTV stream ──────────────────────────────────────
  // body: { name, device_label?, location?, source_rtsp?, node_id?, module_id? }
  create: (body) => request('/streams', { method: 'POST', auth: true, body }),

  // ─── Update label / location / enabled / name / source ───────────────
  update: (id, body) => request(`/streams/${encodeURIComponent(id)}`, { method: 'PUT', auth: true, body }),

  // ─── Unregister a stream (removes MediaMTX path + DB row) ────────────
  remove: (id) => request(`/streams/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),

  // ─── Capture a snapshot of the live feed → MinIO ─────────────────────
  // opts.detect = true also runs the captured frame through the AI vision model
  // and stores the detection result in the gallery's DETECTION tab.
  captureSnapshot: (id, opts = {}) =>
    request(`/streams/${encodeURIComponent(id)}/snapshot${opts.detect ? '?detect=true' : ''}`, { method: 'POST', auth: true }),

  // ─── Recording control (MediaMTX record on/off) ─────────────────────
  startRecording: (id) =>
    request(`/streams/${encodeURIComponent(id)}/record/start`, { method: 'POST', auth: true }),
  stopRecording: (id) =>
    request(`/streams/${encodeURIComponent(id)}/record/stop`, { method: 'POST', auth: true }),

  // ─── Snapshots & recordings (MinIO) ─────────────────────────────────
  // params: { kind?, module_id? } — scope gallery items to a single module.
  listSnapshots: (params) => request(`/snapshots${qs(params)}`, { auth: true }),
  getSnapshot: (id) => request(`/snapshots/${encodeURIComponent(id)}`, { auth: true }),
  deleteSnapshot: (id) => request(`/snapshots/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
};

export default streamApi;
