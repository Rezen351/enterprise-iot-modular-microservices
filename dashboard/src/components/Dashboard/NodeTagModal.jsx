import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Tags, X, Plus, Trash2, Save, Radio, AlertTriangle, RefreshCw, Check } from 'lucide-react';
import { API_BASE } from '../../api/client';
import { moduleApi } from '../../api/module';

function inferType(value) {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  return 'string';
}

// Recursively collect dot-paths to scalar values (supports nested telemetry).
function collectPaths(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      collectPaths(v, key, out);
    } else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
      out[key] = v;
    }
  }
}

function NodeTagModal({ node, onClose }) {
  const [tags, setTags] = useState([]);
  const [draft, setDraft] = useState({ source_key: '', tag_name: '', display_name: '', unit: '', data_type: 'float' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [detecting, setDetecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await moduleApi.getNodeTags(node.node_id);
      setTags(Array.isArray(data?.tags) ? data.tags : []);
    } catch (err) {
      setError(err.message || 'Failed to load tag mapping');
    }
  }, [node.node_id]);

  useEffect(() => { load(); }, [load]);

  // Detect available telemetry keys by sampling the live MQTT stream briefly.
  const handleDetect = () => {
    setDetecting(true);
    setError('');
    const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/ws/nodes/${encodeURIComponent(node.node_id)}/live`;
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setError('Failed to open live stream for detection.');
      setDetecting(false);
      return;
    }
    const found = {};
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      setDetecting(false);
      setTags(prev => {
        const existing = new Set(prev.map(t => t.source_key));
        const additions = Object.keys(found)
          .filter(k => !existing.has(k))
          .map(k => ({
            source_key: k,
            tag_name: k,
            display_name: k,
            unit: '',
            data_type: inferType(found[k]),
            enabled: true,
          }));
        return [...prev, ...additions];
      });
    }, 5000);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        if (payload && typeof payload === 'object') {
          collectPaths(payload, '', found);
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => { setError('Live stream error during detection.'); setDetecting(false); clearTimeout(timer); };
  };

  const handleAdd = () => {
    if (!draft.source_key.trim()) {
      setError('Source key (MQTT telemetry key) is required.');
      return;
    }
    setTags(prev => [...prev, {
      source_key: draft.source_key.trim(),
      tag_name: draft.tag_name.trim() || draft.source_key.trim(),
      display_name: draft.display_name.trim(),
      unit: draft.unit.trim(),
      data_type: draft.data_type,
      enabled: true,
    }]);
    setDraft({ source_key: '', tag_name: '', display_name: '', unit: '', data_type: 'float' });
    setError('');
  };

  const handleUpdate = (idx, field, value) => {
    setTags(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const handleRemove = (idx) => {
    setTags(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await moduleApi.saveNodeTags(node.node_id, tags.map(t => ({
        id: t.id,
        source_key: t.source_key,
        tag_name: t.tag_name,
        display_name: t.display_name,
        unit: t.unit,
        data_type: t.data_type,
        enabled: t.enabled,
      })));
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save tag mapping');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col border border-emerald-500/25 bg-[#030705]/95 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between gap-3 bg-[#050b08]/40">
          <div className="flex items-center gap-2 min-w-0">
            <Tags className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white truncate">
                Tag Mapping — <span className="text-emerald-400 font-mono">{node.node_id}</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-0.5 truncate">
                Attach MQTT key (dot-path, e.g. telemetry.modbus.cwt1.temp) → DB tag
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Add row */}
          <div className="p-3 border border-emerald-500/15 bg-emerald-500/5 space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              <Plus className="w-3.5 h-3.5" /> Attach new tag
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input
                value={draft.source_key}
                onChange={e => setDraft({ ...draft, source_key: e.target.value })}
                placeholder="MQTT key (e.g. telemetry.modbus.cwt1.temp)"
                className="bg-slate-900/50 border border-slate-700 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                value={draft.tag_name}
                onChange={e => setDraft({ ...draft, tag_name: e.target.value })}
                placeholder="DB tag (e.g. temperature)"
                className="bg-slate-900/50 border border-slate-700 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                value={draft.unit}
                onChange={e => setDraft({ ...draft, unit: e.target.value })}
                placeholder="Unit (e.g. °C)"
                className="bg-slate-900/50 border border-slate-700 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <select
                value={draft.data_type}
                onChange={e => setDraft({ ...draft, data_type: e.target.value })}
                className="bg-slate-900/50 border border-slate-700 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="float">float</option>
                <option value="int">int</option>
                <option value="bool">bool</option>
                <option value="string">string</option>
              </select>
            </div>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-black bg-emerald-500 hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add Row
            </button>
          </div>

          {/* Detect */}
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-400 border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {detecting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
            {detecting ? 'Detecting 5s...' : 'Detect keys from live stream'}
          </button>

          {/* Mapping table */}
          {tags.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-6 border border-dashed border-slate-800">
              Belum ada tag mapping. Klik "Detect" atau tambah manual.
            </p>
          ) : (
            <div className="overflow-x-auto border border-white/5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="pb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">MQTT Key</th>
                    <th className="pb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">DB Tag</th>
                    <th className="pb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Unit</th>
                    <th className="pb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
                    <th className="pb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">On</th>
                    <th className="pb-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((t, idx) => (
                    <tr key={t.id || idx} className="border-b border-white/5 last:border-0">
                      <td className="py-2 px-2">
                        <input value={t.source_key} onChange={e => handleUpdate(idx, 'source_key', e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-700 px-2 py-1.5 text-xs text-emerald-400 font-mono focus:outline-none focus:border-emerald-500" />
                      </td>
                      <td className="py-2 px-2">
                        <input value={t.tag_name} onChange={e => handleUpdate(idx, 'tag_name', e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                      </td>
                      <td className="py-2 px-2">
                        <input value={t.unit} onChange={e => handleUpdate(idx, 'unit', e.target.value)}
                          className="w-20 bg-slate-900/50 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                      </td>
                      <td className="py-2 px-2">
                        <select value={t.data_type} onChange={e => handleUpdate(idx, 'data_type', e.target.value)}
                          className="bg-slate-900/50 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                          <option value="float">float</option>
                          <option value="int">int</option>
                          <option value="bool">bool</option>
                          <option value="string">string</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input type="checkbox" checked={t.enabled} onChange={e => handleUpdate(idx, 'enabled', e.target.checked)} className="accent-emerald-500 w-4 h-4 cursor-pointer" />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => handleRemove(idx)}
                          className="p-1.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-colors cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 flex justify-end gap-3 bg-[#050b08]/40">
          <button onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50 transition-colors uppercase tracking-widest cursor-pointer">
            <Save className="w-3.5 h-3.5" /> {isSaving ? 'Saving...' : 'Save Mapping'}
          </button>
        </div>
      </div>
    </div>
  );
}, document.body);
}

export default NodeTagModal;
