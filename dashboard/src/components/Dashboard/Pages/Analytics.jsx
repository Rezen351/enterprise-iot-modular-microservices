import { useState, useEffect, useCallback } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  BarChart3,
  Activity,
  Loader2,
  AlertTriangle,
  Database,
  LineChart,
  BarChart2,
  Grid3x3,
} from 'lucide-react';
import analyticsApi from '../../../api/analytics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const RANGES = [
  { id: '1h', label: '1 HOUR' },
  { id: '6h', label: '6 HOURS' },
  { id: '24h', label: '24 HOURS' },
  { id: '7d', label: '7 DAYS' },
  { id: '30d', label: '30 DAYS' },
];

const PALETTE = [
  '#10b981', '#06b6d4', '#f59e0b', '#a855f7',
  '#f43f5e', '#3b82f6', '#eab308', '#ec4899',
];

const ACCENT = '#10b981';

function shortId(id) {
  if (!id) return id;
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function formatTick(t) {
  const d = new Date(t);
  if (isNaN(d)) return t;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmt(v, decimals = 2) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Number(v).toFixed(decimals);
}

// ─── stats / histogram / correlation helpers ────────────────────────────
function statsOf(points) {
  if (!points.length) return { count: 0, min: NaN, max: NaN, avg: NaN, last: NaN };
  let min = Infinity, max = -Infinity, sum = 0;
  for (const p of points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
    sum += p.v;
  }
  return { count: points.length, min, max, avg: sum / points.length, last: points[points.length - 1].v };
}

function histogram(values, bins = 10) {
  if (values.length === 0) return { labels: [], counts: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { labels: [min.toFixed(1)], counts: [values.length] };
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    let i = Math.floor((v - min) / width);
    if (i >= bins) i = bins - 1;
    if (i < 0) i = 0;
    counts[i]++;
  }
  const labels = counts.map((_, i) => (min + i * width).toFixed(1));
  return { labels, counts };
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

function corrColor(v) {
  // -1 (red) → 0 (slate) → +1 (emerald)
  if (v >= 0) {
    const a = 0.15 + 0.6 * v;
    return `rgba(16,185,129,${a.toFixed(2)})`;
  }
  const a = 0.15 + 0.6 * -v;
  return `rgba(244,63,94,${a.toFixed(2)})`;
}

// ─── small presentational bits ─────────────────────────────────────────
function StatChip({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-black tabular-nums" style={{ color: 'var(--text-main)' }}>{value}</span>
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <div className="w-full border p-3 sm:p-4" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-400">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Analytics() {
  const [nodes, setNodes] = useState([]);
  const [nodeId, setNodeId] = useState('');
  const [range, setRange] = useState('1h');

  const [seriesByMetric, setSeriesByMetric] = useState({}); // metric -> [{t,v}]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load nodes once.
  useEffect(() => {
    let active = true;
    analyticsApi
      .listNodes()
      .then((data) => {
        if (!active) return;
        const list = data?.nodes || [];
        setNodes(list);
        if (list.length > 0) setNodeId(list[0].node_id);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load nodes');
      });
    return () => { active = false; };
  }, []);

  const onNodeChange = (id) => setNodeId(id);

  // Fetch every metric for the selected node in parallel.
  const loadData = useCallback(async () => {
    if (!nodeId) {
      setSeriesByMetric({});
      return;
    }
    const node = nodes.find((n) => n.node_id === nodeId);
    const metrics = node?.metrics || [];
    if (metrics.length === 0) {
      setSeriesByMetric({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        metrics.map((m) => analyticsApi.getMetrics({ node_id: nodeId, metric: m, interval: range }))
      );
      const map = {};
      metrics.forEach((m, i) => { map[m] = results[i]?.points || []; });
      setSeriesByMetric(map);
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
      setSeriesByMetric({});
    } finally {
      setLoading(false);
    }
  }, [nodeId, nodes, range]);

  useEffect(() => { loadData(); }, [loadData]);

  const metrics = Object.keys(seriesByMetric);
  const totalPoints = metrics.reduce((s, m) => s + seriesByMetric[m].length, 0);
  const labels = metrics.length ? seriesByMetric[metrics[0]].map((p) => formatTick(p.t)) : [];

  // Multi-line trend (all metrics on one chart).
  const trendData = {
    labels,
    datasets: metrics.map((m, i) => ({
      label: m,
      data: seriesByMetric[m].map((p) => p.v),
      borderColor: PALETTE[i % PALETTE.length],
      backgroundColor: PALETTE[i % PALETTE.length] + '22',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: false,
    })),
  };

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: 'rgba(148,163,184,0.9)', boxWidth: 12, font: { size: 10 } } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: 'rgba(148,163,184,0.7)', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: 'rgba(148,163,184,0.7)' } },
    },
  };

  const selectedNode = nodes.find((n) => n.node_id === nodeId);

  // Correlation matrix over aligned series.
  const corr = (() => {
    const n = metrics.length;
    if (n < 2) return null;
    const matrix = metrics.map((mi) =>
      metrics.map((mj) => {
        const a = seriesByMetric[mi].map((p) => p.v);
        const b = seriesByMetric[mj].map((p) => p.v);
        const len = Math.min(a.length, b.length);
        return pearson(a.slice(0, len), b.slice(0, len));
      })
    );
    return { metrics, matrix };
  })();

  return (
    <div className="flex flex-col gap-4 w-full animate-fadeIn">
      {/* Header */}
      <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full xl:w-auto xl:flex-1 min-w-0">
          <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-wide uppercase truncate">Analytics</h2>
            <p className="hidden sm:block text-slate-400 text-xs sm:text-sm mt-1 font-medium truncate sm:whitespace-normal">
              Aggregated telemetry from the Analytics Service — all metrics, one view.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row xl:items-center gap-3 w-full xl:w-auto">
          <select
            value={nodeId}
            onChange={(e) => onNodeChange(e.target.value)}
            disabled={nodes.length === 0}
            title={selectedNode?.module_id ? `module: ${selectedNode.module_id}` : undefined}
            className="h-10 px-3 text-xs font-black uppercase tracking-widest bg-slate-950/40 border cursor-pointer"
            style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
          >
            {nodes.length === 0 && <option value="">No nodes</option>}
            {nodes.map((n) => (
              <option key={n.node_id} value={n.node_id}>
                {shortId(n.node_id)}{n.module_id ? ` · ${shortId(n.module_id)}` : ''}
              </option>
            ))}
          </select>

          <div className="flex bg-slate-950/40 p-1 border h-10 items-center shrink-0" style={{ borderColor: 'var(--border-main)' }}>
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`h-full flex-1 sm:flex-initial px-3 text-[10px] sm:text-[11px] font-black tracking-widest transition-all duration-200 cursor-pointer select-none ${range === r.id ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 border text-red-400" style={{ borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.08)' }}>
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 min-h-[300px] text-emerald-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs font-black tracking-widest uppercase">Loading analytics…</span>
        </div>
      )}

      {!loading && !error && nodes.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 min-h-[300px] text-slate-400">
          <Database className="w-10 h-10 opacity-40" />
          <span className="text-sm font-bold">No telemetry yet</span>
          <span className="text-xs text-slate-500 max-w-md text-center">
            Analytics ingests <code>telemetry.batch</code> from the Module Service. Once a paired node
            reports sensor data, it will appear here automatically.
          </span>
        </div>
      )}

      {!loading && nodes.length > 0 && totalPoints === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 min-h-[300px] text-slate-400">
          <Activity className="w-10 h-10 opacity-40" />
          <span className="text-sm font-bold">No data for this range</span>
          <span className="text-xs text-slate-500">Try a wider time range.</span>
        </div>
      )}

      {!loading && totalPoints > 0 && (
        <>
          {/* Multi-metric trend */}
          <Panel title={`Trends · all metrics · ${range}`} icon={LineChart}>
            <div className="h-[360px]">
              <Line data={trendData} options={trendOptions} />
            </div>
          </Panel>

          {/* Per-metric summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map((m) => {
              const s = statsOf(seriesByMetric[m]);
              return (
                <Panel key={m} title={m} icon={Activity}>
                  <div className="grid grid-cols-4 gap-3">
                    <StatChip label="Samples" value={s.count} />
                    <StatChip label="Min" value={fmt(s.min)} />
                    <StatChip label="Avg" value={fmt(s.avg)} />
                    <StatChip label="Max" value={fmt(s.max)} />
                    <StatChip label="Last" value={fmt(s.last)} />
                  </div>
                </Panel>
              );
            })}
          </div>

          {/* Histograms */}
          <Panel title="Distributions (histogram per metric)" icon={BarChart2}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {metrics.map((m, i) => {
                const h = histogram(seriesByMetric[m].map((p) => p.v));
                const data = {
                  labels: h.labels,
                  datasets: [{
                    label: m,
                    data: h.counts,
                    backgroundColor: PALETTE[i % PALETTE.length] + 'cc',
                    borderColor: PALETTE[i % PALETTE.length],
                    borderWidth: 1,
                  }],
                };
                const opt = {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: 'rgba(148,163,184,0.7)', maxRotation: 45, autoSkip: true, maxTicksLimit: 6 } },
                    y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: 'rgba(148,163,184,0.7)', precision: 0 } },
                  },
                };
                return (
                  <div key={m}>
                    <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{m}</div>
                    <div className="h-[180px]">
                      {h.counts.length ? <Bar data={data} options={opt} /> : <div className="text-xs text-slate-500">no data</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Correlation */}
          <Panel title="Correlation matrix (Pearson)" icon={Grid3x3}>
            {corr ? (
              <div className="overflow-x-auto">
                <table className="border-collapse text-xs" style={{ color: 'var(--text-main)' }}>
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>metric</th>
                      {corr.metrics.map((m) => (
                        <th key={m} className="p-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{shortId(m)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corr.metrics.map((mi, i) => (
                      <tr key={mi}>
                        <td className="p-2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{shortId(mi)}</td>
                        {corr.metrics.map((mj, j) => {
                          const v = corr.matrix[i][j];
                          return (
                            <td
                              key={mj}
                              className="p-2 text-center font-black tabular-nums whitespace-nowrap"
                              style={{ backgroundColor: corrColor(v), color: Math.abs(v) > 0.5 ? '#0b0f0a' : 'var(--text-main)' }}
                              title={`${mi} ↔ ${mj}: ${v.toFixed(2)}`}
                            >
                              {v.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center gap-3 mt-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block" style={{ backgroundColor: 'rgba(244,63,94,0.7)' }} /> -1</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block" style={{ backgroundColor: 'rgba(148,163,184,0.4)' }} /> 0</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block" style={{ backgroundColor: 'rgba(16,185,129,0.7)' }} /> +1</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Need at least 2 metrics to compute correlation.</div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

export default Analytics;
