// ============================================================================
// ML Results API — read-only listing of captures collected by the external
// CCTV capture cron (stored in the `mlbucket` MinIO bucket).
//   List: GET /ml/results?prefix=frames|annotated|results
// ============================================================================

import { request } from './client';

// The ML Service returns the standardized response wrapper { success, data }.
// Unwrap `data` so callers get the inner payload directly.
const unwrap = async (path, opts) => {
  const res = await request(path, opts);
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

export const mlApi = {
  listResults: (prefix = 'frames', limit = 200) =>
    unwrap(`/ml/results?prefix=${encodeURIComponent(prefix)}&limit=${encodeURIComponent(limit)}`, { auth: true }),
  deleteResult: (key) =>
    unwrap(`/ml/results?key=${encodeURIComponent(key)}`, { method: 'DELETE', auth: true }),
};

export default mlApi;
