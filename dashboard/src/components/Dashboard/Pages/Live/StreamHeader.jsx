import { Grid, List, RefreshCw } from 'lucide-react';
import ModuleBadge from '../../ModuleBadge';

function StreamHeader({ 
  selectedCamera, 
  setSelectedCamera, 
  streams, 
  layoutMode, 
  setLayoutMode, 
  onlineCount, 
  offlineCount, 
  fetchStreamsAndStatus,
  selectedModule
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-3 sm:p-6 border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-5 w-full sm:w-auto">
          <h2 className="text-sm sm:text-base md:text-xl font-black font-display text-white tracking-widest uppercase">Live</h2>
        
        <select 
          value={selectedCamera} 
          onChange={(e) => setSelectedCamera(e.target.value)}
          className="bg-[#050f0a] border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-black h-10 sm:h-12 px-3 sm:px-5 focus:outline-none focus:border-emerald-500 cursor-pointer uppercase tracking-wider"
        >
          <option value="ALL">ALL FEEDS</option>
          {streams.map(s => (
            <option key={s.id} value={s.path_name}>{s.path_name.replace(/-/g, ' ').toUpperCase()}</option>
          ))}
        </select>
        </div>
        {selectedModule && <ModuleBadge selectedModule={selectedModule} />}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-4 md:gap-5 flex-wrap w-full sm:w-auto">
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[#050f0a] border border-emerald-500/20 p-1 sm:p-1.5">
          <button 
            onClick={() => setLayoutMode('grid')}
            className={`h-9 sm:h-10 px-2 sm:px-3 transition-all ${layoutMode === 'grid' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-emerald-400'}`}
          >
            <Grid className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={() => setLayoutMode('list')}
            className={`h-9 sm:h-10 px-2 sm:px-3 transition-all ${layoutMode === 'list' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-emerald-400'}`}
          >
            <List className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-black uppercase tracking-widest">
          <div className="flex items-center gap-1.5 sm:gap-2 h-10 sm:h-12 px-3 sm:px-4 bg-[#041209] border border-emerald-500/10 text-emerald-400">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-400 animate-pulse"></span>
            <span>{onlineCount} Online</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 h-10 sm:h-12 px-3 sm:px-4 bg-[#170a0a] border border-red-500/10 text-red-400">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 bg-red-500"></span>
            <span>{offlineCount} Offline</span>
          </div>
        </div>

        <button 
          onClick={() => fetchStreamsAndStatus(true)}
          className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center bg-[#050f0a] hover:bg-emerald-500 hover:text-black border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 transition-all cursor-pointer active:scale-[0.95]"
          title="Refresh status"
        >
          <RefreshCw className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
}

export default StreamHeader;
