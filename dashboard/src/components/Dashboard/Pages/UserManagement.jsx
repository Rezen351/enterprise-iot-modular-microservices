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
import { Users as UsersIcon, UserPlus, ShieldCheck, Trash2, Edit3, X, Check } from 'lucide-react';

const ACTIVE_LABEL = { true: 'Active', false: 'Inactive' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [editing, setEditing] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [addError, setAddError] = useState('');

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
      setError(e.message || 'Failed to load users');
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
      setError(e.message || 'Failed to update user');
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
      setError(e.message || 'Failed to toggle status');
    } finally {
      setBusyId('');
    }
  }

  async function remove(user) {
    if (!window.confirm(`Delete "${user.username}"? This cannot be undone.`))
      return;
    setBusyId(user.id);
    setError('');
    try {
      await authApi.adminDeleteUser(user.id);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to delete user');
    } finally {
      setBusyId('');
    }
  }

  async function handleAddUser(e) {
    e.preventDefault();
    setAddError('');
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim() || !newRoleId) {
      setAddError('All fields are required');
      return;
    }
    setBusyId('new');
    try {
      await authApi.register({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role_id: newRoleId,
      });
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRoleId('');
      setShowAddForm(false);
      await load();
    } catch (e) {
      setAddError(e.message || 'Failed to create user');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full animate-fadeIn">
      {/* Header */}
      <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 w-full min-w-0">
          <div className="p-2 sm:p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-sm font-black font-display text-white tracking-widest uppercase truncate">Account Management</h2>
            <p className="hidden sm:block text-[11px] text-slate-400 mt-0.5">Manage users, roles, and access.</p>
          </div>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors uppercase tracking-wider cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">New Account</h3>
            <button onClick={() => { setShowAddForm(false); setAddError(''); }} className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          {addError && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> {addError}
            </div>
          )}
          <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full bg-[#040e0a] border border-emerald-500/20 text-slate-200 text-sm h-10 px-3 focus:outline-none focus:border-emerald-500" placeholder="username" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full bg-[#040e0a] border border-emerald-500/20 text-slate-200 text-sm h-10 px-3 focus:outline-none focus:border-emerald-500" placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-[#040e0a] border border-emerald-500/20 text-slate-200 text-sm h-10 px-3 focus:outline-none focus:border-emerald-500 font-mono" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
              <select value={newRoleId} onChange={e => setNewRoleId(e.target.value)} className="w-full bg-[#040e0a] border border-emerald-500/20 text-slate-200 text-sm h-10 px-3 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => { setShowAddForm(false); setAddError(''); }} className="h-10 px-4 text-xs font-bold text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500 transition-colors cursor-pointer uppercase tracking-wider">
                Cancel
              </button>
              <button type="submit" disabled={busyId === 'new'} className="h-10 px-4 text-xs font-bold text-black bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 transition-colors cursor-pointer uppercase tracking-wider">
                {busyId === 'new' ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-500/30 bg-red-950/15 text-red-400 p-3 flex items-center gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="border border-emerald-500/10 bg-[#030705]/80 p-6 flex items-center justify-center gap-3 text-emerald-400">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-black uppercase tracking-widest">Loading...</span>
        </div>
      ) : (
        /* Table Card */
        <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="pb-3 px-3 sm:px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Username</th>
                  <th className="pb-3 px-3 sm:px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Email</th>
                  <th className="pb-3 px-3 sm:px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Roles</th>
                  <th className="pb-3 px-3 sm:px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                  <th className="pb-3 px-3 sm:px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500 text-xs">No users found</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className={`border-b border-white/5 last:border-0 ${!u.is_active ? 'opacity-50' : ''}`}>
                      <td className="py-3 px-3 sm:px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{u.username}</span>
                          {me && u.id === me.id && <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5">You</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <span className="text-xs text-slate-400">{u.email}</span>
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles || []).map((r) => (
                            <span key={r} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border ${
                              r === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                              r === 'operator' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                              'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}>
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <button onClick={() => toggleActive(u)} disabled={busyId === u.id} className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-1 border transition-colors cursor-pointer disabled:opacity-40 ${
                          u.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          {ACTIVE_LABEL[u.is_active]}
                        </button>
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditor(u)}
                            disabled={busyId === u.id}
                            className="p-2 bg-slate-800 border border-slate-700 hover:border-emerald-500/50 hover:text-emerald-400 text-slate-400 transition-colors cursor-pointer disabled:opacity-40"
                            title="Edit roles"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => remove(u)}
                            disabled={busyId === u.id}
                            className="p-2 bg-slate-800 border border-slate-700 hover:border-red-500/50 hover:text-red-400 text-slate-400 transition-colors cursor-pointer disabled:opacity-40"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md border border-emerald-500/20 bg-[#030705] p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Edit Account</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && (
              <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> {error}
              </div>
            )}
            <div className="space-y-3 mb-4">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-3 p-3 border border-emerald-500/10 bg-emerald-500/5 cursor-pointer hover:border-emerald-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={editing.roles.has(r.name)}
                    onChange={() => toggleRole(r.name)}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span className="block text-sm font-bold text-white">{r.name}</span>
                    {r.description && <span className="text-[10px] text-slate-400">{r.description}</span>}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3 p-3 border border-emerald-500/10 bg-emerald-500/5 mb-4">
              <input
                type="checkbox"
                id="edit-active"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                className="accent-emerald-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="edit-active" className="text-xs font-bold text-slate-300 cursor-pointer select-none">
                Active account
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="h-10 px-4 text-xs font-bold text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500 transition-colors cursor-pointer uppercase tracking-wider">
                Cancel
              </button>
              <button
                onClick={saveEditor}
                disabled={busyId === editing.id}
                className="h-10 px-4 text-xs font-bold text-black bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 transition-colors cursor-pointer uppercase tracking-wider flex items-center gap-2"
              >
                {busyId === editing.id ? 'Saving...' : <><Check className="w-4 h-4" /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
