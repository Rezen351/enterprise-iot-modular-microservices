import { Lock } from 'lucide-react';

function NetworkSecurityCard() {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3.5 sm:p-5">
      <h3 className="text-xs font-bold font-display text-white tracking-wider uppercase border-b border-emerald-500/10 pb-3 mb-4 flex items-center gap-2">
        <Lock className="w-4 h-4 text-emerald-500" />
        Network Security
      </h3>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-emerald-500/5 pb-2.5">
          <span className="text-xs text-slate-400 font-semibold">SSL/TLS</span>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/20">
            HTTPS Enabled
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-emerald-500/5 pb-2.5">
          <span className="text-xs text-slate-400 font-semibold">SSL Authority</span>
          <span className="text-xs font-bold text-slate-300">Let's Encrypt Authority X3</span>
        </div>
        <div className="flex items-center justify-between border-b border-emerald-500/5 pb-2.5">
          <span className="text-xs text-slate-400 font-semibold">Cipher</span>
          <span className="text-xs font-bold text-slate-300 font-mono">AES_256_GCM (TLSv1.3)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-semibold">ESP32 Handshake</span>
          <span className="text-xs font-bold text-emerald-400">ECDH (Curve25519)</span>
        </div>
      </div>
    </div>
  );
}

export default NetworkSecurityCard;
