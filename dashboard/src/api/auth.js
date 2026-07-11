// ============================================================================
// AUTH API — real calls to the Auth Service via Kong Gateway
// ----------------------------------------------------------------------------
// Endpoints (Kong → auth-service):
//   POST /auth/register   POST /auth/login   POST /auth/refresh
//   GET  /auth/me         PUT  /auth/me      PUT  /auth/password
//   GET  /auth/sessions   POST /auth/logout  DELETE /auth/account
// ============================================================================

import { request, setSession, clearSession, getRefreshToken, registerRefresh } from './client';

export const authApi = {
  // Register a new account (backend assigns the "viewer" role by default).
  register: ({ username, email, password }) =>
    request('/auth/register', { method: 'POST', body: { username, email, password } }),

  // Login with email OR username + password, then load the profile.
  signIn: async ({ identifier, password }) => {
    const pair = await request('/auth/login', { method: 'POST', body: { identifier, password } });
    setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
    const user = await request('/auth/me', { auth: true });
    setSession({ user });
    return { token: pair.access_token, user };
  },

  // Current profile
  me: () => request('/auth/me', { auth: true }),

  // Update username/email
  updateProfile: (body) => request('/auth/me', { method: 'PUT', auth: true, body }),

  // Change password (revokes all sessions server-side)
  changePassword: ({ current_password, new_password }) =>
    request('/auth/password', { method: 'PUT', auth: true, body: { current_password, new_password } }),

  // Active sessions (refresh tokens)
  getSessions: () => request('/auth/sessions', { auth: true }),

  // Soft-delete / deactivate account
  deleteAccount: (password) =>
    request('/auth/account', { method: 'DELETE', auth: true, body: { password } }),

  // Rotate the access token using the stored refresh token
  refresh: async () => {
    const refresh_token = getRefreshToken();
    const pair = await request('/auth/refresh', { method: 'POST', body: { refresh_token } });
    setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
    return pair;
  },

  // Logout — revoke all tokens then clear local session
  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST', auth: true });
    } catch {
      /* ignore network/expiry errors on logout */
    } finally {
      clearSession();
    }
  },

  // ─── Admin: user management (require "admin" role) ──────────────────────
  adminListUsers: () => request('/auth/users', { method: 'GET', auth: true }),
  adminListRoles: () => request('/auth/roles', { method: 'GET', auth: true }),
  adminUpdateUser: (id, body) =>
    request(`/auth/users/${id}`, { method: 'PUT', auth: true, body }),
  adminDeleteUser: (id) =>
    request(`/auth/users/${id}`, { method: 'DELETE', auth: true }),
};

// Daftarkan fungsi refresh ke client agar token otomatis diperbarui saat 401.
registerRefresh(async () => {
  const refresh_token = getRefreshToken();
  if (!refresh_token) throw new Error('no refresh token');
  const pair = await request('/auth/refresh', {
    method: 'POST',
    body: { refresh_token },
  });
  setSession({ access_token: pair.access_token, refresh_token: pair.refresh_token });
  return pair;
});

export default authApi;
