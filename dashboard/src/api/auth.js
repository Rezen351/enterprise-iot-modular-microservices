// ============================================================================
// AUTH API — real calls to the Auth Service via Kong Gateway
// ----------------------------------------------------------------------------
// Endpoints (Kong → auth-service):
//   POST /auth/register   POST /auth/login   POST /auth/refresh
//   GET  /auth/me         PUT  /auth/me      PUT  /auth/password
//   GET  /auth/sessions   POST /auth/logout  DELETE /auth/account
// ============================================================================
// The Auth Service returns the standard envelope { success, data, error }
// (AGENTS.md §4.4). `unwrap` peels the `data` payload so the rest of the
// dashboard keeps consuming the raw object (no page changes required).

import { request, setSession, clearSession, getRefreshToken, registerRefresh } from './client';

const unwrap = (p) => p.then((r) => (r && r.data !== undefined ? r.data : r));

export const authApi = {
  // Register a new account (backend assigns the "viewer" role by default).
  register: ({ username, email, password }) =>
    unwrap(request('/auth/register', { method: 'POST', body: { username, email, password } })),

  // Login with email OR username + password, then load the profile.
  signIn: async ({ identifier, password }) => {
    const pair = await unwrap(request('/auth/login', { method: 'POST', body: { identifier, password } }));
    setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
    const user = await unwrap(request('/auth/me', { auth: true }));
    setSession({ user });
    return { token: pair.access_token, user };
  },

  // Current profile
  me: () => unwrap(request('/auth/me', { auth: true })),

  // Update username/email
  updateProfile: (body) => unwrap(request('/auth/me', { method: 'PUT', auth: true, body })),

  // Change password (revokes all sessions server-side)
  changePassword: ({ current_password, new_password }) =>
    unwrap(request('/auth/password', { method: 'PUT', auth: true, body: { current_password, new_password } })),

  // Active sessions (refresh tokens)
  getSessions: () => unwrap(request('/auth/sessions', { auth: true })),

  // Soft-delete / deactivate account
  deleteAccount: (password) =>
    unwrap(request('/auth/account', { method: 'DELETE', auth: true, body: { password } })),

  // Rotate the access token using the stored refresh token
  refresh: async () => {
    const pair = await unwrap(request('/auth/refresh', { method: 'POST', body: { refresh_token: getRefreshToken() } }));
    setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
    return pair;
  },

  // Logout — revoke all tokens then clear local session. `quiet` agar 504
  // dari backend saat logout tidak memicu toast "backend down".
  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST', auth: true, quiet: true });
    } catch {
      /* ignore network/expiry errors on logout */
    } finally {
      clearSession();
    }
  },

  // ─── Admin: user management (require "admin" role) ──────────────────────
  adminListUsers: () => unwrap(request('/auth/users', { method: 'GET', auth: true })),
  adminListRoles: () => unwrap(request('/auth/roles', { method: 'GET', auth: true })),
  adminUpdateUser: (id, body) =>
    unwrap(request(`/auth/users/${id}`, { method: 'PUT', auth: true, body })),
  adminDeleteUser: (id) =>
    unwrap(request(`/auth/users/${id}`, { method: 'DELETE', auth: true })),
};

// Daftarkan fungsi refresh ke client agar token otomatis diperbarui saat 401.
registerRefresh(async () => {
  const refresh_token = getRefreshToken();
  if (!refresh_token) throw new Error('no refresh token');
  const pair = await unwrap(request('/auth/refresh', { method: 'POST', body: { refresh_token } }));
  setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
  return pair;
});

export default authApi;
