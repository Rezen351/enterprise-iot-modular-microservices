import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Sensor metadata — 7 parameters
const SENSOR_META = {
    temp_out:   { label: 'TEMP OUTDOOR',  unit: '°C',    color: '#f97316', suffix: '°C', decimals: 1 },
    temp_in:    { label: 'TEMP INDOOR',   unit: '°C',    color: '#10b981', suffix: '°C', decimals: 1 },
    water_temp: { label: 'WATER TEMP',    unit: '°C',    color: '#06b6d4', suffix: '°C', decimals: 1 },
    hum_out:    { label: 'HUMID OUT',     unit: '%',     color: '#f59e0b', suffix: '%', decimals: 0 },
    hum_in:     { label: 'HUMID IN',      unit: '%',     color: '#eab308', suffix: '%', decimals: 0 },
    ec:         { label: 'EC',            unit: 'mS/cm', color: '#3b82f6', suffix: ' mS/cm', decimals: 2 },
    ph:         { label: 'pH',            unit: '',      color: '#a855f7', suffix: '', decimals: 2 }
};

const getMeta = (key, idx, isActuator) => {
    if (!isActuator && SENSOR_META[key]) return SENSOR_META[key];
    
    const colors = [
        '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#eab308',
        '#3b82f6', '#a855f7', '#ec4899', '#f43f5e', '#8b5cf6',
        '#6366f1', '#14b8a6'
    ];
    const color = isActuator ? '#8b5cf6' : colors[idx % colors.length];
    
    let unit = '';
    let suffix = '';
    let decimals = 2;
    if (key.includes('temp')) {
        unit = '°C';
        suffix = '°C';
        decimals = 1;
    } else if (key.includes('hum')) {
        unit = '%';
        suffix = '%';
        decimals = 0;
    } else if (key.includes('ec')) {
        unit = 'mS/cm';
        suffix = ' mS/cm';
        decimals = 2;
    } else if (key.includes('ph')) {
        decimals = 2;
    } else if (isActuator) {
        unit = 'State';
        suffix = '';
        decimals = 0;
    }
    
    return {
        label: (isActuator ? '⚡ ' : '') + key.replace(/_/g, ' ').toUpperCase(),
        unit,
        color,
        suffix,
        decimals
    };
};

function ParameterTrends({ dataset, activeSensors, toggleSensor }) {
    const telemetryKeys = dataset.telemetry ? Object.keys(dataset.telemetry) : Object.keys(SENSOR_META);
    const actuatorKeys = dataset.actuators ? Object.keys(dataset.actuators) : [];

    const datasets = [];
    let idx = 0;

    if (dataset.telemetry) {
        Object.keys(dataset.telemetry).forEach(key => {
            const meta = getMeta(key, idx++, false);
            const rawValues = dataset.telemetry[key] || [];
            datasets.push({
                label: meta.label,
                data: rawValues,
                borderColor: meta.color,
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 10,
                pointBackgroundColor: meta.color,
                pointBorderColor: '#030705',
                tension: 0.4,
                fill: false,
                yAxisID: key.includes('ec') ? 'yEc' : 'yTemp',
                rawValues: rawValues,
                sensorKey: key,
                isActuator: false,
                hidden: !activeSensors[key]
            });
        });
    } else {
        // Fallback
        Object.keys(SENSOR_META).forEach(key => {
            const meta = SENSOR_META[key];
            const rawValues = dataset[key] || [];
            datasets.push({
                label: meta.label,
                data: rawValues,
                borderColor: meta.color,
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 10,
                pointBackgroundColor: meta.color,
                pointBorderColor: '#030705',
                tension: 0.4,
                fill: false,
                yAxisID: key === 'ec' ? 'yEc' : 'yTemp',
                rawValues: rawValues,
                sensorKey: key,
                isActuator: false,
                hidden: !activeSensors[key]
            });
        });
    }

    if (dataset.actuators) {
        Object.keys(dataset.actuators).forEach(key => {
            const meta = getMeta(key, idx++, true);
            const rawValues = dataset.actuators[key] || [];
            datasets.push({
                label: meta.label,
                data: rawValues,
                borderColor: meta.color,
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHitRadius: 10,
                pointBackgroundColor: meta.color,
                pointBorderColor: '#030705',
                tension: 0.1,
                fill: false,
                yAxisID: 'yActuator',
                rawValues: rawValues,
                sensorKey: key,
                isActuator: true,
                hidden: !activeSensors[key]
            });
        });
    }

    const data = {
        labels: dataset.labels || [],
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
                        const key = ds.sensorKey;
                        const isActuator = ds.isActuator;
                        const meta = getMeta(key, datasetIndex, isActuator);
                        const rawVal = ds.rawValues[dataIndex];
                        if (rawVal === undefined || rawVal === null) return ` ${meta.label}: N/A`;
                        if (isActuator) {
                            if (rawVal === 0) return ` ${meta.label}: OFF`;
                            if (rawVal === 1) return ` ${meta.label}: ON`;
                            return ` ${meta.label}: ${rawVal} (Raw)`;
                        }
                        return ` ${meta.label}: ${rawVal.toFixed(meta.decimals)}${meta.suffix}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    color: '#64748b',
                    font: { family: 'Outfit, sans-serif', weight: 'bold', size: 9 },
                    maxTicksLimit: 6,
                    maxRotation: 45,
                    minRotation: 0
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
            },
            yActuator: {
                type: 'linear',
                position: 'right',
                min: 0,
                ticks: {
                    color: '#8b5cf6',
                    font: { family: 'Outfit, sans-serif', weight: 'bold', size: 8 },
                    callback: (val) => {
                        if (val === 0) return '0 (OFF)';
                        if (val === 1) return '1 (ON)';
                        return val;
                    }
                },
                grid: {
                    drawOnChartArea: false
                }
            }
        }
    };

    return (
        <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6 relative select-none h-full flex flex-col">
            <div className="flex flex-col gap-4 border-b border-emerald-500/10 pb-4 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-black font-display text-white tracking-widest uppercase">
                            Trends
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider hidden sm:block">
                            Toggle lines to inspect curves
                        </p>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block sm:hidden">
                        Swipe to filter
                    </div>
                </div>

                {/* Horizontal Scrollable Toggle Chips (Legend) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none flex-nowrap w-full lg:flex-wrap lg:overflow-x-visible lg:pb-0">
                    {telemetryKeys.map((key, idx) => {
                        const isHidden = !activeSensors[key];
                        const meta = getMeta(key, idx, false);
                        return (
                            <button
                                type="button"
                                key={key}
                                onClick={() => toggleSensor && toggleSensor(key)}
                                className={`flex items-center gap-2 px-3 py-1.5 border text-[10px] font-black tracking-wider transition-all duration-200 select-none cursor-pointer active:scale-95 shrink-0 ${
                                    isHidden 
                                        ? 'bg-slate-950/20 border-slate-900 text-slate-600 line-through opacity-40' 
                                        : 'bg-emerald-950/10 border-emerald-500/20 text-emerald-400 hover:border-emerald-400/40'
                                }`}
                            >
                                 <span className="w-2 h-2 shrink-0 animate-pulse" style={{ backgroundColor: isHidden ? '#334155' : meta.color }} />
                                <span className="whitespace-nowrap">{meta.label}</span>
                            </button>
                        );
                    })}
                    {actuatorKeys.map((key, idx) => {
                        const isHidden = !activeSensors[key];
                        const meta = getMeta(key, idx, true);
                        return (
                            <button
                                type="button"
                                key={key}
                                onClick={() => toggleSensor && toggleSensor(key)}
                                className={`flex items-center gap-2 px-3 py-1.5 border text-[10px] font-black tracking-wider transition-all duration-200 select-none cursor-pointer active:scale-95 shrink-0 ${
                                    isHidden 
                                        ? 'bg-slate-950/20 border-slate-900 text-slate-600 line-through opacity-40' 
                                        : 'bg-violet-950/15 border-violet-500/20 text-violet-400 hover:border-violet-400/40'
                                }`}
                            >
                                 <span className="w-2 h-2 shrink-0" style={{ backgroundColor: isHidden ? '#334155' : meta.color }} />
                                <span className="whitespace-nowrap">{meta.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="relative w-full flex-1 min-h-[320px] sm:min-h-[450px] lg:min-h-[500px] overflow-hidden">
                <Line data={data} options={options} />
            </div>
        </div>
    );
}

export default ParameterTrends;
