import { Video, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import StaticNoise from './StaticNoise';

function VideoFeedGrid({ 
  loading, 
  streams, 
  error, 
  fetchStreamsAndStatus, 
  setShowAddModal, 
  layoutMode, 
  isOnline, 
  autoSwitch, 
  activeAutoCamIndex, 
  nightVision, 
  recordStream, 
  handleDeleteCamera, 
  clockTime 
}) {
  if (loading && streams.length === 0) {
    return (
      <div className="h-96 border border-dashed border-emerald-500/20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-slate-400 text-sm font-semibold">Connecting...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 border border-red-500/30 bg-red-950/15 text-center">
        <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-white font-bold mb-2">Connection Error</h3>
        <p className="text-slate-400 text-xs sm:text-sm mb-4 font-semibold">{error}</p>
        <button 
          onClick={() => fetchStreamsAndStatus()} 
          className="px-4 sm:px-6 h-11 sm:h-12 bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer font-bold text-xs sm:text-sm active:scale-[0.98]"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="p-6 sm:p-12 border border-dashed border-emerald-500/20 text-center bg-[#030705]/40">
        <Video className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-white font-bold mb-2">No Cameras Found</h3>
        <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto mb-6 font-semibold">
          No cameras registered. Add one to start.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          <button 
            onClick={() => setShowAddModal(true)} 
            className="px-6 sm:px-8 h-11 sm:h-12 bg-emerald-500 text-black font-bold text-xs sm:text-sm hover:bg-emerald-400 transition-all duration-200 cursor-pointer active:scale-[0.98]"
          >
            + Add Camera
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={
      layoutMode === 'grid' 
        ? 'grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6' 
        : 'flex flex-col gap-4 sm:gap-6'
    }>
      {streams.map((stream, idx) => {
        const active = isOnline(stream.path_name);
        const isAutoHighlighted = autoSwitch && activeAutoCamIndex === idx;

        return (
          <div 
            key={stream.id} 
            className={`relative group border overflow-hidden bg-black transition-all duration-300 flex flex-col aspect-video ${
              isAutoHighlighted 
                ? 'border-emerald-400 ring-1 ring-emerald-400' 
                : 'border-emerald-500/15'
            }`}
            style={{
              filter: nightVision ? 'sepia(1) hue-rotate(80deg) saturate(1.8) contrast(1.2)' : 'none'
            }}
          >
            {/* Feed Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-20 p-2.5 sm:p-4 md:p-5 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <span className={`h-2 w-2 md:h-3 md:w-3 shrink-0 ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                <span className="text-[10px] md:text-sm lg:text-base font-black text-white uppercase tracking-widest  truncate">
                  {`CAM ${String(idx+1).padStart(2, '0')} - ${stream.path_name.replace(/-/g, ' ')}`}
                </span>
              </div>

              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                {active && (
                  <span className="text-[8px] md:text-[11px] font-black text-emerald-400 bg-emerald-950/90 border border-emerald-400/40 px-2 md:px-3 py-0.5 md:py-1 uppercase tracking-[0.1em]">
                    LIVE
                  </span>
                )}
                
                <button 
                  onClick={() => handleDeleteCamera(stream.path_name)}
                  className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center bg-black/60 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Delete camera"
                >
                  <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>

            {/* Player Canvas / Iframe area */}
            <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center bg-[#010402]">
              {active ? (
                <iframe 
                  src={`/live/${stream.path_name}/`}
                  className="w-full h-full border-0 absolute inset-0 z-10"
                  allowFullScreen
                  title={stream.path_name}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-8 text-center select-none">
                  <StaticNoise opacity={25} />
                  
                  <div className="relative z-10 flex flex-col items-center gap-3 sm:gap-4 max-w-[280px] sm:max-w-xs p-4 sm:p-6 bg-black/60 backdrop-blur-md border border-emerald-500/20">
                    <div className="p-4 bg-emerald-500/5">
                      <Video className="w-12 h-12 text-slate-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black font-display text-white uppercase tracking-[0.15em]">
                        Offline
                      </span>
                      <span className="text-slate-500 text-[11px] font-mono break-all opacity-60">
                        {stream.source_url.replace('rtsp://', '')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feed Footer Overlay */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-3.5 sm:p-5 bg-gradient-to-t from-black/95 to-transparent flex items-center justify-between text-[10px] sm:text-[12px] font-black text-slate-300 uppercase tracking-widest">
              <span className="bg-black/40 px-2 py-0.5 border border-white/5">{stream.resolution || '1080p'}</span>
              <div className="flex items-center gap-4">
                <span className="tabular-nums ">{clockTime}</span>
                
                {/* Signal Bars */}
                <div className="flex items-end gap-1 h-4">
                  <span className={`w-1 ${active ? 'bg-emerald-400 h-2' : 'bg-slate-700 h-2'}`}></span>
                  <span className={`w-1 ${active ? 'bg-emerald-400 h-3' : 'bg-slate-700 h-2'}`}></span>
                  <span className={`w-1 ${active ? 'bg-emerald-400 h-4' : 'bg-slate-700 h-2'}`}></span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default VideoFeedGrid;
