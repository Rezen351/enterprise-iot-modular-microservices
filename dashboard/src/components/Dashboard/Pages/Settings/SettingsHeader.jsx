import { SlidersHorizontal, RotateCcw, Save, CheckCircle2 } from 'lucide-react';
import ModuleBadge from '../../ModuleBadge';
import ToggleSwitch from '../../ToggleSwitch';

function SettingsHeader({ autoMode, setAutoMode, isSaving, handleSave, saveSuccess, selectedModule, handleReset }) {
  return (
    <>
      <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full xl:w-auto xl:flex-1 min-w-0">
          <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <SlidersHorizontal className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-wide uppercase truncate">
              Configuration
            </h2>
            <p className="hidden sm:block text-slate-400 text-xs sm:text-sm mt-1 font-medium truncate sm:whitespace-normal">
              Actuator cycles, setpoints, schedules, and sensors.
            </p>
            {selectedModule && <ModuleBadge selectedModule={selectedModule} className="mt-2.5" />}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full xl:w-auto shrink-0">
          {/* Auto Mode Control */}
          <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-5 px-4 sm:px-6 h-11 sm:h-12 w-full sm:w-auto bg-emerald-950/15 border border-emerald-500/10">
            <div className="flex flex-col items-start select-none">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Control Mode</span>
              <span className="text-[11px] sm:text-xs font-black text-emerald-400 mt-0.5">{autoMode ? 'AUTO MODE' : 'MANUAL MODE'}</span>
            </div>
            <ToggleSwitch checked={autoMode} onChange={setAutoMode} />
          </div>

          {/* Reset Changes Button */}
          <button 
            onClick={handleReset || (() => window.location.reload())}
            className="flex items-center justify-center gap-2 h-11 sm:h-12 w-full sm:w-auto px-4 sm:px-8 text-xs sm:text-sm font-black text-slate-400 hover:text-white border border-emerald-500/10 hover:border-emerald-500/30 bg-[#040c08]/50 hover:bg-emerald-950/10 transition-all cursor-pointer select-none active:scale-[0.97]"
          >
            <RotateCcw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            RESET
          </button>

          {/* Save Settings Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2.5 h-11 sm:h-12 w-full sm:w-auto px-5 sm:px-10 text-xs sm:text-sm font-black text-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border border-emerald-500/20-950/30 hover:scale-[1.02] active:scale-[0.97] transition-all cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none"
          >
            <Save className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'SAVING...' : 'SAVE SETTINGS'}
          </button>
        </div>
      </div>

      {/* Save Success Alert Notification Toast */}
      {saveSuccess && (
        <div className="border border-emerald-500/30 bg-[#04160d] text-emerald-400 p-4 sm:p-6 flex items-center gap-3 sm:gap-4 animate-fadeIn">
          <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
          <div className="text-xs sm:text-sm font-black tracking-wide uppercase">
            Saved
          </div>
        </div>
      )}
    </>
  );
}

export default SettingsHeader;
