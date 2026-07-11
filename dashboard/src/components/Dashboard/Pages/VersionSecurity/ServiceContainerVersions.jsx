import { Server, ArrowUpRight, RefreshCw } from 'lucide-react';

function ServiceContainerVersions({ services, handleUpdateFirmware, isUpdatingFirmware, firmwareUpdateProgress, isLoading = false }) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3.5 sm:p-5">
      <h3 className="text-xs font-bold font-display text-white tracking-wider uppercase border-b border-emerald-500/10 pb-3 mb-4 flex items-center gap-2">
        <Server className="w-4 h-4 text-emerald-500" />
        Service Container Versions
      </h3>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          // Skeleton loader rows
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-emerald-500/5 bg-[#040c08]/40 p-3 sm:p-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 bg-emerald-500/5 shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-3 bg-slate-700/50 w-2/5" />
                  <div className="h-2 bg-slate-700/30 w-1/4" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="h-3 bg-slate-700/50 w-12" />
                <div className="h-2 bg-emerald-500/10 w-16" />
              </div>
            </div>
          ))
        ) : (
          services.map((svc) => {
          const SvcIcon = svc.icon;
          const isFirmwareUpdateAvailable = svc.id === 'firmware' && svc.status === 'Update Available';

          return (
            <div 
              key={svc.id} 
              className="border border-emerald-500/5 bg-[#040c08]/40 p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 hover:border-emerald-500/15 transition-colors"
            >
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="p-1.5 sm:p-2 bg-[#06140e] border border-emerald-500/10 text-emerald-400 shrink-0">
                  <SvcIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">{svc.name}</h4>
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-slate-500">
                    <span className="bg-[#050d09] border border-emerald-500/5 px-1.5 py-0.5 text-slate-400">
                      Port: {svc.port}
                    </span>
                    <span>•</span>
                    <span className="hidden sm:inline">{svc.type}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-200 tabular-nums">
                    {svc.version}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 ${
                      svc.status === 'Running' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                    }`} />
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      svc.status === 'Running' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {svc.status}
                    </span>
                  </div>
                </div>

                {isFirmwareUpdateAvailable && (
                  <button
                    onClick={handleUpdateFirmware}
                    disabled={isUpdatingFirmware}
                    className="px-2 py-1 sm:px-3 sm:py-1.5 text-[9px] sm:text-[10px] font-bold text-black bg-amber-400 hover:bg-amber-300 border border-amber-500/20 transition-all cursor-pointer flex items-center gap-0.5 sm:gap-1 disabled:opacity-40"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    Update
                  </button>
                )}
              </div>
            </div>
          );
          })
        )}
      </div>

      {isUpdatingFirmware && (
        <div className="mt-4 p-4 border border-amber-500/20 bg-amber-950/5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-400">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Flashing ESP32 OTA Firmware ({firmwareUpdateProgress}%)
            </span>
            <span className="tabular-nums">{firmwareUpdateProgress}%</span>
          </div>
          <div className="w-full h-1 bg-[#040e0a] overflow-hidden border border-amber-500/10">
            <div 
              className="h-full bg-amber-400 transition-all duration-100"
              style={{ width: `${firmwareUpdateProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ServiceContainerVersions;
