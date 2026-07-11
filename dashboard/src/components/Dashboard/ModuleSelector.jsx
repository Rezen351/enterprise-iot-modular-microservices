import { useState, useRef, useEffect } from 'react';
import { Server, ChevronDown, FileText, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useModule } from '../../context/ModuleContext';

function ModuleSelector() {
  const { modules, selectedModule, setSelectedModule, loadingModules, fetchModules } = useModule();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center gap-2 px-3 py-2.5 border font-bold text-xs tracking-wider transition-all duration-200 cursor-pointer select-none ${
          open
            ? 'bg-emerald-500 text-black border-emerald-500'
            : 'border-emerald-500/30 text-emerald-400 bg-emerald-950/10 hover:bg-emerald-500 hover:text-black hover:border-emerald-500'
        }`}
        title="Select Module"
      >
        {loadingModules ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Server className="w-3.5 h-3.5 shrink-0" />
        )}

        <span className="hidden sm:inline max-w-[120px] truncate">
          {loadingModules ? 'Loading...' : (selectedModule?.name ?? 'Select Module')}
        </span>

        {!loadingModules && (
          <span className="hidden md:inline-flex items-center justify-center w-5 h-5 bg-black/20 text-[10px] font-black shrink-0">
            {modules.length}
          </span>
        )}

        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 z-50 bg-[#040c08] border border-emerald-500/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/10">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black text-white uppercase tracking-widest">Module</span>
            </div>
            <button
              onClick={() => { fetchModules(); }}
              className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-950/30 transition-all cursor-pointer"
              title="Refresh module list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto py-1.5">
            {loadingModules ? (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs font-bold">Loading module list...</span>
              </div>
            ) : modules.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500 font-bold uppercase tracking-wider">
                No registered modules
              </div>
            ) : (
              modules.map((module) => {
                const isSelected = selectedModule?.id === module.id;
                return (
                  <button
                    key={module.id}
                    onClick={() => { setSelectedModule(module); setOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-emerald-500/10 text-white'
                        : 'hover:bg-emerald-950/20 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2.5 h-2.5 shrink-0 bg-emerald-400" />
                      <div className="min-w-0">
                        <p className="text-xs font-black truncate uppercase tracking-wide">{module.name}</p>
                        {module.description && (
                          <p className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                            <FileText className="w-2.5 h-2.5 shrink-0" />
                            {module.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-emerald-500/10 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
              {modules.length} module(s)
            </span>
            <span className="text-[10px] text-slate-700 font-black uppercase tracking-widest">
              Manage in Module menu
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModuleSelector;
