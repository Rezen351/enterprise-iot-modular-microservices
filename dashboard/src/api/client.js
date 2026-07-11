// ============================================================================
// API CLIENT — talks to the Kong API Gateway (single entry point)
// ----------------------------------------------------------------------------
// All dashboard requests go through Kong (default http://localhost:8000), which
// routes /auth/* to the Auth Service. Override with VITE_API_URL if needed.
// ============================================================================

export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000';

// ---- Session helpers ------------------------------------------------------
export const getToken = () => sessionStorage.getItem('token');
export const getRefreshToken = () => sessionStorage.getItem('refresh_token');

export function setSession({ access_token, refresh_token, user }) {
  if (access_token) sessionStorage.setItem('token', access_token);
  if (refresh_token) sessionStorage.setItem('refresh_token', refresh_token);
  if (user) sessionStorage.setItem('user', JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refresh_token');
  sessionStorage.removeItem('user');
}

// ---- Auto token refresh on 401 (deduplicated) -----------------------------
let refreshInFlight = null;

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        await authApiRefresh();
        return true;
      } catch {
        clearSession();
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

// authApi.refresh dipisah agar tidak circular: mengembalikan promise
let authApiRefresh = async () => {
  throw new Error('refresh not initialized');
};

// Dipanggil sekali dari auth.js agar client tahu cara me-refresh token
export function registerRefresh(fn) {
  authApiRefresh = fn;
}

export async function request(path, { method = 'GET', body, auth = false, headers = {} } = {}, _isRetry = false) {
  const finalHeaders = { 'Content-Type': 'application/json', ...headers };
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const raw = await res.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }
  }

  if (!res.ok) {
    // Coba refresh token sekali bila expired/invalid, lalu ulangi request.
    if (res.status === 401 && auth && !_isRetry) {
      const ok = await refreshAccessToken();
      if (ok) {
        return request(path, { method, body, auth, headers }, true);
      }
    }
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
