import { ShieldCheck, RefreshCw } from 'lucide-react';

function VersionSecurityHeader({ 
  lastAuditTime, 
  handleCheckUpdates, 
  isCheckingUpdates, 
  isUpdatingFirmware, 
  handleSecurityScan, 
  isScanning, 
  scanProgress 
}) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3.5 sm:p-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
      <div className="flex items-center gap-4 w-full xl:w-auto xl:flex-1 min-w-0">
        <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-2xl font-black font-display text-white tracking-widest uppercase truncate">
            Security
          </h2>
          <p className="hidden sm:block text-slate-400 text-xs sm:text-sm mt-1 font-medium truncate sm:whitespace-normal">
            Status: <span className="text-emerald-400 font-black">A+ ENCRYPTED</span> • Audit: <span className="font-bold text-slate-200">{lastAuditTime}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full xl:w-auto shrink-0">
        <button
          onClick={handleCheckUpdates}
          disabled={isCheckingUpdates || isUpdatingFirmware}
          className="flex-1 xl:flex-none flex items-center justify-center gap-2 h-10 sm:h-12 px-3 sm:px-6 text-[10px] sm:text-xs font-black text-slate-300 hover:text-white border border-emerald-500/15 hover:border-emerald-500/35 bg-emerald-950/5 hover:bg-emerald-950/20 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] uppercase tracking-widest"
        >
          <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
          <span className="truncate">{isCheckingUpdates ? 'Checking...' : 'Check Updates'}</span>
        </button>

        <button
          onClick={handleSecurityScan}
          disabled={isScanning}
          className="flex-1 xl:flex-none flex items-center justify-center gap-2 h-10 sm:h-12 px-3 sm:px-8 text-[10px] sm:text-xs font-black text-black border border-emerald-500/20 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] uppercase tracking-widest"
        >
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">{isScanning ? `Scanning (${scanProgress}%)` : 'Security Scan'}</span>
        </button>
      </div>
    </div>
  );
}

export default VersionSecurityHeader;
