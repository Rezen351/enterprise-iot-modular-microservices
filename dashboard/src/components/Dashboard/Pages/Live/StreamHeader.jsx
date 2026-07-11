import { Camera, Grid, List, RefreshCw } from 'lucide-react';
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
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-3 sm:gap-4 w-full">
        <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <Camera className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-wide uppercase truncate">Live</h2>
          <p className="hidden sm:block text-slate-400 text-xs sm:text-sm mt-1 font-medium truncate sm:whitespace-normal">
            Real-time camera feeds and monitoring.
          </p>
          {selectedModule && <ModuleBadge selectedModule={selectedModule} className="mt-2" />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <select 
          value={selectedCamera} 
          onChange={(e) => setSelectedCamera(e.target.value)}
          className="bg-[#050f0a] border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-black h-10 sm:h-11 px-3 sm:px-4 focus:outline-none focus:border-emerald-500 cursor-pointer uppercase tracking-wider"
        >
          <option value="ALL">ALL FEEDS</option>
          {streams.map(s => (
            <option key={s.id} value={s.path_name}>{s.path_name.replace(/-/g, ' ').toUpperCase()}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 sm:gap-1.5 bg-[#050f0a] border border-emerald-500/20 p-1">
          <button 
            onClick={() => setLayoutMode('grid')}
            className={`h-8 sm:h-9 px-2 sm:px-2.5 transition-all ${layoutMode === 'grid' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-emerald-400'}`}
          >
            <Grid className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={() => setLayoutMode('list')}
            className={`h-8 sm:h-9 px-2 sm:px-2.5 transition-all ${layoutMode === 'list' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-emerald-400'}`}
          >
            <List className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-black uppercase tracking-widest">
          <div className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-3 bg-[#041209] border border-emerald-500/10 text-emerald-400">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-400 animate-pulse"></span>
            <span>{onlineCount} Online</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-3 bg-[#170a0a] border border-red-500/10 text-red-400">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 bg-red-500"></span>
            <span>{offlineCount} Offline</span>
          </div>
        </div>

        <button 
          onClick={() => fetchStreamsAndStatus(true)}
          className="h-9 sm:h-10 w-9 sm:w-10 flex items-center justify-center bg-[#050f0a] hover:bg-emerald-500 hover:text-black border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 transition-all cursor-pointer active:scale-[0.95]"
          title="Refresh status"
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
}

export default StreamHeader;
