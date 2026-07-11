import { Database, ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react';

function DatabaseOperations() {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6">
      <h3 className="text-xs font-bold font-display text-white tracking-widest uppercase border-b border-emerald-500/10 pb-4 mb-5 flex items-center gap-2.5">
        <Database className="w-5 h-5 text-emerald-400" />
        Database Operations
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Backup Settings */}
        <button 
          type="button"
          onClick={() => alert('Backup settings saved to backup_2026-05-22.json')}
          className="flex items-center justify-center gap-2.5 h-12 sm:h-14 border border-emerald-500/10 bg-[#040c08]/50 hover:bg-emerald-950/15 text-xs sm:text-sm font-bold text-slate-300 hover:text-white cursor-pointer select-none active:scale-[0.98] transition-all"
        >
          <ArrowDownToLine className="w-5 h-5 text-emerald-400 shrink-0" />
          BACKUP SETTINGS
        </button>

        {/* Restore Settings */}
        <button 
          type="button"
          onClick={() => alert('Restore simulation triggered. Select local settings JSON.')}
          className="flex items-center justify-center gap-2.5 h-12 sm:h-14 border border-emerald-500/10 bg-[#040c08]/50 hover:bg-emerald-950/15 text-xs sm:text-sm font-bold text-slate-300 hover:text-white cursor-pointer select-none active:scale-[0.98] transition-all"
        >
          <ArrowUpFromLine className="w-5 h-5 text-emerald-400 shrink-0" />
          RESTORE SETTINGS
        </button>

        {/* Clear Historical logs */}
        <button 
          type="button"
          onClick={() => { if(confirm('Are you sure you want to delete all sensor telemetry data?')) alert('Telemetry logs successfully cleared!'); }}
          className="sm:col-span-2 flex items-center justify-center gap-2.5 h-12 sm:h-14 border border-red-500/10 hover:border-red-500/30 bg-red-950/5 hover:bg-red-950/20 text-xs sm:text-sm font-bold text-red-400 cursor-pointer select-none active:scale-[0.98] transition-all"
        >
          <Trash2 className="w-5 h-5 shrink-0" />
          CLEAR SENSOR DATA LOGS
        </button>
      </div>
    </div>
  );
}

export default DatabaseOperations;
