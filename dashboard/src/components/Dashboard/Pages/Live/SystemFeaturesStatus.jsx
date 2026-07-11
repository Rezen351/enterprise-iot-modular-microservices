function SystemFeaturesStatus({ autoSwitch, nightVision, recordStream }) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3.5 sm:p-5 flex flex-col gap-4">
      <h3 className="font-bold text-white font-display tracking-wider text-xs border-b border-emerald-500/10 pb-2.5">
        Features
      </h3>
      
      <div className="flex flex-col gap-3.5">
        {/* RTSP Broadcast */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">RTSP</span>
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold uppercase text-[9px]">
            Active
          </span>
        </div>

        {/* WebRTC Live Stream */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">WebRTC</span>
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold uppercase text-[9px]">
            Active
          </span>
        </div>

        {/* Auto Focus Switch */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Auto Switch</span>
          <span className={`px-2 py-0.5 font-bold uppercase text-[9px] border transition-colors ${
            autoSwitch 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
              : 'bg-slate-500/10 text-slate-500 border-slate-500/15'
          }`}>
            {autoSwitch ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Night Vision Filter */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Night Vision</span>
          <span className={`px-2 py-0.5 font-bold uppercase text-[9px] border transition-colors ${
            nightVision 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
              : 'bg-slate-500/10 text-slate-500 border-slate-500/15'
          }`}>
            {nightVision ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Local Recording */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Recording</span>
          <span className={`px-2 py-0.5 font-bold uppercase text-[9px] border transition-colors ${
            recordStream 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
              : 'bg-slate-500/10 text-slate-500 border-slate-500/15'
          }`}>
            {recordStream ? 'Recording' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SystemFeaturesStatus;
