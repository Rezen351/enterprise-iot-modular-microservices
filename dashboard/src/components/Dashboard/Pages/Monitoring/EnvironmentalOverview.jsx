import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Maximize2, X, AlertCircle, Loader2 } from 'lucide-react';
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

function EnvironmentalOverview({ selectedModule, activeModuleData = {}, systemHealth }) {
  const isMistPumpOn = activeModuleData?.isMistPumpOn ?? false;

  const [viewType, setViewType] = useState('illustration'); // 'illustration' | 'graph'
  const [isExpanded, setIsExpanded] = useState(false);

  const [graphData, setGraphData] = useState(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Synchronous module change tracking to reset graph data immediately
  const [prevModuleId, setPrevModuleId] = useState(null);
  const currentModuleId = selectedModule?.id || 1;
  const [hiddenSensors, setHiddenSensors] = useState({});

  const toggleSensorVisibility = (key) => {
    setHiddenSensors(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (currentModuleId !== prevModuleId) {
    setPrevModuleId(currentModuleId);
    setGraphData(null);
    setHiddenSensors({});
  }

  // Define configuration for all 7 sensors
  const sensors = {
    temp_in: { id: activeModuleData?.sensors?.cwt_dalam_temp?.id, label: 'Temp Indoor', color: '#10b981', yAxisID: 'yTemp', suffix: '°C', decimals: 1 },
    temp_out: { id: activeModuleData?.sensors?.cwt_luar_temp?.id, label: 'Temp Outdoor', color: '#f97316', yAxisID: 'yTemp', suffix: '°C', decimals: 1 },
    temp_water: { id: activeModuleData?.sensors?.npk_temp_air?.id, label: 'Water Temp', color: '#06b6d4', yAxisID: 'yTemp', suffix: '°C', decimals: 1 },
    hum_in: { id: activeModuleData?.sensors?.cwt_dalam_hum?.id, label: 'Hum Indoor', color: '#0ea5e9', yAxisID: 'yTemp', suffix: '%', decimals: 0 },
    hum_out: { id: activeModuleData?.sensors?.cwt_luar_hum?.id, label: 'Hum Outdoor', color: '#f59e0b', yAxisID: 'yTemp', suffix: '%', decimals: 0 },
    ph: { id: activeModuleData?.sensors?.npk_ph?.id, label: 'pH', color: '#a855f7', yAxisID: 'yTemp', suffix: '', decimals: 2 },
    ec: { id: activeModuleData?.sensors?.npk_ec?.id, label: 'EC', color: '#3b82f6', yAxisID: 'yEc', suffix: ' mS/cm', decimals: 2 }
  };

  // Fetch telemetry history for all active sensors
  useEffect(() => {
    const activeSensorsToFetch = Object.entries(sensors).filter(([_, s]) => s.id);
    if (activeSensorsToFetch.length === 0) return;

    let active = true;
    const fetchHistory = async () => {
      setLoadingGraph(true);
      setFetchError(null);
      try {
        const token = sessionStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Parallel fetch for all defined sensors
        const responses = await Promise.all(
          activeSensorsToFetch.map(([key, s]) =>
            fetch(`/api/v1/iot/sensors/${s.id}/telemetry?limit=15`, { headers })
              .then(res => {
                if (!res.ok) throw new Error(`Status ${res.status} for ${s.label}`);
                return res.json().then(data => ({ key, data }));
              })
          )
        );

        if (!active) return;

        // Map responses oldest first
        const telemetryMap = {};
        responses.forEach(({ key, data }) => {
          telemetryMap[key] = [...data].reverse();
        });

        // Find the length of the shortest telemetry list to align them
        const lengths = Object.values(telemetryMap).map(arr => arr.length);
        const count = Math.min(...lengths, 15);
        if (count === 0) {
          setGraphData([]);
          return;
        }

        const combined = [];
        for (let i = 0; i < count; i++) {
          const point = {};

          // Get recorded_at timestamp from first available series for label
          const firstKey = activeSensorsToFetch[0][0];
          const item = telemetryMap[firstKey][i];
          if (item && item.recorded_at) {
            const date = new Date(item.recorded_at);
            point.time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          } else {
            point.time = `pt-${i}`;
          }

          // Populate sensor values
          activeSensorsToFetch.forEach(([key]) => {
            const valObj = telemetryMap[key][i];
            point[key] = valObj ? valObj.value : null;
          });

          combined.push(point);
        }

        setGraphData(combined);
      } catch (err) {
        console.error("Error fetching telemetry history in EnvironmentalOverview:", err);
        if (active) {
          setFetchError(err.message);
          setGraphData([]);
        }
      } finally {
        if (active) setLoadingGraph(false);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 30000); // refresh every 30s
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    activeModuleData?.sensors?.cwt_dalam_temp?.id,
    activeModuleData?.sensors?.cwt_luar_temp?.id,
    activeModuleData?.sensors?.npk_temp_air?.id,
    activeModuleData?.sensors?.cwt_dalam_hum?.id,
    activeModuleData?.sensors?.cwt_luar_hum?.id,
    activeModuleData?.sensors?.npk_ph?.id,
    activeModuleData?.sensors?.npk_ec?.id,
  ]);

  // Render SVG Graph Component
  const renderGraph = (isModal = false) => {
    const heightVal = isModal ? "h-full max-h-[65vh]" : "h-[300px]";

    if (loadingGraph && (!graphData || graphData.length === 0)) {
      return (
        <div className={`w-full ${heightVal} flex flex-col items-center justify-center bg-[#020604]/20 border border-emerald-500/10 p-8`}>
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
          <span className="text-[11px] font-black tracking-widest text-emerald-400 uppercase animate-pulse">
            Syncing telemetry...
          </span>
        </div>
      );
    }

    if (!graphData || graphData.length === 0) {
      return (
        <div className={`w-full ${heightVal} flex flex-col items-center justify-center bg-[#020604]/20 border border-emerald-500/10 p-8 text-slate-500`}>
          <span className="text-[11px] font-black tracking-widest uppercase">
            No data
          </span>
        </div>
      );
    }

    const activeSensorsList = Object.entries(sensors).filter(([key, s]) => s.id);

    const datasets = activeSensorsList.map(([key, s]) => {
      const rawValues = graphData.map(d => d[key]);

      return {
        label: s.label,
        data: rawValues,
        borderColor: s.color,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
        pointBackgroundColor: s.color,
        pointBorderColor: '#030705',
        pointBorderWidth: 1.5,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 2,
        tension: 0.4,
        fill: false,
        yAxisID: s.yAxisID,
        rawValues: rawValues,
        sensorKey: key,
        suffix: s.suffix,
        decimals: s.decimals,
        hidden: !!hiddenSensors[key]
      };
    });

    const data = {
      labels: graphData.map(d => d.time),
      datasets: datasets
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(4, 12, 8, 0.95)',
          titleColor: '#64748b',
          titleFont: { family: 'Outfit, sans-serif', weight: '900', size: 10 },
          bodyColor: '#e2e8f0',
          bodyFont: { family: 'Outfit, sans-serif', weight: 'bold', size: 11 },
          borderColor: 'rgba(16, 185, 129, 0.25)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const datasetIndex = context.datasetIndex;
              const dataIndex = context.dataIndex;
              const ds = context.chart.data.datasets[datasetIndex];
              const rawVal = ds.rawValues[dataIndex];
              if (rawVal === undefined || rawVal === null) return ` ${ds.label}: N/A`;
              return ` ${ds.label}: ${rawVal.toFixed(ds.decimals)}${ds.suffix}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { family: 'Outfit, sans-serif', weight: 'bold', size: 9 }
          }
        },
        yTemp: {
          type: 'linear',
          position: 'left',
          ticks: {
            color: '#64748b',
            font: { family: 'Outfit, sans-serif', weight: 'bold', size: 9 }
          },
          grid: {
            color: 'rgba(16, 185, 129, 0.05)',
            drawTicks: false
          }
        },
        yEc: {
          type: 'linear',
          position: 'right',
          ticks: {
            color: '#475569',
            font: { family: 'Outfit, sans-serif', weight: 'bold', size: 9 },
            callback: (val) => `${val.toFixed(2)} EC`
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    };

    return (
      <div className={`w-full ${heightVal} flex flex-col justify-between relative`}>
        {loadingGraph && (
          <div className="absolute inset-0 bg-[#020604]/60 backdrop-blur-[1px] flex items-center justify-center z-20">
            <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase animate-pulse">
Syncing...
            </span>
          </div>
        )}
        <div className="flex-1 w-full relative">
          <Line data={data} options={options} />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4 text-[9px] font-black tracking-wider text-slate-400 uppercase select-none shrink-0">
          {activeSensorsList.map(([key, s]) => {
            const isHidden = !!hiddenSensors[key];
            return (
              <button
                type="button"
                key={key}
                onClick={() => toggleSensorVisibility(key)}
                className={`flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${isHidden ? 'opacity-35 line-through text-slate-600' : 'hover:text-white'
                  }`}
              >
                <span className="w-2.5 h-2.5 rounded shrink-0 transition-transform hover:scale-110" style={{ backgroundColor: isHidden ? '#334155' : s.color }} />
                <span>{s.label}</span>
              </button>
            );
          })}
          {fetchError && (
            <div className="flex items-center gap-1 text-amber-500 lowercase">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>using simulation</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3.5 sm:p-6 flex flex-col h-auto md:h-[450px] justify-between relative overflow-hidden group">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between z-10 gap-3 sm:gap-2 w-full">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-black text-white uppercase tracking-widest">
            Overview
          </span>
        </div>

        {/* Toggle Selector */}
        <div className="flex bg-[#020604] border border-emerald-500/20 p-0.5 z-10 h-9 sm:h-12 items-center shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewType('illustration')}
            className={`flex-1 sm:flex-none px-3.5 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider transition-all duration-150 select-none active:scale-95 cursor-pointer ${viewType === 'illustration'
              ? 'bg-emerald-500 text-black'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            Illustration
          </button>
          <button
            type="button"
            onClick={() => setViewType('graph')}
            className={`flex-1 sm:flex-none px-3.5 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider transition-all duration-150 select-none active:scale-95 cursor-pointer ${viewType === 'graph'
              ? 'bg-emerald-500 text-black'
              : 'text-slate-400 hover:text-white'
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
           <div className="w-full h-full border border-emerald-500/10 bg-[#020604]/60 relative p-2 flex items-center justify-center overflow-hidden">
            <AeroponicSystemSvg
              selectedModule={selectedModule}
              systemHealth={systemHealth?.status}
              activeModuleData={activeModuleData}
            />

            {/* Dynamic Mist Overlay effect when pump is active */}
            {isMistPumpOn && (
               <div className="absolute inset-0 bg-cyan-400/5 mix-blend-color-dodge pointer-events-none animate-pulse" />
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
          <div className="relative w-full max-w-6xl h-[90vh] border border-emerald-500/20 bg-[#040c08]/98 backdrop-blur-md p-4 sm:p-8 flex flex-col justify-between">
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
            <div className="flex-1 overflow-hidden border border-emerald-500/10 bg-[#020604]/80 p-2 sm:p-4 relative flex flex-col">
              {viewType === 'illustration' ? (
                <div className="relative w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full">
                  <AeroponicSystemSvg
                    selectedModule={selectedModule}
                    systemHealth={systemHealth?.status}
                    activeModuleData={activeModuleData}
                  />
                  {isMistPumpOn && (
                     <div className="absolute inset-0 bg-cyan-400/5 mix-blend-color-dodge pointer-events-none animate-pulse" />
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


