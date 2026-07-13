// ============================================================================
// ML Results API — read-only listing of captures collected by the external
// CCTV capture cron (stored in the `ml-result` MinIO bucket).
//   List: GET /ml/results?prefix=frames|annotated|results
// ============================================================================

import { request } from './client';

export const mlApi = {
  listResults: (prefix = 'frames', limit = 200) =>
    request(`/ml/results?prefix=${encodeURIComponent(prefix)}&limit=${encodeURIComponent(limit)}`, { auth: true }),
  deleteResult: (key) =>
    request(`/ml/results?key=${encodeURIComponent(key)}`, { method: 'DELETE', auth: true }),
};

export default mlApi;
