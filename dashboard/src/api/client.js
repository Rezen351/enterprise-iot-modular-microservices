// ============================================================================
// API CLIENT — talks to the Kong API Gateway (single entry point)
// ----------------------------------------------------------------------------
// All dashboard requests go through Kong (default http://localhost:8000), which
// routes /auth/* to the Auth Service. Override with VITE_API_URL if needed.
// ============================================================================

const ENV_API_BASE = import.meta.env?.VITE_API_URL;
export const API_BASE =
  ENV_API_BASE !== undefined ? ENV_API_BASE : 'http://localhost:8000';

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
         onUnauthorized();
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

// ---- Global unauth handler (redirect ke logout saat sesi invalid) --------
let onUnauthorized = () => {};

// Dipanggil dari App agar client bisa me-reset sesi & redirect saat 401
// tidak bisa di-refresh (token expired/invalid).
export function registerUnauthorized(fn) {
  onUnauthorized = fn;
}

// ---- Global server-error handler (5xx / network down) ---------------------
// Berbeda dengan onUnauthorized: ini BUKAN sesi invalid, jadi tidak boleh
// memicu logout. Dipakai agar UI bisa menampilkan toast "backend down".
let onServerError = () => {};
let lastServerErrorAt = 0;

export function registerServerError(fn) {
  onServerError = fn;
}

// Beri tahu UI soal error server, di-throttle 5 detik agar tidak spam.
function notifyServerError(msg) {
  const now = Date.now();
  if (now - lastServerErrorAt < 5000) return;
  lastServerErrorAt = now;
  onServerError(msg);
}

export async function request(path, { method = 'GET', body, auth = false, headers = {}, quiet = false } = {}, _isRetry = false) {
  const finalHeaders = { 'Content-Type': 'application/json', ...headers };
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (netErr) {
    // Network failure (server down, 504 dari gateway, CORS, dll). Ini BUKAN
    // sesi invalid → jangan logout. Beri tahu UI lewat onServerError.
    const err = new Error('Unable to reach server');
    err.status = 0;
    err.type = 'network';
    err.cause = netErr;
    if (!quiet) notifyServerError(err.message);
    throw err;
  }

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
        return request(path, { method, body, auth, headers, quiet }, true);
      }
    }

    // Klasifikasi error agar UI tahu apa yang terjadi.
    if (res.status >= 500 && !quiet) {
      notifyServerError(data?.error || data?.message || `Server error (${res.status})`);
    }

    const message =
    (data?.error && typeof data.error === 'object'
      ? data.error.message
      : data?.error) ||
    data?.message ||
    `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.type = res.status === 401 ? 'unauthorized' : res.status >= 500 ? 'server' : 'client';
    err.data = data;
    throw err;
  }

  return data;
}
