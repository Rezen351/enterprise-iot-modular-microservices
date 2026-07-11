import { Download, Trash2, Edit2, Share2 } from 'lucide-react';

function SnapshotActions({ 
  handleDownloadSelected, 
  selectedIdsLength, 
  handleDeleteSelected, 
  activeSnapshot, 
  setTempNotes, 
  setNotesEditMode, 
  handleExportGallery 
}) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-5 flex flex-col gap-3">
      <h3 className="font-bold text-white font-display tracking-wider text-xs border-b border-emerald-500/10 pb-2.5 mb-1">
        ACTIONS
      </h3>

      <div className="flex flex-col gap-2.5">
        <button 
          onClick={handleDownloadSelected}
          className="w-full flex items-center gap-3 px-4 py-2.5 border border-emerald-500/20 text-emerald-400 bg-emerald-950/5 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all font-bold text-xs tracking-wider cursor-pointer"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Download Selected</span>
          {selectedIdsLength > 0 && (
            <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 border border-emerald-500/30">
              {selectedIdsLength}
            </span>
          )}
        </button>

        <button 
          onClick={handleDeleteSelected}
          className="w-full flex items-center gap-3 px-4 py-2.5 border border-red-500/20 text-red-400 bg-red-950/5 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all font-bold text-xs tracking-wider cursor-pointer"
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span>Delete Selected</span>
          {selectedIdsLength > 0 && (
            <span className="ml-auto bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 border border-red-500/30">
              {selectedIdsLength}
            </span>
          )}
        </button>

        <button 
          onClick={() => {
            if (activeSnapshot) {
              setTempNotes(activeSnapshot.notes);
              setNotesEditMode(true);
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 border border-emerald-500/20 text-emerald-400 bg-emerald-950/5 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all font-bold text-xs tracking-wider cursor-pointer"
        >
          <Edit2 className="w-4 h-4 shrink-0" />
          <span>Add Note</span>
        </button>

        <button 
          onClick={handleExportGallery}
          className="w-full flex items-center gap-3 px-4 py-2.5 border border-emerald-500/20 text-emerald-400 bg-emerald-950/5 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all font-bold text-xs tracking-wider cursor-pointer"
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span>Export Gallery</span>
        </button>
      </div>
    </div>
  );
}

export default SnapshotActions;
