import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Maximize2, X } from 'lucide-react';
import AeroponicSystemSvg from './AeroponicSystemSvg';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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

function EnvironmentalOverview({ selectedModule, activeModuleData = {}, systemHealth, payload }) {
  const isMistPumpOn = activeModuleData?.isMistPumpOn ?? false;

  const [viewType, setViewType] = useState('illustration'); // 'illustration' | 'graph'
  const [isExpanded, setIsExpanded] = useState(false);

  // Live telemetry trend (single selected metric, accumulated from websocket payload)
  const [history, setHistory] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('');

  // Reset trend state when the module/node changes
  const [prevKey, setPrevKey] = useState(null);
  const resetKey = `${selectedModule?.id ?? ''}`;
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setHistory([]);
    setSelectedMetric('');
  }

  const metricOptions = useMemo(() => numericKeys(payload), [payload]);

  useEffect(() => {
    if (metricOptions.length && (!selectedMetric || !metricOptions.includes(selectedMetric))) {
      setSelectedMetric(metricOptions[0]);
    }
  }, [metricOptions, selectedMetric]);

  // Keep latest values for the accumulation interval without restarting it
  const payloadRef = useRef(payload);
  const metricRef = useRef(selectedMetric);
  useEffect(() => { payloadRef.current = payload; }, [payload]);
  useEffect(() => { metricRef.current = selectedMetric; }, [selectedMetric]);

  useEffect(() => {
    const id = setInterval(() => {
      const metric = metricRef.current;
      const pl = payloadRef.current;
      let v = null;
      if (metric && pl) {
        const raw = getByPath(pl, metric);
        if (typeof raw === 'number' && Number.isFinite(raw)) v = raw;
      }
      setHistory((prev) => [...prev, { t: Date.now(), v }].slice(-60));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Render live telemetry trend using chart.js
  const renderGraph = (isModal = false) => {
    const heightVal = isModal ? "h-full max-h-[65vh]" : "h-[300px]";

    if (!metricOptions.length) {
      return (
        <div className={`w-full ${heightVal} flex flex-col items-center justify-center bg-[#020604]/20 border border-emerald-500/10 rounded-none p-8 text-slate-500`}>
          <span className="text-[11px] font-black tracking-widest uppercase">
            No telemetry data available
          </span>
        </div>
      );
    }

    const data = {
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

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 6, font: { size: 9 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: { color: '#64748b', font: { size: 9 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
      },
    };

    return (
      <div className={`w-full ${heightVal} flex flex-col justify-between relative`}>
        <div className="flex-1 w-full relative">
          <Line data={data} options={options} />
        </div>

        {/* Metric selector for the live telemetry trend */}
        <div className="flex items-center justify-center gap-2 mt-4 text-[9px] font-black tracking-wider text-slate-400 uppercase select-none shrink-0">
          <span>Metric</span>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="h-8 bg-black/40 border border-emerald-500/20 text-slate-200 text-[11px] px-2 outline-none focus:border-emerald-400 cursor-pointer max-w-[220px]"
          >
            {metricOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-4 rounded-none flex flex-col h-auto md:h-[450px] justify-between relative shadow-lg overflow-hidden group transition-all duration-300 hover:border-emerald-400/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between z-10 gap-3 sm:gap-2 w-full">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-black text-white uppercase tracking-widest">
            Overview
          </span>
        </div>

        {/* Toggle Selector */}
        <div className="flex bg-slate-100 dark:bg-[#020604] border border-slate-200 dark:border-emerald-500/20 rounded-none p-0.5 z-10 h-9 sm:h-12 items-center shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewType('illustration')}
            className={`flex-1 sm:flex-none px-3.5 h-full flex items-center justify-center rounded-none text-[9px] font-black uppercase tracking-wider transition-all duration-150 select-none active:scale-95 cursor-pointer ${viewType === 'illustration'
              ? 'bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.4)] font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
              }`}
          >
            Illustration
          </button>
          <button
            type="button"
            onClick={() => setViewType('graph')}
            className={`flex-1 sm:flex-none px-3.5 h-full flex items-center justify-center rounded-none text-[9px] font-black uppercase tracking-wider transition-all duration-150 select-none active:scale-95 cursor-pointer ${viewType === 'graph'
              ? 'bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.4)] font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
              }`}
          >
            Graph Trends
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex items-center justify-center my-1 md:my-1.5 overflow-hidden relative z-10 w-full">
        {viewType === 'illustration' ? (
          /* ================== ILLUSTRATION VIEW ================== */
          <div className="svg-stage w-full h-full border border-slate-100 dark:border-emerald-500/10 bg-transparent dark:bg-[#020604]/60 rounded-none relative p-2 flex items-center justify-center overflow-hidden">
            <AeroponicSystemSvg
              selectedModule={selectedModule}
              systemHealth={systemHealth?.status}
              activeModuleData={activeModuleData}
            />

            {/* Dynamic Mist Overlay effect when pump is active */}
            {isMistPumpOn && (
              <div className="absolute inset-0 bg-cyan-400/5 mix-blend-color-dodge pointer-events-none rounded-none" />
            )}
          </div>
        ) : (
          /* ================== GRAPH TRENDS VIEW ================== */
          renderGraph(false)
        )}
      </div>

      {/* Footer / Expand Toggle */}
      <div className="border-t border-emerald-500/10 pt-3 z-10 flex justify-end">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent focus:outline-none"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Expand Overview</span>
        </button>
      </div>

      {/* Expanded Modal View using React Portal to document.body */}
      {isExpanded && createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#020604]/95 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-6 md:p-12 animate-fadeIn">
          <div className="relative w-full max-w-6xl h-[90vh] border border-emerald-500/20 bg-[#040c08]/98 backdrop-blur-md rounded-none p-4 sm:p-8 flex flex-col justify-between shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span className="text-sm font-black text-white uppercase tracking-widest">
                  Overview
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all cursor-pointer focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Area */}
            <div className="flex-1 overflow-hidden border border-emerald-500/10 bg-[#020604]/80 rounded-none p-2 sm:p-4 shadow-inner relative flex flex-col">
              {viewType === 'illustration' ? (
                <div className="svg-stage rounded-none relative w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full">
                  <AeroponicSystemSvg
                    selectedModule={selectedModule}
                    systemHealth={systemHealth?.status}
                    activeModuleData={activeModuleData}
                  />
                  {isMistPumpOn && (
                    <div className="absolute inset-0 bg-cyan-400/5 mix-blend-color-dodge pointer-events-none rounded-none" />
                  )}
                </div>
              ) : (
                renderGraph(true)
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default EnvironmentalOverview;
