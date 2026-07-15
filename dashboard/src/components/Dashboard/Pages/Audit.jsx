import { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  RefreshCw,
  Search,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import PageHeader from './PageHeader';
import { listAuditLogs } from '../../../api/audit';

const PAGE_SIZES = [25, 50, 100];

// Common event prefixes — quick filters that map to a prefix match on `event`.
const QUICK_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Auth', value: 'auth' },
  { label: 'Module', value: 'module' },
  { label: 'Node', value: 'node' },
  { label: 'Control', value: 'control' },
];

function canView() {
  try {
    const u = JSON.parse(sessionStorage.getItem('user') || 'null');
    const roles = Array.isArray(u?.roles) ? u.roles : [];
    // Audit log is sensitive — only admins may read it (enforced by the API).
    return roles.includes('admin');
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

function prettyJSON(value) {
  if (!value) return '';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

// Color-code the event group for quick scanning.
function eventBadgeClass(event = '') {
  if (event.startsWith('auth')) return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  if (event.startsWith('module')) return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
  if (event.startsWith('node')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (event.startsWith('control')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
}

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [event, setEvent] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listAuditLogs({ limit, offset, event, search });
      const payload = res?.data ?? {};
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      setTotal(typeof payload.total === 'number' ? payload.total : 0);
    } catch (err) {
      setError(err?.message || 'Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, event, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Optional auto-refresh to watch live audit events stream in.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(), 10000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const goPrev = () => setOffset((o) => Math.max(0, o - limit));
  const goNext = () => setOffset((o) => Math.min(Math.max(0, total - limit), o + limit));

  if (!canView()) {
    return (
      <div className="border border-red-500/20 bg-red-500/5 p-6 text-red-300">
        You do not have permission to view the audit log.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ScrollText}
        title="Audit Log"
        subtitle="Immutable system activity stream — consumed from the audit event bus."
      >
        <label className="hidden sm:flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="accent-emerald-500 w-4 h-4"
          />
          Live
        </label>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 h-10 bg-emerald-500 text-black font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="border border-emerald-500/15 bg-[#030705]/60 p-3 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 h-10 bg-black/30 border border-emerald-500/20 focus-within:border-emerald-500/50">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              placeholder="Search payload (node_id, value, by…)"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <div className="flex items-center gap-2 px-3 h-10 bg-black/30 border border-emerald-500/20 focus-within:border-emerald-500/50">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              value={event}
              onChange={(e) => { setEvent(e.target.value); setOffset(0); }}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              placeholder="Event prefix (auth, control…)"
              className="w-40 bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((f) => {
            const active = event === f.value;
            return (
              <button
                key={f.label}
                onClick={() => { setEvent(f.value); setOffset(0); }}
                className={`px-3 h-8 text-[11px] font-black uppercase tracking-widest border transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-black border-emerald-500'
                    : 'bg-slate-500/5 text-slate-400 border-slate-500/20 hover:border-emerald-500/40 hover:text-emerald-400'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="border border-emerald-500/15 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-500/5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <th className="text-left px-4 py-3 whitespace-nowrap">Event</th>
                <th className="text-left px-4 py-3">Payload</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Received At</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                    Loading audit log…
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-slate-500">
                    No audit records found.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-emerald-500/10 hover:bg-emerald-500/5 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-1 text-[11px] font-black uppercase tracking-wide border ${eventBadgeClass(l.event)}`}>
                      {l.event}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all font-mono bg-black/30 border border-emerald-500/10 p-2 max-w-full overflow-x-auto">
                      {prettyJSON(l.payload)}
                    </pre>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-400 text-xs">
                    {formatTime(l.received_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            {total === 0 ? '0 records' : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
          </span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
            className="bg-black/30 border border-emerald-500/20 text-white px-2 h-8 outline-none"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={offset === 0}
            className="flex items-center gap-1 px-3 h-9 border border-emerald-500/20 text-slate-300 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-black uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-xs text-slate-400 px-2">Page {page} / {totalPages}</span>
          <button
            onClick={goNext}
            disabled={offset + limit >= total}
            className="flex items-center gap-1 px-3 h-9 border border-emerald-500/20 text-slate-300 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-black uppercase tracking-widest"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
