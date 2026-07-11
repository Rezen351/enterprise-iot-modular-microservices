import { CheckCircle2, Info, AlertTriangle, AlertOctagon } from 'lucide-react';

function InsightsAlerts({ insights }) {
  const getIcon = (level) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'error':
        return <AlertOctagon className="w-5 h-5 text-red-400" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBgClass = (level) => {
    switch (level) {
      case 'success':
        return 'bg-emerald-950/20 border-emerald-500/10 hover:border-emerald-500/25';
      case 'warning':
        return 'bg-amber-950/20 border-amber-500/10 hover:border-amber-500/25';
      case 'error':
        return 'bg-red-950/20 border-red-500/10 hover:border-red-500/25';
      case 'info':
      default:
        return 'bg-blue-950/20 border-blue-500/10 hover:border-blue-500/25';
    }
  };

  return (
      <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-6 h-full flex flex-col justify-between">
      <h3 className="text-sm font-black font-display text-white tracking-widest uppercase border-b border-emerald-500/10 pb-4 mb-4">
        Alerts
      </h3>

      <div className="flex-1 overflow-y-auto space-y-3 max-h-[300px] pr-1">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`border p-4 flex items-start gap-3.5 transition-all duration-300 ${getBgClass(insight.level)}`}
          >
            <div className="shrink-0 mt-0.5">
              {getIcon(insight.level)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">
                  {insight.title}
                </h4>
                <span className="font-mono text-[9px] font-bold text-slate-500 shrink-0">
                  {insight.time}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-semibold mt-1">
                {insight.message}
              </p>
            </div>
          </div>
        ))}
        {insights.length === 0 && (
          <div className="h-full flex items-center justify-center py-12">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">No alerts</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default InsightsAlerts;
