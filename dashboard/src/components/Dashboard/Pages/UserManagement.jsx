// ============================================================================
// User Management — admin-only page
// ----------------------------------------------------------------------------
// Allows an admin to:
//   • view all accounts
//   • activate / deactivate accounts
//   • change a user's roles (e.g. viewer ↔ operator <-> admin)
//   • delete accounts
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { authApi } from '../../../api/auth';

const ACTIVE_LABEL = { true: 'Aktif', false: 'Nonaktif' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [editing, setEditing] = useState(null); // { id, roles:Set, isActive }

  const me = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [u, r] = await Promise.all([authApi.adminListUsers(), authApi.adminListRoles()]);
      setUsers(u.users || []);
      setRoles(r.roles || []);
    } catch (e) {
      setError(e.message || 'Gagal memuat data user');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEditor(user) {
    setEditing({
      id: user.id,
      isActive: user.is_active,
      roles: new Set(user.roles || []),
    });
  }

  function toggleRole(name) {
    if (!editing) return;
    const next = new Set(editing.roles);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setEditing({ ...editing, roles: next });
  }

  async function saveEditor() {
    const target = users.find((u) => u.id === editing.id);
    const body = {};
    if (editing.isActive !== target.is_active) body.is_active = editing.isActive;
    const current = new Set(target.roles || []);
    const changed =
      editing.roles.size !== current.size || [...editing.roles].some((r) => !current.has(r));
    if (changed) body.roles = [...editing.roles];
    if (Object.keys(body).length === 0) {
      setEditing(null);
      return;
    }
    setBusyId(editing.id);
    setError('');
    try {
      await authApi.adminUpdateUser(editing.id, body);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message || 'Gagal memperbarui user');
    } finally {
      setBusyId('');
    }
  }

  async function toggleActive(user) {
    setBusyId(user.id);
    setError('');
    try {
      await authApi.adminUpdateUser(user.id, { is_active: !user.is_active });
      await load();
    } catch (e) {
      setError(e.message || 'Gagal mengubah status user');
    } finally {
      setBusyId('');
    }
  }

  async function remove(user) {
    if (!window.confirm(`Hapus akun "${user.username}"? Tindakan ini tidak dapat dibatalkan.`))
      return;
    setBusyId(user.id);
    setError('');
    try {
      await authApi.adminDeleteUser(user.id);
      await load();
    } catch (e) {
      setError(e.message || 'Gagal menghapus user');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page-users">
      <div className="page-header">
        <h1>Account Management</h1>
        <p className="muted">
          Manage users: activate, assign roles, delete.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Memuat data akun…</div>
      ) : (
        <div className="table-card">
          <table className="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'row-inactive'}>
                  <td>
                    {u.username}
                    {me && u.id === me.id && <span className="badge-self">you</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {(u.roles || []).map((r) => (
                      <span key={r} className={`role-chip role-${r}`}>
                        {r}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span className={`status-dot ${u.is_active ? 'on' : 'off'}`} />
                    {ACTIVE_LABEL[u.is_active]}
                  </td>
                  <td className="actions">
                    <button
                      className="btn btn-sm"
                      disabled={busyId === u.id}
                      onClick={() => toggleActive(u)}
                    >
                      {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      disabled={busyId === u.id}
                      onClick={() => openEditor(u)}
                    >
                      Ubah Peran
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={busyId === u.id}
                      onClick={() => remove(u)}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Role & Status</h3>
            <p className="muted">Select role for this account.</p>
            <div className="role-options">
              {roles.map((r) => (
                <label key={r.id} className="role-option">
                  <input
                    type="checkbox"
                    checked={editing.roles.has(r.name)}
                    onChange={() => toggleRole(r.name)}
                  />
                  <span>
                    <strong>{r.name}</strong>
                    {r.description ? <em> — {r.description}</em> : null}
                  </span>
                </label>
              ))}
            </div>
            <label className="role-option mt">
              <input
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              />
              <span>Active (checked = on)</span>
            </label>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="btn"
                disabled={busyId === editing.id}
                onClick={saveEditor}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
