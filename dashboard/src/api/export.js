// ============================================================================
// EXPORT API — data export endpoints from the Export Service via Kong
// ----------------------------------------------------------------------------
// Endpoints (Kong → export-service):
//   GET /export/telemetry?format&node_id&metric&from&to&limit&offset
//   GET /export/telemetry/aggregate?format&bucket&node_id&metric&from&to
//   GET /export/nodes?format
//   GET /export/alerts?format&from&to&node_id&metric
//   GET /export/commands?format&from&to&node_id
//   GET /export/audit?format&from&to&event&search
//   GET /export/discover
// ============================================================================

import { request } from './client';

const unwrap = (p) => p.then((r) => (typeof r === 'string' ? r : (r && r.data !== undefined ? r.data : r)));

function qs(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export const exportApi = {
  listTelemetry: (params) => unwrap(request(`/export/v1/telemetry${qs(params)}`, { auth: true })),
  listTelemetryAggregate: (params) => unwrap(request(`/export/v1/telemetry/aggregate${qs(params)}`, { auth: true })),
  listNodes: (params) => unwrap(request(`/export/v1/nodes${qs(params)}`, { auth: true })),
  listAlerts: (params) => unwrap(request(`/export/v1/alerts${qs(params)}`, { auth: true })),
  listCommands: (params) => unwrap(request(`/export/v1/commands${qs(params)}`, { auth: true })),
  listAudit: (params) => unwrap(request(`/export/v1/audit${qs(params)}`, { auth: true })),
  discover: () => unwrap(request(`/export/v1/discover`, { auth: true })),
};

export default exportApi;
