import { useState, useEffect, useCallback } from 'react';
import { Download, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import ModuleBadge from '../ModuleBadge';
import ParameterTrends from './DataAnalysis/ParameterTrends';
import ParameterSummary from './DataAnalysis/ParameterSummary';
import DistributionHistograms from './DataAnalysis/DistributionHistograms';
import CorrelationHeatmap from './DataAnalysis/CorrelationHeatmap';
import SystemLogs from './DataAnalysis/SystemLogs';

function DataAnalysis({ selectedModule }) {
  const [timeRange, setTimeRange] = useState('7d');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Synchronous module change tracking to reset analysis data immediately
  const [prevModuleId, setPrevModuleId] = useState(null);
  const currentModuleId = selectedModule?.id || 1;
  if (currentModuleId !== prevModuleId) {
    setPrevModuleId(currentModuleId);
    setIsLoading(true);
    setAnalysisData(null);
  }

  // Logs state — fetched independently so they refresh without triggering full reload
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Active state of lines plotted in the trend chart
  const [activeSensors, setActiveSensors] = useState({});

  // Fetch analysis data (trends, histograms, correlation)
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const cleanModuleId = selectedModule?._dbId || 1;
        const token = sessionStorage.getItem('token');
        const response = await fetch(`/api/v1/iot/modules/${cleanModuleId}/analysis?range=${timeRange}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch analysis data: ${response.statusText}`);
        }
        const data = await response.json();
        if (active) {
          setAnalysisData(data);
          const newActives = {};
          const telemetryKeys = data.telemetry ? Object.keys(data.telemetry) : ['temp_out', 'temp_in', 'water_temp', 'hum_out', 'hum_in', 'ec', 'ph'];
          telemetryKeys.forEach(k => {
            newActives[k] = true;
          });
          if (data.actuators) {
            Object.keys(data.actuators).forEach(k => {
              newActives[k] = false;
            });
          }
          setActiveSensors(newActives);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Data Analysis Fetch Error:', err);
        if (active) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    fetchData();
    return () => { active = false; };
  }, [selectedModule, timeRange]);

  // Fetch system logs (filtered by module)
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const moduleId = selectedModule?._dbId || 1;
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/v1/iot/logs?module_id=${moduleId}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('System Logs Fetch Error:', err);
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [selectedModule]);

  // Fetch logs when module changes
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // If analysis data is loading, render premium loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] w-full gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-emerald-500/10 animate-pulse"></div>
          <div className="absolute inset-0 border-4 border-t-emerald-500 border-r-teal-500 animate-spin"></div>
        </div>
        <span className="text-[11px] font-black tracking-widest text-emerald-400 uppercase animate-pulse">
          Analyzing Growbox Telemetry...
        </span>
      </div>
    );
  }

  const dataset = analysisData || {
    labels: [],
    temp_out: [],
    temp_in: [],
    water_temp: [],
    hum_out: [],
    hum_in: [],
    ec: [],
    ph: [],
    summary: {
      temp_out: { avg: 0, min: 0, max: 0 },
      temp_in: { avg: 0, min: 0, max: 0 },
      water_temp: { avg: 0, min: 0, max: 0 },
      hum_out: { avg: 0, min: 0, max: 0 },
      hum_in: { avg: 0, min: 0, max: 0 },
      ec: { avg: 0, min: 0, max: 0 },
      ph: { avg: 0, min: 0, max: 0 }
    },
    performanceScore: 0,
    insights: [],
    histograms: {
      temp_out: [],
      temp_in: [],
      water_temp: [],
      hum_out: [],
      hum_in: [],
      ec: [],
      ph: []
    },
    correlationMatrix: []
  };

  // Toggle active sensor filter
  const toggleSensor = (sensorId) => {
    setActiveSensors(prev => ({
      ...prev,
      [sensorId]: !prev[sensorId]
    }));
  };

  // Mock Export CSV action
  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
      }, 4000);
    }, 1500);
  };

  const ranges = [
    { id: '24h', label: 'LAST 24 HOURS' },
    { id: '7d', label: 'LAST 7 DAYS' },
    { id: '30d', label: 'LAST 30 DAYS' }
  ];

  const sensorChips = [];
  if (dataset) {
    if (dataset.telemetry) {
      Object.keys(dataset.telemetry).forEach((key, idx) => {
        const colors = [
          'peer-checked:bg-orange-500 peer-checked:text-black hover:border-orange-500/35 border-orange-500/15 text-orange-400',
          'peer-checked:bg-emerald-500 peer-checked:text-black hover:border-emerald-500/35 border-emerald-500/15 text-emerald-400',
          'peer-checked:bg-cyan-500 peer-checked:text-black hover:border-cyan-500/35 border-cyan-500/15 text-cyan-400',
          'peer-checked:bg-amber-500 peer-checked:text-black hover:border-amber-500/35 border-amber-500/15 text-amber-400',
          'peer-checked:bg-yellow-500 peer-checked:text-black hover:border-yellow-500/35 border-yellow-500/15 text-yellow-400',
          'peer-checked:bg-blue-500 peer-checked:text-black hover:border-blue-500/35 border-blue-500/15 text-blue-400',
          'peer-checked:bg-purple-500 peer-checked:text-black hover:border-purple-500/35 border-purple-500/15 text-purple-400',
          'peer-checked:bg-pink-500 peer-checked:text-black hover:border-pink-500/35 border-pink-500/15 text-pink-400',
        ];
        const colorClass = colors[idx % colors.length];
        sensorChips.push({
          id: key,
          label: key.replace(/_/g, ' ').toUpperCase(),
          colorClass: colorClass,
          isActuator: false
        });
      });
    } else {
      // Fallback
      const fallbacks = [
        { id: 'temp_out', label: 'TEMP OUT', colorClass: 'peer-checked:bg-orange-500 peer-checked:text-black hover:border-orange-500/35 border-orange-500/15 text-orange-400' },
        { id: 'temp_in', label: 'TEMP IN', colorClass: 'peer-checked:bg-emerald-500 peer-checked:text-black hover:border-emerald-500/35 border-emerald-500/15 text-emerald-400' },
        { id: 'water_temp', label: 'WATER TEMP', colorClass: 'peer-checked:bg-cyan-500 peer-checked:text-black hover:border-cyan-500/35 border-cyan-500/15 text-cyan-400' },
        { id: 'hum_out', label: 'HUM OUT', colorClass: 'peer-checked:bg-amber-500 peer-checked:text-black hover:border-amber-500/35 border-amber-500/15 text-amber-400' },
        { id: 'hum_in', label: 'HUM IN', colorClass: 'peer-checked:bg-yellow-500 peer-checked:text-black hover:border-yellow-500/35 border-yellow-500/15 text-yellow-400' },
        { id: 'ec', label: 'EC', colorClass: 'peer-checked:bg-blue-500 peer-checked:text-black hover:border-blue-500/35 border-blue-500/15 text-blue-400' },
        { id: 'ph', label: 'pH', colorClass: 'peer-checked:bg-purple-500 peer-checked:text-black hover:border-purple-500/35 border-purple-500/15 text-purple-400' }
      ];
      sensorChips.push(...fallbacks);
    }

    if (dataset.actuators) {
      Object.keys(dataset.actuators).forEach((key, idx) => {
        sensorChips.push({
          id: key,
          label: `⚡ ${key.replace(/_/g, ' ').toUpperCase()}`,
          colorClass: 'peer-checked:bg-violet-600 peer-checked:text-white hover:border-violet-500/35 border-violet-500/15 text-violet-400',
          isActuator: true
        });
      });
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      {/* 1. Header Filter Controls */}
      <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
        {/* Left Side: Title & Info */}
        <div className="flex items-center gap-3 sm:gap-4 w-full xl:w-auto xl:flex-1 min-w-0">
           <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <SlidersHorizontal className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-wide uppercase truncate">
              Data Analysis
            </h2>
            <p className="hidden sm:block text-slate-400 text-xs sm:text-sm mt-1 font-medium truncate sm:whitespace-normal">
              Historical analytics, correlation matrices, and telemetry trends for Aeroponic smart modules.
            </p>
            <ModuleBadge selectedModule={selectedModule} className="mt-2.5" />
          </div>
        </div>

        {/* Right Side: Filters & Controls */}
        <div className="flex flex-col sm:flex-row xl:items-center gap-3 w-full xl:w-auto">
          {/* A. Time Range Segmented Selector */}
           <div className="flex bg-slate-950/40 p-1 border border-slate-900 h-10 w-full sm:w-auto items-center shrink-0">
            {ranges.map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                 className={`h-full flex-1 sm:flex-initial px-4 text-[10px] sm:text-[11px] font-black tracking-widest transition-all duration-200 cursor-pointer select-none ${timeRange === range.id
                    ? 'bg-emerald-500 text-black'
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* B. Export Action Button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
             className="flex items-center justify-center gap-2 h-10 w-full sm:w-auto px-5 text-[10px] sm:text-[11px] font-black text-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border border-emerald-500/20 transition-all cursor-pointer select-none active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none uppercase tracking-widest shrink-0"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'EXPORTING...' : 'EXPORT'}
          </button>
        </div>
      </div>

      {/* Export Toast Notification */}
      {exportSuccess && (
         <div className="border border-emerald-500/30 bg-[#04160d] text-emerald-400 p-4 sm:p-6 flex items-center gap-3 sm:gap-4 animate-fadeIn">
          <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
          <div className="text-xs sm:text-sm font-black tracking-wide uppercase">
            Telemetry logs successfully exported as CSV file!
          </div>
        </div>
      )}

      {/* 2. Main Trend Chart - Full Width for Maximum Emphasis */}
      <div className="w-full">
        <ParameterTrends dataset={dataset} activeSensors={activeSensors} toggleSensor={toggleSensor} />
      </div>

      {/* 3. Core Analytics Metrics & Heatmaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full items-stretch">
        {/* Avg Statistics Cards */}
        <div>
          <ParameterSummary summary={dataset.summary} />
        </div>

        {/* Histograms */}
        <div>
          <DistributionHistograms histograms={dataset.histograms} dataset={dataset} />
        </div>

        {/* Heatmap */}
        <div>
          <CorrelationHeatmap correlationMatrix={dataset.correlationMatrix} />
        </div>
      </div>

      {/* 4. System Logs & Daily Statistics Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-stretch">
        {/* System Logs from Database */}
        <div className="lg:col-span-1">
          <SystemLogs
            logs={logs}
            isLoading={logsLoading}
            onRefresh={fetchLogs}
          />
        </div>
      </div>
    </div>
  );
}

export default DataAnalysis;
