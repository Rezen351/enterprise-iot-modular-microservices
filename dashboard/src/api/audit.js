import { request } from './client';

// Audit Service — append-only audit log API (consumes `audit.log` from NATS).
// All roles (viewer/operator/admin) may read; the log is immutable (no writes).

export async function listAuditLogs({ limit = 50, offset = 0, event = '', search = '' } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (event) params.set('event', event);
  if (search) params.set('search', search);
  return request(`/audit/logs?${params.toString()}`, { auth: true });
}
