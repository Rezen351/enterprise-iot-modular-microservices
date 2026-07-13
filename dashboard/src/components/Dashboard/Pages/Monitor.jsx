import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Cpu,
  Gauge,
  CalendarClock,
  Zap,
  Server,
  CircleDot,
  Radio,
} from 'lucide-react';
import PageHeader from './PageHeader';
import { API_BASE, getToken, request } from '../../../api/client';
import controlApi from '../../../api/control';
import { moduleApi } from '../../../api/module';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const HEALTH_ROWS = [
  { key: 'auth', label: 'Auth' },
  { key: 'module', label: 'Module' },
  { key: 'control', label: 'Control' },
  { key: 'stream', label: 'Stream' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'wsgateway', label: 'WS-Gateway' },
];

function getByPath(obj, path) {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function numericKeys(obj, prefix = '', out = []) {
  if (obj == null || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object') numericKeys(v, key, out);
    else if (typeof v === 'number' && Number.isFinite(v)) out.push(key);
  }
  return out;
}

function fmtCountdown(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

function AnimatedCircle({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="3" strokeDasharray="32 64" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function PulseCircle({ color, size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      <circle cx="12" cy="12" r="10" fill={color}>
        <animate attributeName="r" values="8;12;8" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function StatusDot({ connected }) {
  if (connected) {
    return (
      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 relative">
        <div className="w-4 h-4 rounded-full bg-emerald-400 animate-pulse" />
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-700/50 border border-slate-600/40">
      <div className="w-4 h-4 rounded-full bg-slate-500" />
    </div>
  );
}

function NodeTelemetryCard({ node, state }) {
  const connected = state?.status === 'open';
  const ip = node?.ip || node?.address || node?.host || '—';
  const lastSeen = state?.lastTs ? new Date(state.lastTs).toLocaleTimeString() : '—';

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <StatusDot connected={connected} />
          <div className="min-w-0">
            <div className="text-sm font-black uppercase tracking-wider text-white truncate">
              {node.name || node.node_id}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">{ip}</div>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-black uppercase tracking-wider border shrink-0 ${
          connected
            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
            : 'text-red-400 border-red-500/30 bg-red-500/10'
        }`}>
          {connected ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] border-t border-white/5 pt-2">
        <div>
          <span className="text-slate-500">Last seen</span>
          <div className="text-slate-300 font-mono">{lastSeen}</div>
        </div>
        <div>
          <span className="text-slate-500">Status WS</span>
          <div className={`font-bold ${connected ? 'text-emerald-300' : 'text-red-300'}`}>
            {state?.status || 'idle'}
          </div>
        </div>
      </div>
    </div>
  );
}

function Monitor() {
  const [nodes, setNodes] = useState([]);
  const [telemetry, setTelemetry] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [health, setHealth] = useState({});
  const [selectedNode, setSelectedNode] = useState('');
  const [mode, setMode] = useState(null);
  const [actuators, setActuators] = useState([]);
  const [nextSched, setNextSched] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');

  const [now, setNow] = useState(Date.now());
  const [throughput, setThroughput] = useState(0);
  const [history, setHistory] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('');

  const socketsRef = useRef({});
  const telemetryRef = useRef(telemetry);
  const msgCountRef = useRef(0);
  const selectedNodeRef = useRef(selectedNode);
  const selectedMetricRef = useRef(selectedMetric);

  useEffect(() => { telemetryRef.current = telemetry; }, [telemetry]);
  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);
  useEffect(() => { selectedMetricRef.current = selectedMetric; }, [selectedMetric]);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await request('/nodes', { auth: true, quiet: true });
      setNodes(Array.isArray(res?.nodes) ? res.nodes : []);
    } catch (e) {
      setError(e?.message || 'Failed to load nodes');
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNodes(); }, [loadNodes]);

  useEffect(() => {
    if (!selectedNode && nodes.length) setSelectedNode(nodes[0].node_id);
  }, [nodes, selectedNode]);

  useEffect(() => {
    const sockets = socketsRef.current;
    for (const id of Object.keys(sockets)) {
      if (!nodes.find((n) => n.node_id === id)) {
        try { sockets[id].close(); } catch { /* ignore */ }
        delete sockets[id];
        setTelemetry((prev) => { const next = { ...prev }; delete next[id]; return next; });
      }
    }

    const token = getToken() || '';
    for (const node of nodes) {
      const id = node.node_id;
      if (sockets[id]) continue;
      const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/ws/nodes/${encodeURIComponent(id)}/live?token=${encodeURIComponent(token)}`;
      let ws;
      try { ws = new WebSocket(wsUrl); } catch {
        setTelemetry((prev) => ({ ...prev, [id]: { status: 'error', error: 'WS init failed' } }));
        continue;
      }
      sockets[id] = ws;
      setTelemetry((prev) => ({ ...prev, [id]: { status: 'connecting' } }));

      ws.onopen = () => setTelemetry((prev) => ({ ...prev, [id]: { ...prev[id], status: 'open', error: '' } }));
      ws.onerror = () => setTelemetry((prev) => ({ ...prev, [id]: { ...prev[id], status: 'error', error: 'Connection error' } }));
      ws.onclose = () => setTelemetry((prev) => ({ ...prev, [id]: { ...prev[id], status: 'closed' } }));
      ws.onmessage = (event) => {
        msgCountRef.current += 1;
        try {
          const outer = JSON.parse(event.data);
          let payload = outer.payload !== undefined ? outer.payload : outer;
          if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { /* keep string */ }
          }
          setTelemetry((prev) => ({
            ...prev,
            [id]: { status: 'open', lastTs: outer.ts || Date.now(), payload, topic: outer.topic },
          }));
        } catch {
          setTelemetry((prev) => ({
            ...prev,
            [id]: { ...prev[id], status: 'open', lastTs: Date.now(), payload: event.data },
          }));
        }
      };
    }

    return () => {
      for (const id of Object.keys(sockets)) {
        try { sockets[id].close(); } catch { /* ignore */ }
        delete sockets[id];
      }
    };
  }, [nodes]);

  const pollHealth = useCallback(async () => {
    const checks = [
      { key: 'auth', run: () => request('/health', { auth: true, quiet: true }) },
      { key: 'module', run: () => request('/nodes', { auth: true, quiet: true }) },
      { key: 'control', run: () => request('/control/schedules', { auth: true, quiet: true }) },
      { key: 'stream', run: () => request('/streams', { auth: true, quiet: true }) },
      { key: 'analytics', run: () => request('/analytics/nodes', { auth: true, quiet: true }) },
      { key: 'wsgateway', run: () => {
        const open = Object.values(telemetryRef.current).some((t) => t?.status === 'open');
        return open ? Promise.resolve({}) : Promise.reject(new Error('no live ws'));
      } },
    ];
    await Promise.all(checks.map(async (c) => {
      try {
        await c.run();
        setHealth((h) => ({ ...h, [c.key]: 'up' }));
      } catch {
        setHealth((h) => ({ ...h, [c.key]: 'down' }));
      }
    }));
  }, []);

  useEffect(() => {
    pollHealth();
    const id = setInterval(pollHealth, 5000);
    return () => clearInterval(id);
  }, [pollHealth]);

  const loadSchedules = useCallback(async () => {
    try {
      const res = await request('/control/schedules', { auth: true, quiet: true });
      const list = Array.isArray(res?.schedules) ? res.schedules : [];
      const nowMs = Date.now();
      let best = null;
      for (const s of list) {
        if (s.enabled === false || !s.next_run_at) continue;
        const ts = new Date(s.next_run_at).getTime();
        if (isNaN(ts) || ts < nowMs - 10000) continue;
        if (!best || ts < new Date(best.next_run_at).getTime()) best = s;
      }
      setNextSched(best);
    } catch {
      setNextSched(null);
    }
  }, []);

  const loadMode = useCallback(async () => {
    if (!selectedNode) { setMode(null); return; }
    try {
      const r = await request(`/control/modes/${encodeURIComponent(selectedNode)}`, { auth: true, quiet: true });
      setMode(r?.mode || null);
    } catch {
      setMode(null);
    }
  }, [selectedNode]);

  const loadActuators = useCallback(async () => {
    if (!selectedNode) { setActuators([]); return; }
    try {
      const data = await moduleApi.getActuatorTags(selectedNode);
      const acts = Array.isArray(data?.tags) ? data.tags : [];
      let liveByKey = {};
      try {
        const ctrl = await controlApi.listTargets(selectedNode);
        for (const c of Array.isArray(ctrl?.targets) ? ctrl.targets : []) {
          if (c?.source_key) liveByKey[c.source_key] = c;
        }
      } catch { /* live state optional */ }
      setActuators(acts.map((t) => {
        const sourceKey = t.source_key;
        const label = t.display_name || t.tag_name || (sourceKey ? sourceKey.replace(/^outputs\./, '') : sourceKey);
        return {
          node_id: selectedNode,
          source_key: sourceKey,
          tag_name: t.tag_name,
          label,
          output_type: t.data_type === 'int' ? 'PWM' : 'DIGITAL',
          last_value: liveByKey[sourceKey]?.last_value ?? t.last_value ?? 0,
        };
      }));
    } catch {
      setActuators([]);
    }
  }, [selectedNode]);

  useEffect(() => { loadSchedules(); const id = setInterval(loadSchedules, 10000); return () => clearInterval(id); }, [loadSchedules]);
  useEffect(() => { loadMode(); loadActuators(); }, [loadMode, loadActuators]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      const rate = msgCountRef.current;
      msgCountRef.current = 0;
      setThroughput(rate);

      const sel = selectedNodeRef.current;
      const metric = selectedMetricRef.current;
      let v = null;
      if (sel && metric) {
        const payload = telemetryRef.current[sel]?.payload;
        const raw = getByPath(payload, metric);
        if (typeof raw === 'number' && Number.isFinite(raw)) v = raw;
      }
      setHistory((prev) => [...prev, { t: Date.now(), v }].slice(-60));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const metricOptions = useMemo(
    () => numericKeys(telemetry[selectedNode]?.payload),
    [telemetry, selectedNode]
  );

  useEffect(() => {
    if (metricOptions.length && (!selectedMetric || !metricOptions.includes(selectedMetric))) {
      setSelectedMetric(metricOptions[0]);
    }
  }, [metricOptions, selectedMetric]);

  const doAction = async (fn, okMsg) => {
    setActionMsg(''); setActionErr('');
    try {
      await fn();
      setActionMsg(okMsg);
      loadMode();
      loadSchedules();
    } catch (e) {
      setActionErr(e?.message || 'Action failed');
    }
  };

  const setModeAction = (mode) => doAction(
    () => request(`/control/modes/${encodeURIComponent(selectedNode)}`, { method: 'PUT', auth: true, quiet: true, body: { mode } }),
    `Mode → ${mode}`
  );
  const emergencyStop = () => doAction(
    () => request('/control/command', { method: 'POST', auth: true, quiet: true, body: { node_id: selectedNode, type: 'emergency_stop' } }),
    'Emergency stop sent'
  );
  const resumeNode = () => doAction(
    () => request(`/control/modes/${encodeURIComponent(selectedNode)}/resume`, { method: 'POST', auth: true, quiet: true }),
    'Node resumed'
  );
  const sendActuator = async (act, value) => {
    await doAction(
      () => controlApi.sendCommand({
        node_id: act.node_id,
        output: act.source_key,
        type: 'set_state',
        value: Number(value),
      }),
      `${act.label} → ${value ? 'ON' : 'OFF'}`
    );
    loadActuators();
  };

  const upCount = HEALTH_ROWS.filter((s) => health[s.key] === 'up').length;
  const connectedCount = Object.values(telemetry).filter((t) => t?.status === 'open').length;
  const schedRemaining = nextSched ? (new Date(nextSched.next_run_at).getTime() - now) / 1000 : null;

  const trendData = {
    labels: history.map((h) => new Date(h.t).toLocaleTimeString()),
    datasets: [{
      label: selectedMetric || 'value',
      data: history.map((h) => h.v),
      borderColor: '#34d399',
      backgroundColor: 'rgba(16,185,129,0.12)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
    }],
  };
  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { ticks: { color: '#64748b', maxTicksLimit: 6, font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    },
  };

  const cardClass = 'border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4 flex flex-col gap-3';

  return (
    <div className="space-y-4">
      <PageHeader icon={Activity} title="MONITOR" subtitle="System health, live telemetry trend, quick control & next schedule">
        <button
          onClick={() => { loadNodes(); pollHealth(); loadSchedules(); loadMode(); }}
          className="h-10 px-3 flex items-center gap-2 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-xs font-black uppercase tracking-widest"
          title="Reload"
        >
          <RefreshCw className="w-4 h-4" /> Reload
        </button>
      </PageHeader>

      {error && (
        <div className="flex items-center gap-3 p-3 border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-black uppercase tracking-widest">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* ── Row 1: Health | Trend | Quick Action ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Health */}
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <PulseCircle color="#34d399" size={18} />
              <span className="text-sm font-black uppercase tracking-wider text-white">Health</span>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              upCount === HEALTH_ROWS.length ? 'text-emerald-400' : upCount > 0 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {upCount}/{HEALTH_ROWS.length} UP
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {HEALTH_ROWS.map((s) => {
              const st = health[s.key];
              const up = st === 'up';
              return (
                <div key={s.key} className={`flex items-center justify-between gap-2 px-3 py-2 border ${
                  up ? 'border-emerald-500/30 bg-emerald-500/5' : st === 'down' ? 'border-red-500/30 bg-red-500/5' : 'border-white/5'
                }`}>
                  <span className="text-xs font-bold text-slate-200 truncate">{s.label}</span>
                  <span className={`flex items-center gap-1.5`}>
                    {up
                      ? <AnimatedCircle color="#34d399" size={16} />
                      : st === 'down'
                        ? <AnimatedCircle color="#f87171" size={16} />
                        : <div className="w-4 h-4 rounded-full border border-white/10" />
                    }
                    <span className={`text-[10px] font-black uppercase tracking-wider ${up ? 'text-emerald-400' : st === 'down' ? 'text-red-400' : 'text-slate-500'}`}>
                      {st === 'up' ? 'UP' : st === 'down' ? 'DOWN' : '…'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
            <Radio className="w-3 h-3 text-emerald-400" /> {connectedCount}/{nodes.length} node
            <span className="text-slate-700">·</span>
            <Gauge className="w-3 h-3 text-emerald-400" /> {throughput} msg/s
          </div>
        </div>

        {/* Trend */}
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <AnimatedCircle color="#34d399" size={18} />
              <span className="text-sm font-black uppercase tracking-wider text-white">Live Trend</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="h-8 bg-black/40 border border-emerald-500/20 text-slate-200 text-[11px] px-2 outline-none focus:border-emerald-400"
              >
                {nodes.map((n) => <option key={n.node_id} value={n.node_id}>{n.name || n.node_id}</option>)}
              </select>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="h-8 bg-black/40 border border-emerald-500/20 text-slate-200 text-[11px] px-2 outline-none focus:border-emerald-400 max-w-[180px]"
              >
                {metricOptions.length === 0 && <option value="">— no metric —</option>}
                {metricOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="h-48 sm:h-56">
            <Line data={trendData} options={trendOptions} />
          </div>
        </div>

        {/* Quick Action */}
        <div className={cardClass}>
          <div className="flex items-center gap-2">
            <AnimatedCircle color="#34d399" size={18} />
            <span className="text-sm font-black uppercase tracking-wider text-white">Quick Action</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Node</label>
            <select
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
              className="h-10 bg-black/40 border border-emerald-500/20 text-slate-200 text-xs px-2 outline-none focus:border-emerald-400"
            >
              {nodes.length === 0 && <option value="">— no nodes —</option>}
              {nodes.map((n) => (
                <option key={n.node_id} value={n.node_id}>{n.name || n.node_id}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
            <span className="text-slate-400">Mode:</span>
            <span className={`px-2 py-1 border ${
              mode === 'EMERGENCY' ? 'text-red-400 border-red-500/30 bg-red-500/10'
                : mode === 'AUTO' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                : mode === 'MANUAL' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                : 'text-slate-400 border-white/10'
            }`}>{mode || '—'}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setModeAction('MANUAL')}
              disabled={!selectedNode}
              className="h-9 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-[11px] font-black uppercase tracking-widest disabled:opacity-40">
              Manual
            </button>
            <button onClick={() => setModeAction('AUTO')}
              disabled={!selectedNode}
              className="h-9 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-[11px] font-black uppercase tracking-widest disabled:opacity-40">
              Auto
            </button>
            <button onClick={emergencyStop}
              disabled={!selectedNode}
              className="h-9 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[11px] font-black uppercase tracking-widest disabled:opacity-40">
              Emergency Stop
            </button>
            <button onClick={resumeNode}
              disabled={!selectedNode}
              className="h-9 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 text-[11px] font-black uppercase tracking-widest disabled:opacity-40">
              Resume
            </button>
          </div>

          {mode === 'MANUAL' && (
            <div className="flex flex-col gap-2 border-t border-white/5 pt-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aktuator</label>
              {actuators.length === 0 ? (
                  <div className="text-[10px] text-slate-500">No actuator tagged.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {actuators.map((a) => {
                    const on = (a.last_value ?? 0) > 0;
                    return (
                      <button
                        key={a.source_key}
                        onClick={() => sendActuator(a, on ? 0 : 1)}
                        disabled={!selectedNode}
                        title={`${a.output_type} · ${a.tag_name || a.source_key}`}
                        className={`h-9 flex items-center justify-center gap-1.5 border text-[11px] font-black uppercase tracking-widest disabled:opacity-40 ${
                          on
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-white/10 text-slate-400'
                        }`}
                      >
                        <span className="truncate">{a.label}</span>
                        <span className={`shrink-0 px-1 border ${on ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-500/30 text-slate-500'}`}>
                          {on ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {actionMsg && <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{actionMsg}</div>}
          {actionErr && <div className="text-[10px] font-black uppercase tracking-widest text-red-400">{actionErr}</div>}
        </div>
      </div>

      {/* ── Row 2: Schedule ──────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-center gap-2">
          <AnimatedCircle color="#34d399" size={18} />
          <span className="text-sm font-black uppercase tracking-wider text-white">Schedule</span>
        </div>

        {nextSched ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="text-[11px] text-slate-400 font-mono break-all">
                <span className="text-emerald-300">{nextSched.node_id}</span>
                <span className="text-slate-500"> · {nextSched.output_name || '*'}</span>
                <span className="text-slate-500"> · {nextSched.type}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">
                {schedRemaining > 0 ? `sisa ${Math.floor(schedRemaining)} detik` : 'jatuh tempo'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black tabular-nums text-emerald-400">{fmtCountdown(schedRemaining)}</div>
            </div>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-slate-600 gap-2">
            <CalendarClock className="w-6 h-6 text-slate-600" />
                <span className="text-[11px] font-bold uppercase tracking-wider">No active schedule</span>
          </div>
        )}
      </div>

      {/* ── Node Telemetry Grid ────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-xs font-black uppercase tracking-widest">Loading nodes…</span>
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 border border-emerald-500/10 bg-[#030705]/60">
          <Cpu className="w-12 h-12 text-slate-600" />
          <div className="text-center">
            <div className="text-sm font-black uppercase tracking-widest text-slate-300">No Nodes Paired</div>
            <div className="text-xs text-slate-500 mt-1">Pair a node in Module to see live telemetry here.</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {nodes.map((node) => (
            <NodeTelemetryCard key={node.node_id} node={node} state={telemetry[node.node_id]} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Monitor;
