import { RefreshCw } from 'lucide-react';

function ScanningProgress({ isScanning, scanProgress }) {
  if (!isScanning) return null;

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-emerald-400 flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Scanning system...
        </span>
        <span className="text-slate-300 tabular-nums">{scanProgress}%</span>
      </div>
      <div className="w-full h-1.5 bg-[#040e0a] overflow-hidden border border-emerald-500/10">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-100"
          style={{ width: `${scanProgress}%` }}
        />
      </div>
    </div>
  );
}

export default ScanningProgress;
