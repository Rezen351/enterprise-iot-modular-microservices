import { Camera } from 'lucide-react';
import ToggleSwitch from '../../ToggleSwitch';

function StreamControls({ 
  autoSwitch, 
  setAutoSwitch, 
  switchInterval, 
  setSwitchInterval, 
  streamQuality, 
  setStreamQuality, 
  addLog, 
  nightVision, 
  setNightVision, 
  recordStream, 
  handleRecordToggle, 
  handleScreenshot 
}) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3.5 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <h3 className="font-bold text-white font-display tracking-wider text-sm border-b border-emerald-500/10 pb-3">
        STREAM CONTROLS
      </h3>
      
      <div className="flex flex-col gap-3.5 sm:gap-4">
        
        {/* Auto Switch */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-300">Auto Switch</span>
            <span className="text-[10px] text-slate-500">Switch focus automatically</span>
          </div>
          <ToggleSwitch checked={autoSwitch} onChange={setAutoSwitch} />
        </div>

        {/* Switch Interval */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Switch Interval</span>
          <select 
            value={switchInterval}
            onChange={(e) => setSwitchInterval(Number(e.target.value))}
            disabled={!autoSwitch}
            className="bg-[#050f0a] border border-emerald-500/25 text-emerald-400 text-xs px-2.5 py-1.5 focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            <option value={5}>5 Seconds</option>
            <option value={10}>10 Seconds</option>
            <option value={30}>30 Seconds</option>
            <option value={60}>1 Minute</option>
          </select>
        </div>

        {/* Stream Quality */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Stream Quality</span>
          <select 
            value={streamQuality}
            onChange={(e) => {
              setStreamQuality(e.target.value);
              addLog('Controls', `Stream Quality changed to ${e.target.value === 'high' ? '1080p' : e.target.value === 'medium' ? '720p' : '480p'}`, 'info');
            }}
            className="bg-[#050f0a] border border-emerald-500/25 text-emerald-400 text-xs px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="high">High (1080p)</option>
            <option value="medium">Medium (720p)</option>
            <option value="low">Low (480p)</option>
          </select>
        </div>

        {/* Night Vision Mode */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-300">Night Vision Mode</span>
            <span className="text-[10px] text-slate-500">Apply green night filter</span>
          </div>
          <ToggleSwitch 
            checked={nightVision} 
            onChange={(checked) => {
              setNightVision(checked);
              addLog('Controls', `Night vision filter ${checked ? 'activated' : 'deactivated'}`, 'info');
            }} 
          />
        </div>

        {/* Record Stream */}
        <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4 mb-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-300">Record Stream</span>
            <span className="text-[10px] text-slate-500">Record all streams locally</span>
          </div>
          <ToggleSwitch checked={recordStream} onChange={handleRecordToggle} />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 text-xs font-bold">
          <button 
            onClick={handleScreenshot}
            className="flex items-center justify-center gap-2 py-2.5 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all cursor-pointer bg-emerald-950/5"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Screenshot</span>
          </button>
          <button 
            onClick={handleRecordToggle}
            className={`flex items-center justify-center gap-2 py-2.5 border transition-all cursor-pointer ${
              recordStream 
                ? 'bg-red-500 text-black border-red-500' 
                : 'bg-red-950/5 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-black hover:border-red-500'
            }`}
          >
            <span className={`h-2 w-2 bg-current ${recordStream ? 'animate-ping' : ''}`}></span>
            <span>{recordStream ? 'Recording' : 'Record Now'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

export default StreamControls;
