import { X } from 'lucide-react';

function AddCameraModal({ showAddModal, setShowAddModal, handleAddCamera, newCam, setNewCam }) {
  if (!showAddModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={() => setShowAddModal(false)}
      />
      
      <div className="relative z-10 w-full max-w-md border border-emerald-500/20 bg-[#030705] p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4 mb-4">
          <h3 className="font-bold text-white font-display text-base">Add New Camera Stream</h3>
          <button 
            onClick={() => setShowAddModal(false)}
            className="text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAddCamera} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Path Name (Unique ID)</label>
            <input 
              type="text"
              placeholder="e.g. cam-grow-chamber"
              value={newCam.path_name}
              onChange={(e) => setNewCam({ ...newCam, path_name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              className="bg-[#050f0a] border border-emerald-500/20 px-4 h-12 text-sm text-white focus:outline-none focus:border-emerald-500 font-semibold"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">RTSP Source URL</label>
            <input 
              type="text"
              placeholder="rtsp://192.168.1.100:8554/live"
              value={newCam.source_url}
              onChange={(e) => setNewCam({ ...newCam, source_url: e.target.value })}
              className="bg-[#050f0a] border border-emerald-500/20 px-4 h-12 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Codec</label>
              <select 
                value={newCam.video_codec}
                onChange={(e) => setNewCam({ ...newCam, video_codec: e.target.value })}
                className="bg-[#050f0a] border border-emerald-500/20 px-4 h-12 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-semibold"
              >
                <option value="H264">H264</option>
                <option value="H265">H265</option>
                <option value="MJPEG">MJPEG</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">FPS</label>
              <input 
                type="number"
                value={newCam.fps}
                onChange={(e) => setNewCam({ ...newCam, fps: Number(e.target.value) })}
                className="bg-[#050f0a] border border-emerald-500/20 px-4 h-12 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Resolution</label>
            <select 
              value={newCam.resolution}
              onChange={(e) => setNewCam({ ...newCam, resolution: e.target.value })}
              className="bg-[#050f0a] border border-emerald-500/20 px-4 h-12 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-semibold"
            >
              <option value="1920x1080">1920x1080 (1080p)</option>
              <option value="1280x720">1280x720 (720p)</option>
              <option value="640x480">640x480 (480p)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 mt-6 border-t border-emerald-500/10 pt-5">
            <button 
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-6 h-12 border border-slate-800 hover:border-emerald-500/25 text-slate-400 hover:text-slate-200 text-xs font-bold cursor-pointer transition-all active:scale-[0.98]"
            >
              CANCEL
            </button>
            <button 
              type="submit"
              className="px-8 h-12 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold cursor-pointer transition-all active:scale-[0.98]"
            >
              ADD CAMERA
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddCameraModal;
