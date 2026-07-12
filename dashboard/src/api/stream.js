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
  list: () => request('/streams', { auth: true }),

  // ─── Get a single stream detail ──────────────────────────────────────
  get: (id) => request(`/streams/${encodeURIComponent(id)}`, { auth: true }),

  // ─── Register a new CCTV stream ──────────────────────────────────────
  // body: { name, device_label?, location?, source_rtsp? }
  //   source_rtsp is optional — when omitted the server uses CCTV_RTSP_URL.
  create: (body) => request('/streams', { method: 'POST', auth: true, body }),

  // ─── Update label / location / enabled / name / source ───────────────
  update: (id, body) => request(`/streams/${encodeURIComponent(id)}`, { method: 'PUT', auth: true, body }),

  // ─── Unregister a stream (removes MediaMTX path + DB row) ────────────
  remove: (id) => request(`/streams/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),

  // ─── Capture a snapshot of the live feed → MinIO ─────────────────────
  captureSnapshot: (id) =>
    request(`/streams/${encodeURIComponent(id)}/snapshot`, { method: 'POST', auth: true }),

  // ─── Recording control (MediaMTX record on/off) ─────────────────────
  startRecording: (id) =>
    request(`/streams/${encodeURIComponent(id)}/record/start`, { method: 'POST', auth: true }),
  stopRecording: (id) =>
    request(`/streams/${encodeURIComponent(id)}/record/stop`, { method: 'POST', auth: true }),

  // ─── Snapshots & recordings (MinIO) ─────────────────────────────────
  listSnapshots: (kind) => request(`/snapshots${qs({ kind })}`, { auth: true }),
  getSnapshot: (id) => request(`/snapshots/${encodeURIComponent(id)}`, { auth: true }),
  deleteSnapshot: (id) => request(`/snapshots/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
};

export default streamApi;
