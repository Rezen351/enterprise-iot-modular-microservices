import { Edit2 } from 'lucide-react';
import { getDotColor } from './SnapshotDefaults';

function SnapshotInfo({ 
  activeSnapshot, 
  notesEditMode, 
  setNotesEditMode, 
  tempNotes, 
  setTempNotes, 
  handleSaveNotes 
}) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-5 flex flex-col gap-4">
      <h3 className="font-bold text-white font-display tracking-wider text-xs border-b border-emerald-500/10 pb-2.5">
        SNAPSHOT INFO
      </h3>

      {activeSnapshot ? (
        <div className="flex flex-col gap-4">
          <div className="aspect-video w-full overflow-hidden border border-emerald-500/10 bg-black relative select-none">
            <img 
              src={activeSnapshot.image} 
              alt={activeSnapshot.title} 
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500 font-semibold">Camera</span>
              <span className="text-slate-300 font-bold">{activeSnapshot.cam} - {activeSnapshot.title}</span>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500 font-semibold">Category</span>
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 ${getDotColor(activeSnapshot.category)}`}></span>
                <span className="text-slate-300 font-bold">{activeSnapshot.category}</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500 font-semibold">Date & Time</span>
              <span className="text-slate-300 font-semibold tabular-nums">{activeSnapshot.date}</span>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500 font-semibold">Resolution</span>
              <span className="text-slate-300 font-semibold">{activeSnapshot.resolution}</span>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500 font-semibold">File Size</span>
              <span className="text-slate-300 font-semibold">{activeSnapshot.fileSize}</span>
            </div>

            {activeSnapshot.predictions && activeSnapshot.predictions.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-emerald-500/10 pt-3">
                <span className="text-slate-500 font-semibold">Detections ({activeSnapshot.predictions.length})</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {activeSnapshot.predictions.map((p, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-0.5 text-[10px] bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-bold"
                    >
                      {p.class} ({Math.round(p.confidence * 100)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1 border-t border-emerald-500/10 pt-3">
              <span className="text-slate-500 font-semibold">Notes</span>
              
              {notesEditMode ? (
                <div className="flex flex-col gap-2 mt-1">
                  <textarea 
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                    className="w-full bg-[#040e0a] border border-emerald-500/30 text-slate-300 text-xs p-2.5 focus:outline-none focus:border-emerald-500"
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <button 
                      onClick={() => setNotesEditMode(false)}
                      className="px-2.5 py-1 text-[10px] border border-slate-600 text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer font-bold"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveNotes}
                      className="px-2.5 py-1 text-[10px] bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all cursor-pointer font-bold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start gap-3 mt-0.5">
                  <p className="text-slate-300 leading-relaxed font-semibold italic flex-1 break-words">
                    {activeSnapshot.notes || 'No notes added to this snapshot.'}
                  </p>
                  <button 
                    onClick={() => {
                      setTempNotes(activeSnapshot.notes);
                      setNotesEditMode(true);
                    }}
                    className="text-emerald-500 hover:text-emerald-400 p-1 cursor-pointer shrink-0 transition-colors"
                    title="Edit note"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500 text-xs font-semibold">
          Select a snapshot to view details.
        </div>
      )}
    </div>
  );
}

export default SnapshotInfo;
