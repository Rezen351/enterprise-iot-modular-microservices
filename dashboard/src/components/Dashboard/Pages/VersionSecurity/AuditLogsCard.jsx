import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

function AuditLogsCard({ activeTab, setActiveTab, filteredLogs, isLoading = false }) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3.5 sm:p-5">
      <div className="flex items-center justify-between border-b border-emerald-500/10 pb-3 mb-4">
        <h3 className="text-xs font-bold font-display text-white tracking-wider uppercase flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-500" />
          Audit Logs
        </h3>

        <div className="flex items-center gap-1.5 bg-[#040e0a] border border-emerald-500/20 p-0.5 text-[9px] font-bold">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2 py-1 cursor-pointer transition-colors ${
              activeTab === 'all' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`px-2 py-1 cursor-pointer transition-colors ${
              activeTab === 'info' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            Info
          </button>
          <button
            onClick={() => setActiveTab('warning')}
            className={`px-2 py-1 cursor-pointer transition-colors ${
              activeTab === 'warning' ? 'bg-amber-400 text-black animate-pulse' : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            Warns
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 border-2 border-emerald-500/10 animate-pulse"></div>
              <div className="absolute inset-0 border-2 border-t-emerald-500 animate-spin"></div>
            </div>
            <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase animate-pulse">
              Loading logs...
            </span>
          </div>
        )}

        {!isLoading && filteredLogs.map((log) => (
          <div key={log.id} className="flex gap-2.5 sm:gap-3 text-xs">
            <div className="mt-0.5 shrink-0">
              {log.severity === 'WARNING' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-slate-300 leading-normal text-[11px] font-semibold">
                {log.message}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500 font-bold uppercase">
                <span className="tabular-nums text-slate-500">{log.time}</span>
                <span>•</span>
                <span className="text-emerald-500/70">{log.type}</span>
              </div>
            </div>
          </div>
        ))}

        {!isLoading && filteredLogs.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-xs">
            Tidak ada log audit untuk kategori filter ini.
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLogsCard;
