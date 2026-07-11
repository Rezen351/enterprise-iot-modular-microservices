import { Calendar, Search } from 'lucide-react';

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
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-4 md:p-6 flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-sm md:text-xl font-black font-display text-white tracking-widest uppercase truncate">
          Image Vault
        </h2>
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
          <button
            onClick={handleSelectAll}
            className="text-[9px] md:text-[11px] font-black text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/5 h-8 md:h-10 px-3 md:px-4 transition-all cursor-pointer uppercase tracking-widest active:scale-[0.95] shrink-0"
          >
            {isAllSelected ? 'DESELECT ALL' : 'SELECT ALL'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 bg-[#040e0a] border border-emerald-500/20 px-2.5 sm:px-4 h-10 md:h-14 text-emerald-400 text-[9px] sm:text-[11px] md:text-sm hover:border-emerald-500/40 transition-colors cursor-pointer min-w-0">
          <Calendar className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
          <span className="font-black truncate uppercase tracking-tight">Current Week</span>
        </div>

        <div className="relative">
          <select 
            value={cameraFilter}
            onChange={(e) => { setCameraFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-[#040e0a] border border-emerald-500/20 text-emerald-400 text-[9px] sm:text-[11px] md:text-sm px-2.5 sm:px-4 md:px-5 h-10 md:h-14 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none pr-8 md:pr-12 font-black uppercase tracking-wider"
          >
            {availableCameras.map(cam => (
              <option key={cam} value={cam}>
                {cam === 'ALL' ? 'ALL CAMERAS' : cam}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 md:pr-5 pointer-events-none text-emerald-500/60 text-[8px] md:text-[12px]">
            ▼
          </div>
        </div>

        <div className="relative">
          <select 
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-[#040e0a] border border-emerald-500/20 text-emerald-400 text-[9px] sm:text-[11px] md:text-sm px-2.5 sm:px-4 md:px-5 h-10 md:h-14 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none pr-8 md:pr-12 font-black uppercase tracking-wider"
          >
            <option value="ALL">ALL CATEGORIES</option>
            <option value="Growth">GROWTH</option>
            <option value="Root Health">ROOT HEALTH</option>
            <option value="Leaf Health">LEAF HEALTH</option>
            <option value="System">SYSTEM</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 md:pr-5 pointer-events-none text-emerald-500/60 text-[8px] md:text-[12px]">
            ▼
          </div>
        </div>

        <div className="relative">
          <input 
            type="text"
            placeholder="Search vault..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-[#040e0a] border border-emerald-500/20 text-slate-200 text-[9px] sm:text-[11px] md:text-sm pl-8 md:pl-12 pr-2.5 md:pr-5 h-10 md:h-14 focus:outline-none focus:border-emerald-500/50 placeholder-slate-600 font-black uppercase tracking-widest"
          />
          <Search className="w-3.5 h-3.5 md:w-5 md:h-5 text-emerald-500/60 absolute left-2.5 md:left-4 top-1/2 -translate-y-1/2" />
        </div>
      </div>
    </div>
  );
}

export default SnapshotHeader;
