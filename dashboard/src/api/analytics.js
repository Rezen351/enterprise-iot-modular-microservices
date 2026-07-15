// ============================================================================
// ANALYTICS API — aggregated telemetry from the Analytics Service via Kong
// ----------------------------------------------------------------------------
// Endpoints (Kong → analytics-service):
//   GET /analytics/nodes             → nodes with telemetry + available metrics
//   GET /analytics/metrics?node_id&metric&interval&from&to
//   GET /analytics/summary?node_id&metric&from&to
// ============================================================================
// The Analytics Service returns the standard envelope { success, data, error }
// (AGENTS.md §4.4). `unwrap` peels `data` so pages keep using the raw
// object without changes.

import { request } from './client';

const unwrap = (p) => p.then((r) => (r && r.data !== undefined ? r.data : r));

function qs(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export const analyticsApi = {
  listNodes: () => unwrap(request(`/analytics/nodes`, { auth: true })),
  getMetrics: (params) => unwrap(request(`/analytics/metrics${qs(params)}`, { auth: true })),
  getSummary: (params) => unwrap(request(`/analytics/summary${qs(params)}`, { auth: true })),
};

export default analyticsApi;
