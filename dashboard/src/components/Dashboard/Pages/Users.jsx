import { useState, useEffect, useCallback } from 'react';
import { User as UserIcon, CheckCircle2, AlertTriangle, ShieldCheck, Monitor, Trash2, Loader2 } from 'lucide-react';
import PageHeader from './PageHeader';
import PasswordUpdateCard from './Users/PasswordUpdateCard';
import { authApi } from '../../../api/auth';

const EMPTY_PROFILE = { id: '', username: '', email: '', roles: [], created_at: '', last_login_at: '' };

function fmt(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function Profile({ onLogout }) {
  // ── Profile state ──────────────────────────────────────────────
  const [profile, setProfile] = useState(() => {
    const saved = sessionStorage.getItem('user');
    try {
      return saved ? { ...EMPTY_PROFILE, ...JSON.parse(saved) } : EMPTY_PROFILE;
    } catch {
      return EMPTY_PROFILE;
    }
  });
  const [form, setForm] = useState({ username: profile.username || '', email: profile.email || '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // ── Password state ─────────────────────────────────────────────
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState('');

  // ── Sessions ───────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // ── Delete account ─────────────────────────────────────────────
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Load fresh profile + sessions from the Auth Service.
  const loadProfile = useCallback(async () => {
    try {
      const me = await authApi.me();
      setProfile((p) => ({ ...p, ...me }));
      setForm({ username: me.username || '', email: me.email || '' });
      sessionStorage.setItem('user', JSON.stringify(me));
    } catch (err) {
      console.warn('Profile: failed to load /auth/me', err);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await authApi.getSessions();
      setSessions(res?.sessions || []);
    } catch (err) {
      console.warn('Profile: failed to load sessions', err);
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadSessions();
  }, [loadProfile, loadSessions]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setSaveSuccess(false);
    setIsSavingProfile(true);
    try {
      const updated = await authApi.updateProfile({ username: form.username, email: form.email });
      setProfile((p) => ({ ...p, ...updated }));
      sessionStorage.setItem('user', JSON.stringify(updated));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess(false);

    if (passwords.new !== passwords.confirm) {
      setPassError('New password confirmation does not match.');
      return;
    }
    if (passwords.new.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      return;
    }

    setIsChangingPass(true);
    try {
      await authApi.changePassword({ current_password: passwords.current, new_password: passwords.new });
      setPassSuccess(true);
      setPasswords({ current: '', new: '', confirm: '' });
      // Backend revokes all sessions — force re-login shortly.
      setTimeout(() => onLogout && onLogout(), 1800);
    } catch (err) {
      setPassError(err.message || 'Failed to change password');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm.');
      return;
    }
    if (!window.confirm('This will deactivate your account. Continue?')) return;
    setIsDeleting(true);
    try {
      await authApi.deleteAccount(deletePassword);
      onLogout && onLogout();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  const role = (profile.roles && profile.roles[0]) || '—';

  return (
    <div className="flex flex-col gap-3 w-full animate-fadeIn">
      <PageHeader icon={UserIcon} title="Account" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left column: Profile + Password */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Profile card */}
          <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md  p-3 sm:p-6 ">
            <h3 className="text-xs sm:text-sm font-black font-display text-white tracking-widest uppercase border-b border-emerald-500/10 pb-3 mb-4 sm:pb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
              <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              Profile
            </h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Unique User ID</label>
                <input type="text" value={profile.id || ''} disabled
                  className="w-full bg-[#040e0a]/60 border border-emerald-500/5 text-slate-500 text-sm h-10 sm:h-11 lg:h-12 px-3 sm:px-4 font-mono focus:outline-none cursor-not-allowed" />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Display Username</label>
                <input type="text" value={form.username} required
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full bg-[#040e0a] border border-emerald-500/20 hover:border-emerald-500/40 text-slate-200 text-sm h-10 sm:h-11 lg:h-12 px-3 sm:px-4 focus:outline-none focus:border-emerald-500/60 font-black" />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2">Primary Email Address</label>
                <input type="email" value={form.email} required
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-[#040e0a] border border-emerald-500/20 hover:border-emerald-500/40 text-slate-200 text-sm h-12 sm:h-14 px-4 sm:px-5  focus:outline-none focus:border-emerald-500/60 font-bold " />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2">Access Role</label>
                <div className="w-full bg-[#040e0a]/60 border border-emerald-500/10 text-emerald-400 text-sm h-12 sm:h-14 px-4 sm:px-5  flex items-center font-black uppercase tracking-widest ">
                  {role}
                </div>
              </div>

              <div className="text-[10px] sm:text-[11px] font-black text-slate-500 space-y-1.5 pt-2 sm:pt-3 border-t border-emerald-500/5">
                <div className="flex justify-between uppercase"><span>Created:</span> <span className="text-slate-400 tabular-nums">{fmt(profile.created_at)}</span></div>
                <div className="flex justify-between uppercase"><span>Last Login:</span> <span className="text-slate-400 tabular-nums">{fmt(profile.last_login_at)}</span></div>
              </div>

              {profileError && (
                <div className="text-xs font-bold text-red-400 flex items-center gap-1.5 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 shrink-0" /><span className="break-all">{profileError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={isSavingProfile}
                  className="h-10 sm:h-11 lg:h-12 px-4 sm:px-6 text-xs sm:text-sm font-black text-black bg-emerald-500 hover:bg-emerald-400 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] uppercase tracking-widest">
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
                {saveSuccess && (
                  <span className="text-sm font-black text-emerald-400 flex items-center gap-2 animate-fadeIn uppercase tracking-wide">
                    <CheckCircle2 className="w-5 h-5" /> Saved
                  </span>
                )}
              </div>
            </form>
          </div>

          <PasswordUpdateCard
            passwords={passwords}
            setPasswords={setPasswords}
            handlePasswordChange={handlePasswordChange}
            isChangingPass={isChangingPass}
            passError={passError}
            passSuccess={passSuccess}
          />
        </div>

        {/* Right column: Sessions + Danger zone */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Active Sessions */}
          <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md  p-3 sm:p-6 ">
            <h3 className="text-xs sm:text-sm font-black font-display text-white tracking-widest uppercase border-b border-emerald-500/10 pb-3 mb-3 sm:pb-4 sm:mb-5 flex items-center gap-2 sm:gap-3">
              <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              Sessions
            </h3>

            {loadingSessions ? (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider py-4 sm:py-6 text-center">No active sessions</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {sessions.map((s) => (
                  <div key={s.id} className="p-2.5 sm:p-3 border border-emerald-500/10 bg-[#040e0a]/60">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                      <span className="text-[11px] sm:text-xs font-bold text-slate-300 truncate">{s.user_agent || 'Unknown device'}</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex flex-wrap gap-x-3 gap-y-1">
                      <span>IP: <span className="text-slate-400">{s.ip_address || '—'}</span></span>
                      <span>Issued: <span className="text-slate-400">{fmt(s.issued_at)}</span></span>
                      <span>Expires: <span className="text-slate-400">{fmt(s.expires_at)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="border border-red-500/20 bg-red-950/10 backdrop-blur-md  p-3 sm:p-6 ">
            <h3 className="text-xs sm:text-sm font-black font-display text-red-400 tracking-widest uppercase border-b border-red-500/10 pb-3 mb-3 sm:pb-4 sm:mb-5 flex items-center gap-2 sm:gap-3">
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              Delete Account
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mb-3 sm:mb-4 leading-relaxed">
              Deactivating revokes all sessions. This cannot be undone.
            </p>
            <form onSubmit={handleDeleteAccount} className="space-y-3 sm:space-y-4">
              <input type="password" value={deletePassword} placeholder="Confirm password"
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full bg-[#040e0a] border border-red-500/20 hover:border-red-500/40 text-slate-200 text-sm h-10 sm:h-11 px-3 sm:px-4 focus:outline-none focus:border-red-500/60 font-mono" />
              {deleteError && (
                <div className="text-[10px] sm:text-[11px] font-bold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /><span>{deleteError}</span>
                </div>
              )}
              <button type="submit" disabled={isDeleting}
                className="w-full sm:w-auto h-10 sm:h-11 px-4 sm:px-5 text-[10px] sm:text-xs font-bold text-red-300 hover:text-white border border-red-500/30 hover:border-red-500/60 bg-red-950/20 hover:bg-red-900/30  transition-all cursor-pointer disabled:opacity-40 active:scale-[0.98] uppercase tracking-wider">
                {isDeleting ? 'Deactivating...' : 'Deactivate Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
