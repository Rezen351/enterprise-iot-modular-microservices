import { Wind } from 'lucide-react';

function CoolingSchedule({ coolingSettings, liveTimer, activeModuleData }) {
  const isEnabled = coolingSettings?.isEnabled ?? true;
  const setPoint = liveTimer?.setPoint ?? coolingSettings?.tempSetPoint ?? 26.0;

  // Retrieve current temperature from either the WebSocket timer payload or live sensors
  const rawTemp = liveTimer?.currentTemp ?? activeModuleData?.sensors?.cwt_dalam_temp?.value;
  const currentTemp = typeof rawTemp === 'number' ? rawTemp : null;

  // Derive status
  const isCoolingActive = liveTimer ? liveTimer.state === "ON" : (activeModuleData?.isCoolingOn ?? false);

  // Compute progress representation (e.g. current / setpoint or cooling state)
  const progressPercent = isCoolingActive ? 100 : (currentTemp ? Math.min(100, Math.max(0, (currentTemp / setPoint) * 100)) : 0);

  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3.5 sm:p-4 flex flex-col justify-between h-[150px] relative overflow-hidden group">
      {/* Background Status Glow */}
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 blur-[40px] pointer-events-none transition-colors duration-1000 ${
        isEnabled && isCoolingActive ? 'bg-cyan-500/10' : 'bg-transparent'
      }`} />

      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Wind className={`w-4 h-4 transition-colors duration-300 ${
            isEnabled ? (isCoolingActive ? 'text-cyan-400 animate-spin-slow' : 'text-emerald-400') : 'text-slate-600'
          }`} />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Cooling</span>
        </div>
        <span className={`text-[8px] font-black px-1.5 py-0.5 ${
          isEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-950/40 text-slate-500'
        }`}>
          {isEnabled ? 'AUTO' : 'OFF'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-950 border border-slate-900 overflow-hidden my-1.5 z-10">
        <div 
           className={`h-full transition-all duration-1000 ${
            isEnabled && isCoolingActive 
              ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 animate-pulse'
              : 'bg-slate-800'
          }`} 
          style={{ width: `${isEnabled ? progressPercent : 0}%` }}
        />
      </div>

      {/* Temp metrics */}
      <div className="text-center z-10 flex flex-col justify-center my-0.5">
        <div className="flex items-baseline justify-center gap-1.5">
          <span className={`text-lg font-black font-mono tracking-tight ${
            isCoolingActive ? 'text-cyan-400' : 'text-white'
          }`}>
            {currentTemp !== null ? `${currentTemp.toFixed(1)}°C` : '--.-°C'}
          </span>
          <span className="text-slate-500 text-[10px] font-bold">/ {setPoint.toFixed(1)}°C</span>
        </div>
      </div>

      {/* Status indicator footer */}
      <div className="w-full flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-500 z-10 border-t border-emerald-500/10 pt-1.5">
        <span>Status</span>
        <span className={isEnabled ? (isCoolingActive ? 'text-cyan-400 font-extrabold' : 'text-slate-400') : 'text-slate-600'}>
          {isEnabled ? (isCoolingActive ? 'Running' : 'Idle') : 'Off'}
        </span>
      </div>
    </div>
  );
}

export default CoolingSchedule;
