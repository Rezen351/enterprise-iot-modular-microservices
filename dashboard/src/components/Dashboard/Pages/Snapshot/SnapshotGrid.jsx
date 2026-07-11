import { Info, CheckSquare, Square, Calendar, MoreVertical } from 'lucide-react';

function SnapshotGrid({ 
  paginatedSnapshots, 
  setCameraFilter, 
  setCategoryFilter, 
  setSearchQuery, 
  setCurrentPage, 
  activeSnapshot, 
  setActiveId, 
  setNotesEditMode, 
  selectedIds, 
  toggleSelect, 
  activeMenuId, 
  setActiveMenuId, 
  setSnapshots 
}) {
  if (paginatedSnapshots.length === 0) {
    return (
      <div className="p-16 border border-dashed border-emerald-500/15 text-center bg-[#030705]/40 flex flex-col items-center justify-center">
        <Info className="w-10 h-10 text-slate-600 mb-3" />
        <h3 className="text-white font-bold mb-1 text-sm">No Snapshots Found</h3>
        <p className="text-slate-500 text-xs max-w-xs mx-auto mb-4">
          No results match the keywords or filters you are currently using.
        </p>
        <button 
          onClick={() => { setCameraFilter('ALL'); setCategoryFilter('ALL'); setSearchQuery(''); setCurrentPage(1); }}
          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline"
        >
          Reset All Filters
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
      {paginatedSnapshots.map((item) => {
        const isActive = activeSnapshot && activeSnapshot.id === item.id;
        const isSelected = selectedIds.includes(item.id);

        return (
          <div 
            key={item.id}
            onClick={() => {
              setActiveId(item.id);
              setNotesEditMode(false);
            }}
            className={`border overflow-hidden bg-[#030705]/80 hover:bg-[#040e0a]/90 transition-all duration-300 flex flex-col group relative ${
              isActive 
                ? 'border-emerald-500 ring-1 ring-emerald-500/20' 
                : 'border-emerald-500/15 hover:border-emerald-500/30'
            }`}
          >
            <div className="p-2.5 md:p-3 bg-gradient-to-b from-[#030705] to-transparent flex items-center justify-between z-10">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(item.id);
                  }}
                  className="p-0.5 text-slate-400 hover:text-emerald-400 cursor-pointer shrink-0 transition-colors"
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-600 hover:text-emerald-500/50" />
                  )}
                </button>
                <span className="text-[10px] md:text-xs font-bold text-slate-200 truncate select-none group-hover:text-emerald-300 transition-colors">
                  {item.title}
                </span>
              </div>
              <span className={`text-[8px] md:text-[9px] font-bold px-1.5 md:px-2 py-0.5 border tracking-wide uppercase shrink-0 ${item.tagColor}`}>
                {item.category}
              </span>
            </div>

            <div className="aspect-video relative overflow-hidden bg-black select-none">
              <img 
                src={item.image} 
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              {isActive && (
                <div className="absolute inset-0 bg-emerald-500/5 border border-emerald-500/10 pointer-events-none" />
              )}
            </div>

            <div className="p-2.5 md:p-3 bg-[#030705] flex items-center justify-between border-t border-emerald-500/5 text-[9px] md:text-[10px] text-slate-400 font-semibold">
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar className="w-3 h-3 text-emerald-500/60 shrink-0" />
                <span className="truncate tabular-nums">{item.date}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-slate-300 font-bold uppercase tracking-wider bg-[#06140e] border border-emerald-500/10 px-1 md:px-1.5 py-0.5 text-[8px] md:text-[9px]">
                  {item.cam}
                </span>
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === item.id ? null : item.id);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-200 cursor-pointer"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                  {activeMenuId === item.id && (
                    <>
                      <div className="fixed inset-0 z-25" onClick={() => setActiveMenuId(null)} />
                      <div className="absolute right-0 bottom-full mb-1 w-28 bg-[#030705] border border-emerald-500/20 z-30 py-1 text-xs">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            alert(`Downloading: ${item.title}`);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-emerald-950/30 hover:text-emerald-400 transition-colors"
                        >
                          Download
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveId(item.id);
                            setNotesEditMode(true);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-emerald-950/30 hover:text-emerald-400 transition-colors"
                        >
                          Edit Note
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete ${item.title}?`)) {
                              setSnapshots(prev => prev.filter(s => s.id !== item.id));
                            }
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-950/20 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SnapshotGrid;
