import { Info } from 'lucide-react';

function EventTimeline({ timelineEvents }) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3.5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-emerald-500/10 pb-3">
        <h3 className="font-bold text-white font-display tracking-wider text-sm">Timeline</h3>
        <span className="text-[10px] text-slate-400 font-bold uppercase">Events</span>
      </div>

      <div className="flex flex-col gap-3.5 max-h-56 overflow-y-auto">
        {timelineEvents.map((event) => (
          <div key={event.id} className="flex items-center justify-between text-xs gap-4 hover:bg-emerald-950/5 p-1 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-1.5 shrink-0 border ${
                event.type === 'warning' 
                  ? 'bg-amber-950/20 border-amber-500/30 text-amber-500' 
                  : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-500'
              }`}>
                <Info className="w-3.5 h-3.5" />
              </div>
              <span className="text-slate-500 tabular-nums shrink-0">{event.time}</span>
              <span className="text-slate-300 font-bold uppercase text-[10px] shrink-0 truncate max-w-[120px]">
                {event.source}
              </span>
              <span className="text-slate-400 truncate">{event.message}</span>
            </div>

            <span className={`text-[9px] font-bold px-2 py-0.5 shrink-0 ${
              event.type === 'warning' 
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {event.type.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventTimeline;
