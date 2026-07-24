// ============================================================================
// WEBHOOK API — webhook settings, logs, and delivery test via Kong
// ----------------------------------------------------------------------------
// Endpoints (Kong → webhook-service):
//   GET /webhook/settings      → current webhook channel config (admin)
//   PUT /webhook/settings      → update channel config (admin)
//   GET /webhook/logs          → delivery log history (admin)
//   POST /webhook/test         → enqueue test delivery (admin)
//   POST /webhook/receive/*    → inbound webhook receivers (admin)
// ============================================================================

import { request } from './client';

const unwrap = (p) => p.then((r) => (r && r.data !== undefined ? r.data : r));

function qs(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export const webhookApi = {
  getSettings: () => unwrap(request(`/webhook/settings`, { auth: true })),
  updateSettings: (body) => unwrap(request(`/webhook/settings`, { method: 'PUT', auth: true, body })),
  listLogs: (params) => unwrap(request(`/webhook/logs${qs(params)}`, { auth: true })),
  testDelivery: (body) => unwrap(request(`/webhook/test`, { method: 'POST', auth: true, body })),
};

export default webhookApi;
