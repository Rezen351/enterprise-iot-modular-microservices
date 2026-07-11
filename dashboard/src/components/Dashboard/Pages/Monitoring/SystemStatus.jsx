import { ShieldCheck, AlertOctagon } from 'lucide-react';

function SystemStatus({ systemPower = true, systemHealth }) {
  const isDegraded = systemHealth?.status === 'degraded';
  
  const lastCheckTime = systemHealth?.timestamp 
    ? new Date(systemHealth.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : 'N/A';

  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3 sm:p-4 flex flex-col justify-between h-[180px] relative overflow-hidden group">
      
      {/* Background Status Glow */}
      <div className={`absolute -right-10 -bottom-10 w-36 h-36 blur-[60px] pointer-events-none transition-colors duration-1000 ${
        !systemPower || isDegraded ? 'bg-red-500/10' : 'bg-emerald-500/5'
      }`} />

      {/* Header */}
      <div className="flex items-center justify-between z-10 w-full border-b border-emerald-500/10 pb-2">
        <div className="flex items-center gap-1.5">
          {systemPower && !isDegraded ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertOctagon className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          )}
          <span className="text-[10px] font-black text-white uppercase tracking-widest">System</span>
        </div>
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
          systemPower && !isDegraded 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
            : 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse'
        }`}>
          {systemPower ? (isDegraded ? 'DEGRADED' : 'HEALTHY') : 'OFFLINE'}
        </span>
      </div>

      {/* Centered Circular Gauge and Details side-by-side */}
      <div className="flex items-center justify-between w-full z-10 flex-1 py-1.5">
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          {/* Glowing outer circle */}
          <div className={`absolute inset-0 border-4 transition-colors duration-300 ${
            systemPower && !isDegraded 
              ? 'border-emerald-500/10' 
              : 'border-red-500/10'
          }`} />
          
          {/* Animated active border path */}
          <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke={isDegraded ? '#ef4444' : '#10b981'}
              strokeWidth="8"
              fill="none"
              strokeDasharray="276"
              strokeDashoffset={
                !systemPower ? '276' : (isDegraded ? '138' : '0')
              }
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{ opacity: systemPower ? 1 : 0 }}
            />
          </svg>

          {/* Center text inside gauge */}
          <div className="text-center z-10 flex flex-col items-center">
            {systemPower && !isDegraded ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse" />
            )}
            <span className="text-[8px] font-black text-white uppercase tracking-wider mt-0.5">
              {systemPower ? (isDegraded ? 'Degraded' : 'Healthy') : 'Offline'}
            </span>
          </div>
        </div>

        {/* Text Details */}
        <div className="flex flex-col items-end text-right pl-3">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
            {systemPower ? (isDegraded ? 'Degraded state' : 'all systems running') : 'system offline'}
          </span>
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">
            {systemPower ? (isDegraded ? 'Issues Found' : 'Normal') : 'Shutdown'}
          </span>
        </div>
      </div>

      {/* Footer containing Last Check time */}
      <div className="w-full flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-500 z-10 border-t border-emerald-500/10 pt-2">
        <span>Last Check</span>
        <span className="tabular-nums text-slate-400">{lastCheckTime}</span>
      </div>

    </div>
  );
}

export default SystemStatus;
