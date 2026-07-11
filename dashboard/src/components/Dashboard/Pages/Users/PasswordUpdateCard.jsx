import { Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';

function PasswordUpdateCard({ 
  passwords, 
  setPasswords, 
  handlePasswordChange, 
  isChangingPass, 
  passError, 
  passSuccess 
}) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4">
      <h3 className="text-xs font-bold font-display text-white tracking-wider uppercase border-b border-emerald-500/10 pb-4 mb-5 flex items-center gap-2.5">
        <Lock className="w-5 h-5 text-emerald-400" />
        Password
      </h3>

      <form onSubmit={handlePasswordChange} className="space-y-5">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Current</label>
          <input 
            type="password"
            value={passwords.current}
            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
            required
            placeholder="••••••••"
            className="w-full bg-[#040e0a] border border-emerald-500/20 hover:border-emerald-500/40 text-slate-200 text-sm h-10 sm:h-12 px-4 focus:outline-none focus:border-emerald-500/60 font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">New</label>
          <input 
            type="password"
            value={passwords.new}
            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
            required
            placeholder="••••••••"
            className="w-full bg-[#040e0a] border border-emerald-500/20 hover:border-emerald-500/40 text-slate-200 text-sm h-10 sm:h-12 px-4 focus:outline-none focus:border-emerald-500/60 font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm</label>
          <input 
            type="password"
            value={passwords.confirm}
            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            required
            placeholder="••••••••"
            className="w-full bg-[#040e0a] border border-emerald-500/20 hover:border-emerald-500/40 text-slate-200 text-sm h-10 sm:h-12 px-4 focus:outline-none focus:border-emerald-500/60 font-mono"
          />
        </div>

        {passError && (
          <div className="text-[11px] font-bold text-red-400 flex items-center gap-1.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{passError}</span>
          </div>
        )}

        <div className="flex items-center gap-4 pt-3">
          <button
            type="submit"
            disabled={isChangingPass}
            className="h-10 sm:h-12 px-4 sm:px-6 text-xs sm:text-sm font-bold text-slate-300 hover:text-white border border-emerald-500/15 hover:border-emerald-500/35 bg-emerald-950/5 hover:bg-emerald-950/20 transition-all duration-200 cursor-pointer disabled:opacity-40 active:scale-[0.98]"
          >
            {isChangingPass ? 'Processing...' : 'Change Password'}
          </button>
          {passSuccess && (
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              Password updated.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export default PasswordUpdateCard;
