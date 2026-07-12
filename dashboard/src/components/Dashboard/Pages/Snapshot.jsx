import { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Trash2,
  Loader2,
  Film,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';
import PageHeader from './PageHeader';
import streamApi from '../../../api/stream';

function canManage() {
  try {
    const u = JSON.parse(sessionStorage.getItem('user') || 'null');
    const roles = Array.isArray(u?.roles) ? u.roles : [];
    return roles.includes('admin') || roles.includes('operator');
  } catch {
    return false;
  }
}

function formatTime(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '';
  }
}

export default function Snapshot() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(''); // '' | 'snapshot' | 'recording'
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await streamApi.listSnapshots(filter || undefined);
      setItems(Array.isArray(data?.snapshots) ? data.snapshots : []);
    } catch (e) {
      setError(e?.message || 'Failed to load snapshots');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const manage = canManage();

  const handleDelete = async (id) => {
    if (!confirm('Delete this snapshot?')) return;
    setBusyId(id);
    try {
      await streamApi.deleteSnapshot(id);
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to delete');
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    all: items.length,
    snapshot: items.filter((i) => i.kind === 'snapshot').length,
    recording: items.filter((i) => i.kind === 'recording').length,
  };

  const tabs = [
    { id: '', label: 'ALL', icon: ImageIcon },
    { id: 'snapshot', label: 'SNAPSHOT', icon: Camera },
    { id: 'recording', label: 'RECORDING', icon: Film },
  ];

  return (
    <div className="space-y-4">
      <PageHeader icon={Camera} title="SNAPSHOT & RECORDING" subtitle="Captured frames stored in MinIO (stream bucket)">
        <button
          onClick={load}
          className="h-10 px-3 flex items-center gap-2 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-xs font-black uppercase tracking-widest"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </PageHeader>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = filter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`flex items-center gap-2 px-4 h-10 border text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-emerald-500 text-black border-emerald-500' : 'border-emerald-500/15 text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${active ? 'bg-black/20' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {t.id === '' ? counts.all : counts[t.id]}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm font-bold border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs font-black uppercase tracking-widest">Loading snapshots…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 border border-emerald-500/10 bg-[#030705]/60">
          <Camera className="w-12 h-12 text-slate-600" />
          <div className="text-center">
            <div className="text-sm font-black uppercase tracking-widest text-slate-300">No Captures Yet</div>
            <div className="text-xs text-slate-500 mt-1">Open LIVE and use the camera button to capture a frame.</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((s) => (
            <div key={s.id} className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md overflow-hidden flex flex-col">
              <div className="relative aspect-video bg-black">
                <img
                  src={s.url}
                  alt={s.stream_name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border ${s.kind === 'recording' ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'}`}>
                  {s.kind === 'recording' ? <Film className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                  {s.kind}
                </span>
              </div>

              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-wide text-white truncate">{s.stream_name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{formatTime(s.created_at)}</div>
                </div>
                {manage && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={busyId === s.id}
                    className="h-8 w-8 shrink-0 flex items-center justify-center border border-red-500/20 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    title="Delete"
                  >
                    {busyId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
