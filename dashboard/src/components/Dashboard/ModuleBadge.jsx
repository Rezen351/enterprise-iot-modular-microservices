import { Server, FileText } from 'lucide-react';

/**
 * Badge yang tampil di bagian atas halaman menampilkan module yang sedang aktif.
 * @param {object} selectedModule  — module object dari ModuleContext, bisa null
 * @param {string} className    — additional classes untuk wrapper
 */
function ModuleBadge({ selectedModule, className = '' }) {
  if (!selectedModule) return null;

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 border border-emerald-500/20 bg-emerald-950/10 w-fit max-w-full ${className}`}>
      <Server className="w-4 h-4 text-emerald-400 shrink-0" />
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest truncate">
          {selectedModule.name}
        </span>
        {selectedModule.description && (
          <>
            <span className="text-emerald-500/30 text-xs">|</span>
            <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium truncate">
              <FileText className="w-3 h-3 shrink-0" />
              {selectedModule.description}
            </span>
          </>
        )}
      </div>
      <span className="w-2 h-2 shrink-0 bg-emerald-400 animate-pulse" />
    </div>
  );
}

export default ModuleBadge;
