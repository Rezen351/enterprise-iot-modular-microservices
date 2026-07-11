import { useState, useEffect } from 'react';
import { Layers, Network, Radio, ArrowRight, Save, SkipForward, Check, AlertTriangle } from 'lucide-react';
import { moduleApi } from '../../api/module';

function OnboardingWizard({ isOpen, onClose, onFinish }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [createdModuleId, setCreatedModuleId] = useState(null);
  const [discoveredNodes, setDiscoveredNodes] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Poll for auto-discovered (unpaired) nodes while on step 2.
  useEffect(() => {
    if (step !== 2) return;
    setIsSearching(true);

    const poll = async () => {
      try {
        const data = await moduleApi.listDiscovered();
        setDiscoveredNodes(data?.nodes || []);
      } catch (err) {
        console.warn('Onboarding: Failed to fetch discovered nodes', err);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [step]);

  if (!isOpen) return null;

  // Step 1: create the module
  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Module name is required');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const data = await moduleApi.createModule({
        name: formData.name.trim(),
        description: formData.description.trim() || 'Sistem Pertumbuhan Aeroponik',
        config: '{}',
      });
      setCreatedModuleId(data.id);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to create module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Step 2: pair a discovered node into the created module
  const handlePairNode = async (node) => {
    setIsSaving(true);
    setError('');
    try {
      await moduleApi.pairNode(node.node_id, { module_id: createdModuleId, name: node.name || node.node_id });
      onFinish?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to pair node to this module');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg border border-emerald-500/25 bg-[#030705]/95 overflow-hidden relative">
        <div className="absolute -top-[20%] -right-[20%] w-[60%] h-[60%] bg-emerald-500/10 blur-[90px] pointer-events-none" />

        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Layers className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">System Setup Wizard</h3>
              <p className="text-[10px] text-slate-400">Buat module lalu pair perangkat hardware</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white text-[10px] font-bold uppercase transition-all cursor-pointer"
          >
            <SkipForward className="w-3 h-3" /> Skip
          </button>
        </div>

        {/* Progress */}
        <div className="w-full bg-slate-950 h-1 flex">
          <div className={`h-full bg-emerald-500 transition-all duration-300 ${step === 1 ? 'w-1/2' : 'w-full'}`} />
        </div>

        <div className="p-6">
          {step === 1 ? (
            <form onSubmit={handleCreateModule} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 flex items-center justify-center bg-emerald-500 text-black text-[10px] font-black">1</span>
                <span className="text-xs font-black text-slate-300 uppercase tracking-wider">Create Module</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Module adalah kontainer konfigurasi untuk sekelompok node. Buat module pertamamu.
              </p>

              <div>
                <label className="block text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">Module Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Greenhouse-01, Box Aeroponik A"
                  className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Lokasi, jenis tanaman, atau spesifikasi setup"
                  className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 h-20 resize-none"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-emerald-500 text-black text-xs font-black uppercase tracking-wider hover:bg-emerald-400 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save Module & Continue <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 flex items-center justify-center bg-emerald-500 text-black text-[10px] font-black">2</span>
                <span className="text-xs font-black text-slate-300 uppercase tracking-wider">Pair Hardware Controller</span>
              </div>

              <div className="p-4 border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
                <Radio className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-[11px] text-slate-300 leading-relaxed">
                  <p className="font-bold text-white uppercase tracking-wider mb-1">Instruksi ESP32:</p>
                  1. Nyalakan perangkat ESP32.<br />
                  2. Tekan tombol <strong>RESET</strong>, atau klik <strong>"Send Discovery Signal"</strong> di portal konfigurasi lokal ESP32.<br />
                  3. Perangkat akan mengirim sinyal discovery. Biarkan layar ini terbuka.
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-6 border border-dashed border-emerald-500/15 bg-slate-950/40 relative">
                {isSearching && discoveredNodes.length === 0 ? (
                  <>
                    <div className="relative w-12 h-12 mb-3">
                      <div className="absolute inset-0 border border-emerald-500/20 animate-ping" />
                      <div className="absolute inset-2 border border-emerald-500/40 animate-pulse" />
                      <div className="absolute inset-4 bg-emerald-500/10 flex items-center justify-center">
                        <Network className="w-4 h-4 text-emerald-400" />
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
                      Mencari sinyal hardware...
                    </span>
                  </>
                ) : null}

                {discoveredNodes.length > 0 && (
                  <div className="w-full px-4 space-y-3">
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block text-center mb-1">
                      {discoveredNodes.length} Device Terdeteksi!
                    </span>
                    <div className="max-h-40 overflow-y-auto space-y-2 w-full">
                      {discoveredNodes.map(node => (
                        <div key={node.node_id} className="flex justify-between items-center p-3 bg-slate-900 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-white truncate">{node.node_id}</span>
                            <span className="text-[9px] font-mono text-slate-500 mt-0.5">IP: {node.ip || 'DHCP'} | FW: {node.fw_version || '-'}</span>
                          </div>
                          <button
                            onClick={() => handlePairNode(node)}
                            disabled={isSaving}
                            className="px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-black bg-emerald-500 hover:bg-emerald-400 transition-all flex items-center gap-1 active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" /> Pair & Launch
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
