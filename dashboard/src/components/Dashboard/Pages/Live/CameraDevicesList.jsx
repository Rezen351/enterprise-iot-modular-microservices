import { Video, RefreshCw, Plus } from 'lucide-react';

function CameraDevicesList({ streams, isOnline, fetchStreamsAndStatus, setShowAddModal }) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3.5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-emerald-500/10 pb-3">
        <h3 className="font-bold text-white font-display tracking-wider text-sm">
          CAMERA DEVICES
        </h3>
        <button 
          onClick={() => fetchStreamsAndStatus(false)}
          className="text-emerald-500 hover:text-emerald-400 transition-all cursor-pointer"
          title="Refresh device status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-3 max-h-60 overflow-y-auto">
        {streams.map((stream) => {
          const active = isOnline(stream.path_name);
          return (
            <div key={stream.id} className="flex items-center justify-between p-3 border border-emerald-500/10 bg-[#040e09]/50 hover:bg-[#06140d] transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <Video className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-200 truncate uppercase">
                    {stream.path_name.replace(/-/g, ' ')}
                  </span>
                  <span className="text-[9px] text-slate-500 truncate select-all">
                    {stream.source_url.replace('rtsp://', '')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 ${active ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                <span className={`text-[10px] font-bold uppercase ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {active ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <button 
        onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:bg-emerald-500/5 transition-all text-xs font-bold tracking-wider cursor-pointer mt-2"
      >
        <Plus className="w-4 h-4" />
        <span>ADD NEW CAMERA</span>
      </button>
    </div>
  );
}

export default CameraDevicesList;
