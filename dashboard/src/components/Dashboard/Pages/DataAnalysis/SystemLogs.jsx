import { CheckCircle2, Info, AlertTriangle, AlertOctagon, DatabaseZap, RefreshCw } from 'lucide-react';

function SystemLogs({ logs = [], isLoading = false, onRefresh }) {
  const getIcon = (level) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error':
        return <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
    }
  };

  const getLevelBadge = (level) => {
    switch (level) {
      case 'success':
        return 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400';
      case 'warning':
        return 'bg-amber-950/40 border-amber-500/20 text-amber-400';
      case 'error':
        return 'bg-red-950/40 border-red-500/20 text-red-400';
      case 'info':
      default:
        return 'bg-blue-950/40 border-blue-500/20 text-blue-400';
    }
  };

  const getRowBg = (level) => {
    switch (level) {
      case 'success': return 'hover:bg-emerald-950/10 border-emerald-500/8';
      case 'warning': return 'hover:bg-amber-950/10 border-amber-500/8';
      case 'error':   return 'hover:bg-red-950/10 border-red-500/8';
      default:        return 'hover:bg-blue-950/10 border-blue-500/8';
    }
  };

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <DatabaseZap className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-black font-display text-white tracking-widest uppercase">
            Logs
          </h3>
          {logs.length > 0 && (
            <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 tracking-wider">
              {logs.length}
            </span>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 border border-emerald-500/15 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all duration-200 disabled:opacity-40"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[340px] pr-0.5 scrollbar-thin">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-t-emerald-500 border-emerald-500/20 animate-spin" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
                Loading...
              </span>
            </div>
          </div>
        )}

        {!isLoading && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <DatabaseZap className="w-8 h-8 text-slate-700" />
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider">
              No logs
            </span>
          </div>
        )}

        {!isLoading && logs.map((log) => (
          <div
            key={log.id}
            className={`border p-3 flex items-start gap-3 transition-all duration-200 ${getRowBg(log.level)}`}
          >
            {/* Level Icon */}
            <div className="mt-0.5">
              {getIcon(log.level)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <h4 className="text-[11px] font-black text-white uppercase tracking-wide leading-tight truncate">
                  {log.title}
                </h4>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Level badge */}
                  <span className={`text-[8px] font-black px-1.5 py-0.5 border uppercase tracking-wider ${getLevelBadge(log.level)}`}>
                    {log.level}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed font-semibold line-clamp-2">
                {log.message}
              </p>
              {log.time && (
                <span className="text-[9px] font-mono text-slate-600 mt-1 block">
                  {log.time}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SystemLogs;
