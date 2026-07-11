import { Calendar, Search, Image as ImageIcon } from 'lucide-react';

function SnapshotHeader({ 
  handleSelectAll, 
  isAllSelected, 
  snapshotsLength, 
  cameraFilter, 
  setCameraFilter, 
  setCurrentPage, 
  categoryFilter, 
  setCategoryFilter, 
  searchQuery, 
  setSearchQuery,
  availableCameras = ['ALL', 'CAM 01', 'CAM 02', 'CAM 03', 'CAM 04']
}) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-3 sm:gap-4 w-full">
        <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-wide uppercase truncate">Image Vault</h2>
          <p className="hidden sm:block text-slate-400 text-xs sm:text-sm mt-1 font-medium truncate sm:whitespace-normal">
            Browse and manage captured snapshots.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={handleSelectAll}
          className="h-10 sm:h-11 px-3 sm:px-4 text-[10px] sm:text-xs font-black text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/5 transition-all cursor-pointer uppercase tracking-widest active:scale-[0.95]"
        >
          {isAllSelected ? 'DESELECT ALL' : 'SELECT ALL'}
        </button>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      <div className="flex items-center gap-2 sm:gap-3 bg-[#040e0a] border border-emerald-500/20 px-2.5 sm:px-4 h-10 sm:h-11 text-emerald-400 text-[10px] sm:text-xs hover:border-emerald-500/40 transition-colors cursor-pointer">
        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
        <span className="font-black truncate uppercase tracking-tight">Current Week</span>
      </div>

      <div className="relative">
        <select 
          value={cameraFilter}
          onChange={(e) => { setCameraFilter(e.target.value); setCurrentPage(1); }}
          className="w-full bg-[#040e0a] border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs px-2.5 sm:px-4 h-10 sm:h-11 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none font-black uppercase tracking-wider"
        >
          {availableCameras.map(cam => (
            <option key={cam} value={cam}>
              {cam === 'ALL' ? 'ALL CAMERAS' : cam}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-emerald-500/60 text-[8px]">
          ▼
        </div>
      </div>

      <div className="relative">
        <select 
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          className="w-full bg-[#040e0a] border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs px-2.5 sm:px-4 h-10 sm:h-11 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none font-black uppercase tracking-wider"
        >
          <option value="ALL">ALL CATEGORIES</option>
          <option value="Growth">GROWTH</option>
          <option value="Root Health">ROOT HEALTH</option>
          <option value="Leaf Health">LEAF HEALTH</option>
          <option value="System">SYSTEM</option>
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-emerald-500/60 text-[8px]">
          ▼
        </div>
      </div>

      <div className="relative">
        <input 
          type="text"
          placeholder="Search vault..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="w-full bg-[#040e0a] border border-emerald-500/20 text-slate-200 text-[10px] sm:text-xs pl-8 sm:pl-10 pr-2.5 sm:pr-4 h-10 sm:h-11 focus:outline-none focus:border-emerald-500/50 placeholder-slate-600 font-black uppercase tracking-widest"
        />
        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500/60 absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}

export default SnapshotHeader;
