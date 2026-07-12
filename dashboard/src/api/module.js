// ============================================================================
// MODULE API — real calls to the Module Service via Kong Gateway
// ----------------------------------------------------------------------------
// Endpoints (Kong → module-service):
//   Modules: GET/POST /modules   GET/PUT/DELETE /modules/{id}
//   Nodes:   GET /nodes   GET /nodes/discovered   GET /nodes/{node_id}
//            POST /nodes/{node_id}/pair   POST /nodes/{node_id}/unpair
//            DELETE /nodes/{node_id}
// ----------------------------------------------------------------------------
// Onboarding flow: firmware auto-broadcasts `discovery` → nodes appear in
// /nodes/discovered (unpaired) → user pairs a node into a module.
// ============================================================================

import { request } from './client';

function qs(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export const moduleApi = {
  // ─── Modules ──────────────────────────────────────────────────────────
  listModules: () => request('/modules', { auth: true }),
  getModule: (id) => request(`/modules/${id}`, { auth: true }),
  createModule: ({ name, description, config }) =>
    request('/modules', { method: 'POST', auth: true, body: { name, description, config } }),
  updateModule: (id, body) => request(`/modules/${id}`, { method: 'PUT', auth: true, body }),
  deleteModule: (id) => request(`/modules/${id}`, { method: 'DELETE', auth: true }),

  // ─── Nodes (onboarding) ───────────────────────────────────────────────
  // params: { paired: true|false, module_id, status }
  listNodes: (params) => request(`/nodes${qs(params)}`, { auth: true }),
  listDiscovered: () => request('/nodes/discovered', { auth: true }),
  getNode: (nodeId) => request(`/nodes/${nodeId}`, { auth: true }),
  getNodeTags: (nodeId) => request(`/nodes/${nodeId}/tags`, { auth: true }),
  saveNodeTags: (nodeId, tags) =>
    request(`/nodes/${nodeId}/tags`, { method: 'PUT', auth: true, body: tags }),
  // Actuator tags — separate from sensor telemetry tags. The user maps a
  // firmware output (chosen from a node's discovered outputs) to a friendly
  // control tag; these drive the Control page.
  getActuatorTags: (nodeId) => request(`/nodes/${nodeId}/actuators`, { auth: true }),
  createActuatorTag: (nodeId, body) =>
    request(`/nodes/${nodeId}/actuators`, { method: 'POST', auth: true, body }),
  deleteActuatorTag: (nodeId, id) =>
    request(`/nodes/${nodeId}/actuators/${id}`, { method: 'DELETE', auth: true }),
  pairNode: (nodeId, { module_id, name }) =>
    request(`/nodes/${nodeId}/pair`, { method: 'POST', auth: true, body: { module_id, name } }),
  unpairNode: (nodeId) => request(`/nodes/${nodeId}/unpair`, { method: 'POST', auth: true }),
  deleteNode: (nodeId) => request(`/nodes/${nodeId}`, { method: 'DELETE', auth: true }),
};

export default moduleApi;
