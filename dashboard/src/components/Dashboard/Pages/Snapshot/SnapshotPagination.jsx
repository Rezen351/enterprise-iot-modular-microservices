import { ChevronLeft, ChevronRight } from 'lucide-react';

function SnapshotPagination({ 
  filteredSnapshotsLength, 
  currentPage, 
  setCurrentPage, 
  pageSize, 
  setPageSize, 
  totalPages 
}) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-4">
      <span className="text-[10px] md:text-xs text-slate-400 font-semibold order-2 md:order-1">
        Showing {filteredSnapshotsLength > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredSnapshotsLength)} of {filteredSnapshotsLength}
      </span>

      <div className="flex items-center gap-1 order-1 md:order-2">
        <button 
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="p-1 text-slate-600 hover:text-emerald-400 cursor-pointer disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        
        <div className="flex items-center gap-1 overflow-x-auto max-w-[150px] sm:max-w-none scrollbar-hide">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`font-bold px-2 md:px-2.5 py-1 text-[10px] md:text-xs leading-none transition-colors shrink-0 ${
                currentPage === i + 1 ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button 
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages || totalPages <= 1}
          className="p-1 text-slate-600 hover:text-emerald-400 cursor-pointer disabled:opacity-40 transition-colors"
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400 font-semibold order-3">
        <span>Per page</span>
        <select 
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
          className="bg-[#040e0a] border border-emerald-500/20 text-emerald-400 text-[10px] md:text-xs px-2 py-1 focus:outline-none cursor-pointer"
        >
          <option value={9}>9</option>
          <option value={18}>18</option>
        </select>
      </div>
    </div>
  );
}

export default SnapshotPagination;
