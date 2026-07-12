import { useState, useEffect, useCallback } from 'react';
import {
  Video,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  X,
  Save,
  Radio,
  WifiOff,
  CircleDot,
  Circle,
  Square,
  Camera,
  EyeOff,
  LayoutGrid,
  AlertTriangle
} from 'lucide-react';
import PageHeader from './PageHeader';
import streamApi from '../../../api/stream';

// ─── Role helpers ──────────────────────────────────────────────────────────────
function currentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}
function canManage() {
  const u = currentUser();
  const roles = Array.isArray(u?.roles) ? u.roles : [];
  return roles.includes('admin') || roles.includes('operator');
}

// ─── MediaMTX player (iframe) ──────────────────────────────────────────────────
// Embeds MediaMTX's own HLS/WebRTC player page exactly like the Aeroponik-Docker
// dashboard does (iframe → /live/{name}/, proxied by Vite/Kong to mediamtx:8888).
// This avoids the fragile CDN hls.js dependency that left the feed blank.
function MtxPlayer({ name, enabled }) {
  const [failed, setFailed] = useState(false);

  if (!enabled) {
    return (
      <div className="relative w-full aspect-video bg-black flex flex-col items-center justify-center gap-2">
        <EyeOff className="w-8 h-8 text-slate-500" />
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Disabled</span>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="relative w-full aspect-video bg-black flex flex-col items-center justify-center gap-2">
        <WifiOff className="w-8 h-8 text-slate-500" />
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Player Unavailable</span>
      </div>
    );
  }

  return (
    <iframe
      src={`/live/${encodeURIComponent(name)}/`}
      title={name}
      allowFullScreen
      onError={() => setFailed(true)}
      className="w-full h-full border-0 bg-black"
      style={{ aspectRatio: '16 / 9' }}
    />
  );
}

// ─── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status, enabled }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-500/15 border border-slate-500/30 text-slate-400 text-[10px] font-black uppercase tracking-widest">
        <EyeOff className="w-3 h-3" /> Disabled
      </span>
    );
  }
  const live = ['running', 'ready', 'waiting'].includes(status);
  if (live) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
        <Circle className="w-3 h-3 animate-pulse fill-current" />
        Live
      </span>
    );
  }
  const label = status === 'idle' ? 'Idle' : (status || 'Unknown');
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest">
      <CircleDot className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Stream card ───────────────────────────────────────────────────────────────
function StreamCard({ stream, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [flash, setFlash] = useState(null); // { type: 'ok'|'err', msg }

  const notify = (msg, type) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 2600);
  };

  const handleCapture = async () => {
    setBusy(true);
    try {
      await streamApi.captureSnapshot(stream.id);
      notify('Snapshot saved to MinIO', 'ok');
    } catch (e) {
      notify(e?.message || 'Capture failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleRecord = async () => {
    setBusy(true);
    try {
      if (recording) {
        await streamApi.stopRecording(stream.id);
        setRecording(false);
        notify('Recording stopped & cover saved', 'ok');
      } else {
        await streamApi.startRecording(stream.id);
        setRecording(true);
        notify('Recording started', 'ok');
      }
    } catch (e) {
      notify(e?.message || 'Recording failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md overflow-hidden flex flex-col">
      {/* Title bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-emerald-500/10">
        <div className="flex items-center gap-2 min-w-0">
          <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-black text-white truncate uppercase tracking-wide">{stream.name}</div>
            {stream.device_label && (
              <div className="text-[10px] text-slate-400 truncate">{stream.device_label}</div>
            )}
          </div>
        </div>
        <StatusPill status={stream.status} enabled={stream.enabled} />
      </div>

      {/* Player */}
      <MtxPlayer name={stream.name} enabled={stream.enabled} />

      {/* Capture / Record flash */}
      {flash && (
        <div className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-t border-emerald-500/10 ${flash.type === 'ok' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
          {flash.msg}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-emerald-500/10">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          MediaMTX Player
        </div>

        <div className="flex items-center gap-1.5">
          {canManage() && (
            <>
              <button
                onClick={handleCapture}
                disabled={busy}
                className="h-8 w-8 flex items-center justify-center border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                title="Capture Snapshot"
              >
                <Camera className="w-4 h-4" />
              </button>
              <button
                onClick={handleRecord}
                disabled={busy}
                className={`h-8 w-8 flex items-center justify-center border disabled:opacity-50 ${recording ? 'border-red-500/40 text-red-400 bg-red-500/10 animate-pulse' : 'border-emerald-500/20 text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                title={recording ? 'Stop Recording' : 'Start Recording'}
              >
                {recording ? <Square className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => onEdit(stream)}
                className="h-8 w-8 flex items-center justify-center border border-emerald-500/20 text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(stream)}
                className="h-8 w-8 flex items-center justify-center border border-red-500/20 text-red-400 hover:bg-red-500/10"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="px-3 py-2 border-t border-emerald-500/10 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <div className="text-slate-500 uppercase tracking-widest">Location</div>
        <div className="text-slate-300 truncate text-right">{stream.location || '—'}</div>
        <div className="text-slate-500 uppercase tracking-widest">Source</div>
        <div className="text-slate-400 truncate text-right font-mono" title={stream.source_rtsp}>{stream.source_rtsp || '—'}</div>
      </div>
    </div>
  );
}

// ─── Stream form modal (create / edit) ───────────────────────────────────────
function StreamFormModal({ initial, onSubmit, onClose, busy }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name || '',
    device_label: initial?.device_label || '',
    location: initial?.location || '',
    source_rtsp: initial?.source_rtsp || '',
    enabled: initial?.enabled ?? true,
  });
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setEnabled = (e) => setForm((f) => ({ ...f, enabled: e.target.checked }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    const body = {
      name: form.name.trim(),
      device_label: form.device_label.trim(),
      location: form.location.trim(),
    };
    if (form.source_rtsp.trim()) body.source_rtsp = form.source_rtsp.trim();
    if (isEdit) {
      body.enabled = form.enabled;
    }
    try {
      await onSubmit(body);
    } catch (err) {
      setError(err?.message || 'Request failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md border border-emerald-500/20 bg-[#030705] p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400">
            {isEdit ? 'Edit Stream' : 'Add CCTV Stream'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Path Name *</span>
          <input
            value={form.name}
            onChange={set('name')}
            placeholder="cctv-1"
            className="mt-1 w-full bg-black/40 border border-emerald-500/15 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
          />
          {isEdit && <span className="text-[10px] text-slate-500">Renaming re-registers the MediaMTX path under the new name (same source).</span>}
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Device Label</span>
          <input
            value={form.device_label}
            onChange={set('device_label')}
            placeholder="Greenhouse Cam A"
            className="mt-1 w-full bg-black/40 border border-emerald-500/15 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</span>
          <input
            value={form.location}
            onChange={set('location')}
            placeholder="Sector 1"
            className="mt-1 w-full bg-black/40 border border-emerald-500/15 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Source RTSP</span>
          <input
            value={form.source_rtsp}
            onChange={set('source_rtsp')}
            placeholder="rtsp://… (empty = default CCTV)"
            className="mt-1 w-full bg-black/40 border border-emerald-500/15 px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500/50"
          />
          <span className="text-[10px] text-slate-500">
            {isEdit
              ? 'Changing the source re-registers the MediaMTX path. Leave empty to keep the current source.'
              : 'Leave empty to use the server default CCTV_RTSP_URL.'}
          </span>
        </label>

        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={setEnabled} className="accent-emerald-500 w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-300">Enabled</span>
          </label>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs font-bold border border-red-500/30 bg-red-500/10 px-3 py-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 h-9 border border-white/10 text-slate-300 hover:bg-white/5 text-xs font-black uppercase tracking-widest">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 h-9 bg-emerald-500 text-black hover:bg-emerald-400 text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDelete({ stream, onConfirm, onClose, busy }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm border border-red-500/20 bg-[#030705] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-red-400">
          <Trash2 className="w-5 h-5" />
          <h3 className="text-sm font-black uppercase tracking-widest">Delete Stream</h3>
        </div>
        <p className="text-sm text-slate-300">
          Unregister <span className="font-black text-white">{stream.name}</span>? This stops the MediaMTX path and removes the database record.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-9 border border-white/10 text-slate-300 hover:bg-white/5 text-xs font-black uppercase tracking-widest">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 h-9 bg-red-500 text-white hover:bg-red-400 text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function LiveView() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await streamApi.list();
      setStreams(Array.isArray(data?.streams) ? data.streams : []);
    } catch (e) {
      setError(e?.message || 'Failed to load streams');
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const manage = canManage();

  const handleCreate = async (body) => {
    setBusy(true);
    try {
      await streamApi.create(body);
      setFormOpen(false);
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (body) => {
    setBusy(true);
    try {
      await streamApi.update(editing.id, body);
      setFormOpen(false);
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await streamApi.remove(deleting.id);
      setDeleting(null);
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to delete stream');
    } finally {
      setBusy(false);
    }
  };

  const liveCount = streams.filter((s) => ['running', 'ready', 'waiting'].includes(s.status) && s.enabled).length;

  const openEdit = (s) => {
    setEditing(s);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader icon={Video} title="LIVE CCTV" subtitle="Monitor CCTV streams via MediaMTX (embedded player)">
        <button
          onClick={load}
          className="h-10 px-3 flex items-center gap-2 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-xs font-black uppercase tracking-widest"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        {manage && (
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="h-10 px-4 flex items-center gap-2 bg-emerald-500 text-black hover:bg-emerald-400 text-xs font-black uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" /> Add Stream
          </button>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={LayoutGrid} label="Streams" value={streams.length} />
        <StatCard icon={Circle} label="Live" value={liveCount} color="emerald" />
        <StatCard icon={CircleDot} label="Idle" value={streams.length - liveCount} color="amber" />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm font-bold border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs font-black uppercase tracking-widest">Loading streams…</span>
        </div>
      ) : streams.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 border border-emerald-500/10 bg-[#030705]/60">
          <Video className="w-12 h-12 text-slate-600" />
          <div className="text-center">
            <div className="text-sm font-black uppercase tracking-widest text-slate-300">No Streams Yet</div>
            <div className="text-xs text-slate-500 mt-1">Register a CCTV source to start monitoring.</div>
          </div>
          {manage && (
            <button
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="px-4 h-10 bg-emerald-500 text-black hover:bg-emerald-400 text-xs font-black uppercase tracking-widest flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Stream
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {streams.map((s) => (
            <StreamCard key={s.id} stream={s} onEdit={openEdit} onDelete={(st) => setDeleting(st)} />
          ))}
        </div>
      )}

      {formOpen && (
        <StreamFormModal
          initial={editing}
          busy={busy}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSubmit={editing ? handleUpdate : handleCreate}
        />
      )}

      {deleting && (
        <ConfirmDelete stream={deleting} busy={busy} onClose={() => setDeleting(null)} onConfirm={handleDelete} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color = 'slate' }) {
  const ring = color === 'emerald' ? 'text-emerald-400' : color === 'amber' ? 'text-amber-400' : 'text-slate-300';
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 flex items-center gap-3">
      <div className="p-2 bg-emerald-500/10 border border-emerald-500/20">
        <Icon className={`w-5 h-5 ${ring}`} />
      </div>
      <div>
        <div className="text-lg font-black tabular-nums text-white">{value}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      </div>
    </div>
  );
}
