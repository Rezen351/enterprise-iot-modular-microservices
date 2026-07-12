// ============================================================================
// CONTROL API — device command dispatch via the Control Service (through Kong)
// ----------------------------------------------------------------------------
// Endpoints (Kong → control-service):
//   Manual:    POST /control/command
//   Log:       GET  /control/commands?node_id&limit
//   Targets:   GET  /control/targets?node_id           (auto-discovered outputs)
//   Schedules: GET/POST /control/schedules   PUT/DELETE /control/schedules/{id}
//              POST /control/schedules/{id}/enable | /disable
//   Modes:     PUT  /control/modes/{node_id}/{output}
// ----------------------------------------------------------------------------
// Manual mode = command published immediately. Automatic mode = server-side
// scheduler (interval/schedule/threshold/duration/ramp) drives the output.
// ============================================================================

import { request } from './client';

function qs(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export const controlApi = {
  // ─── Manual command (published immediately) ────────────────────────────
  // body: { node_id, output, type, value?, duration_sec? }
  //   type: set_state | set_level | toggle | pulse | emergency_stop
  sendCommand: (body) => request('/control/command', { method: 'POST', auth: true, body }),

  // ─── Command log ───────────────────────────────────────────────────────
  listCommands: (params) => request(`/control/commands${qs(params)}`, { auth: true }),

  // ─── Targets (controllable outputs resolved from actuator tags) ─────────
  listTargets: (nodeId) => request(`/control/targets${qs({ node_id: nodeId })}`, { auth: true }),

  // ─── Firmware outputs (for choosing which output to tag as actuator) ─────
  listOutputs: (nodeId) => request(`/control/outputs${qs({ node_id: nodeId })}`, { auth: true }),

  // ─── Schedules (automatic control) ──────────────────────────────────────
  listSchedules: (nodeId) => request(`/control/schedules${qs({ node_id: nodeId })}`, { auth: true }),
  getSchedule: (id) => request(`/control/schedules/${id}`, { auth: true }),
  createSchedule: (body) => request('/control/schedules', { method: 'POST', auth: true, body }),
  updateSchedule: (id, body) => request(`/control/schedules/${id}`, { method: 'PUT', auth: true, body }),
  enableSchedule: (id) => request(`/control/schedules/${id}/enable`, { method: 'POST', auth: true }),
  disableSchedule: (id) => request(`/control/schedules/${id}/disable`, { method: 'POST', auth: true }),
  deleteSchedule: (id) => request(`/control/schedules/${id}`, { method: 'DELETE', auth: true }),

  // ─── Node mode (MANUAL | AUTO | EMERGENCY) ───────────────────────
  // Drives arbitration: AUTO runs schedules & blocks manual override
  // (except emergency stop); MANUAL pauses schedules & allows override;
  // EMERGENCY forces all outputs off until resumed.
  getNodeMode: (nodeId) =>
    request(`/control/modes/${encodeURIComponent(nodeId)}`, { auth: true }),
  setNodeMode: (nodeId, mode) =>
    request(`/control/modes/${encodeURIComponent(nodeId)}`, {
      method: 'PUT', auth: true, body: { mode },
    }),
  resumeNode: (nodeId) =>
    request(`/control/modes/${encodeURIComponent(nodeId)}/resume`, {
      method: 'POST', auth: true,
    }),
};

export default controlApi;
