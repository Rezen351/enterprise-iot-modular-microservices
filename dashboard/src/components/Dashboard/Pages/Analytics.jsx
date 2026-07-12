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
import PageHeader from './PageHeader';
import analyticsApi from '../../../api/analytics';
import { moduleApi } from '../../../api/module';

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

// A metric is treated as a digital/boolean state when every sample is 0 or 1.
function isBooleanMetric(points) {
  if (!points || points.length === 0) return false;
  for (const p of points) {
    if (p.v !== 0 && p.v !== 1) return false;
  }
  return true;
}

function corrColor(v) {
  if (v >= 0) {
    const a = 0.15 + 0.6 * v;
    return `rgba(16,185,129,${a.toFixed(2)})`;
  }
  const a = 0.15 + 0.6 * -v;
  return `rgba(244,63,94,${a.toFixed(2)})`;
}

function Card({ title, icon: Icon, children }) {
  return (
    <div className="w-full border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-emerald-400" />
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-400">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</span>
      <span className="text-sm font-black tabular-nums text-slate-200">{value}</span>
    </div>
  );
}

function Analytics() {
  const [nodes, setNodes] = useState([]);
  const [nodeId, setNodeId] = useState('');
  const [range, setRange] = useState('1h');
  const [tags, setTags] = useState([]);

  const [seriesByMetric, setSeriesByMetric] = useState({});
  const [booleanSet, setBooleanSet] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (!nodeId) {
      setTags([]);
      return;
    }
    let active = true;
    moduleApi
      .getNodeTags(nodeId)
      .then((data) => {
        if (!active) return;
        setTags(Array.isArray(data?.tags) ? data.tags : []);
      })
      .catch((err) => {
        console.error('Failed to load node tags for analytics units', err);
      });
    return () => { active = false; };
  }, [nodeId]);

  const onNodeChange = (id) => setNodeId(id);

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
        metrics.map((m) =>
          analyticsApi.getMetrics({
            node_id: nodeId,
            metric: m,
            interval: range,
            // Digital/state metrics stay at raw 1-min resolution (never averaged)
            // so their on/off transitions survive wide ranges; analog metrics use
            // the hourly/daily continuous aggregates.
            ...(booleanSet.has(m) ? { discrete: true } : {}),
          })
        )
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
  }, [nodeId, nodes, range, booleanSet]);

  useEffect(() => { loadData(); }, [loadData]);

  // Classify each metric's *type* from the raw 1h view (range-independent),
  // so a boolean (0/1) metric stays boolean even on aggregated ranges where
  // the hourly/daily cagg would otherwise average it into a fraction (0.33).
  useEffect(() => {
    let cancelled = false;
    const node = nodeId ? nodes.find((n) => n.node_id === nodeId) : null;
    const metrics = node?.metrics || [];
    if (!metrics.length) {
      Promise.resolve().then(() => { if (!cancelled) setBooleanSet(new Set()); });
    } else {
      Promise.all(
        metrics.map((m) => analyticsApi.getMetrics({ node_id: nodeId, metric: m, interval: '1h' }))
      ).then((results) => {
        if (cancelled) return;
        const set = new Set();
        metrics.forEach((m, i) => {
          const pts = results[i]?.points || [];
          if (pts.length && pts.every((p) => p.v === 0 || p.v === 1)) set.add(m);
        });
        setBooleanSet(set);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [nodeId, nodes]);

  const metrics = Object.keys(seriesByMetric);
  const totalPoints = metrics.reduce((s, m) => s + seriesByMetric[m].length, 0);

  // Classify metrics as analog (continuous) or digital/boolean (0/1). The type
  // is decided from the raw 1h view above (booleanSet), so it is stable across
  // every selected range. Fall back to value-based detection until classified.
  const boolMetrics = metrics.filter((m) =>
    booleanSet.size ? booleanSet.has(m) : isBooleanMetric(seriesByMetric[m])
  );
  const analogMetrics = metrics.filter((m) => !boolMetrics.includes(m));
  const primaryMetrics = metrics.length ? metrics : [];
  const labels = primaryMetrics.length ? seriesByMetric[primaryMetrics[0]].map((p) => formatTick(p.t)) : [];

  // Analog trend data only (excluding digital metrics)
  const trendData = {
    labels,
    datasets: analogMetrics.map((m, i) => ({
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
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (c) => {
            const m = c.dataset.label;
            const tag = tags.find((t) => t.source_key === m || t.tag_name === m);
            const unit = tag?.unit ? ` ${tag.unit}` : '';
            return `${m}: ${fmt(c.parsed.y)}${unit}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: 'rgba(148,163,184,0.7)', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: 'rgba(148,163,184,0.7)' } },
    },
  };

  const stateData = {
    labels,
    datasets: boolMetrics.map((m, i) => ({
      label: m,
      data: seriesByMetric[m].map((p) => p.v),
      borderColor: PALETTE[i % PALETTE.length],
      backgroundColor: PALETTE[i % PALETTE.length] + '22',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      stepped: true,
      fill: false,
    })),
  };

  const stateOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: 'rgba(148,163,184,0.9)', boxWidth: 12, font: { size: 10 } } },
      tooltip: { mode: 'index', intersect: false, callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y ? 'ON' : 'OFF'}` } },
    },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: 'rgba(148,163,184,0.7)', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { min: 0, max: 1, ticks: { color: 'rgba(148,163,184,0.7)', stepSize: 1, callback: (v) => (v === 1 ? 'ON' : 'OFF') } },
    },
  };

  const selectedNode = nodes.find((n) => n.node_id === nodeId);

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
      <PageHeader icon={BarChart3} title="Analytics" subtitle="Aggregated telemetry from the Analytics Service — all metrics, one view.">
        <select
          value={nodeId}
          onChange={(e) => onNodeChange(e.target.value)}
          disabled={nodes.length === 0}
          title={selectedNode?.module_id ? `module: ${selectedNode.module_id}` : undefined}
          className="h-10 px-3 text-xs font-black uppercase tracking-widest bg-[#040e0a] border border-emerald-500/20 text-slate-200 cursor-pointer focus:outline-none focus:border-emerald-500/60"
        >
          {nodes.length === 0 && <option value="">No nodes</option>}
          {nodes.map((n) => (
            <option key={n.node_id} value={n.node_id}>
              {shortId(n.node_id)}{n.module_id ? ` · ${shortId(n.module_id)}` : ''}
            </option>
          ))}
        </select>

        <div className="flex bg-[#040e0a] p-1 border border-emerald-500/20 h-10 items-center shrink-0">
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
      </PageHeader>

      {error && (
        <div className="flex items-center gap-3 p-4 border border-red-500/30 bg-red-950/15 text-red-400">
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
          {/* Combined trend: analog on the left axis, digital/boolean (step
              "state" lines, 0/1) on the right axis — one chart, not split. */}
          <Card title={`Trends · ${range}`} icon={LineChart}>
            <div className="h-[360px]">
              <Line data={trendData} options={trendOptions} />
            </div>

          </Card>

          {/* Dedicated state graph for boolean/digital metrics, below the trend */}
          {boolMetrics.length > 0 && (
            <Card title={`Digital states · ${range}`} icon={Activity}>
              <div className="h-[220px]">
                <Line data={stateData} options={stateOptions} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                {boolMetrics.map((m) => {
                  const pts = seriesByMetric[m];
                  const on = pts.filter((p) => p.v === 1).length;
                  const pct = pts.length ? Math.round((on / pts.length) * 100) : 0;
                  return (
                    <div key={m} className="flex flex-col gap-1 p-3 border border-emerald-500/15 bg-[#030705]/60">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">{m}</span>
                      <span className="text-sm font-black" style={{ color: on > 0 ? '#10b981' : '#64748b' }}>
                        {on > 0 ? 'ON' : 'OFF'} · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Per-metric summary (analog) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {analogMetrics.map((m) => {
              const s = statsOf(seriesByMetric[m]);
              const tag = tags.find((t) => t.source_key === m || t.tag_name === m);
              const unit = tag?.unit ? ` ${tag.unit}` : '';
              return (
                <Card key={m} title={m} icon={Activity}>
                  <div className="grid grid-cols-4 gap-3">
                    <StatChip label="Samples" value={s.count} />
                    <StatChip label="Min" value={fmt(s.min) + unit} />
                    <StatChip label="Avg" value={fmt(s.avg) + unit} />
                    <StatChip label="Max" value={fmt(s.max) + unit} />
                    <StatChip label="Last" value={fmt(s.last) + unit} />
                  </div>
                </Card>
              );
            })}
          </div>

          <Card title="Distributions (histogram per analog metric)" icon={BarChart2}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {analogMetrics.map((m, i) => {
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
                    <div className="text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">{m}</div>
                    <div className="h-[180px]">
                      {h.counts.length ? <Bar data={data} options={opt} /> : <div className="text-xs text-slate-500">no data</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Correlation matrix (Pearson)" icon={Grid3x3}>
            {corr ? (
              <div className="overflow-x-auto">
                <table className="border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">metric</th>
                      {corr.metrics.map((m) => (
                        <th key={m} className="p-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{shortId(m)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corr.metrics.map((mi, i) => (
                      <tr key={mi}>
                        <td className="p-2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap text-slate-500">{shortId(mi)}</td>
                        {corr.metrics.map((mj, j) => {
                          const v = corr.matrix[i][j];
                          return (
                            <td
                              key={mj}
                              className="p-2 text-center font-black tabular-nums whitespace-nowrap"
                              style={{ backgroundColor: corrColor(v), color: Math.abs(v) > 0.5 ? '#0b0f0a' : '#e2e8f0' }}
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
                <div className="flex items-center gap-3 mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block" style={{ backgroundColor: 'rgba(244,63,94,0.7)' }} /> -1</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block" style={{ backgroundColor: 'rgba(148,163,184,0.4)' }} /> 0</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block" style={{ backgroundColor: 'rgba(16,185,129,0.7)' }} /> +1</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Need at least 2 metrics to compute correlation.</div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default Analytics;
