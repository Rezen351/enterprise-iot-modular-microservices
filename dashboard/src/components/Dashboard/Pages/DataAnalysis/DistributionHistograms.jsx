import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const getHistogramMeta = (key, idx, dataset) => {
  const PREDEFINED = {
    temp_out:   { label: 'TEMP OUT (°C)',  color: '#f97316', xLabels: ['10', '15', '20', '25', '30', '35', '40'] },
    temp_in:    { label: 'TEMP IN (°C)',   color: '#10b981', xLabels: ['10', '14', '18', '22', '26', '30', '34', '38'] },
    water_temp: { label: 'WATER TEMP (°C)', color: '#06b6d4', xLabels: ['14', '17', '20', '23', '26', '29', '32'] },
    hum_out:    { label: 'HUM OUT (%)',    color: '#f59e0b', xLabels: ['20', '35', '50', '65', '80', '95', '100'] },
    hum_in:     { label: 'HUM IN (%)',     color: '#eab308', xLabels: ['40', '50', '60', '70', '80', '90', '100'] },
    ec:         { label: 'EC (mS/cm)',    color: '#3b82f6', xLabels: ['0.6', '0.9', '1.2', '1.5', '1.8', '2.1', '2.4'] },
    ph:         { label: 'pH',             color: '#a855f7', xLabels: ['4.0', '4.5', '5.0', '5.5', '6.0', '6.5', '7.0'] }
  };
  
  if (PREDEFINED[key]) return PREDEFINED[key];
  
  const colors = ['#f97316', '#10b981', '#06b6d4', '#f59e0b', '#eab308', '#3b82f6', '#a855f7', '#ec4899'];
  const color = colors[idx % colors.length];
  
  let xLabels = ['1', '2', '3', '4', '5', '6', '7'];
  const arr = dataset?.telemetry?.[key];
  if (arr && arr.length > 0) {
    const validVals = arr.filter(v => v !== null && v !== undefined);
    if (validVals.length > 0) {
      let minVal = Math.min(...validVals);
      let maxVal = Math.max(...validVals);
      if (minVal === maxVal) {
        minVal -= 1;
        maxVal += 1;
      }
      const step = (maxVal - minVal) / 6;
      xLabels = Array.from({ length: 7 }, (_, i) => (minVal + i * step).toFixed(1));
    }
  }
  
  return {
    label: key.replace(/_/g, ' ').toUpperCase(),
    color,
    xLabels
  };
};

function DistributionHistograms({ histograms, dataset }) {
  const data = histograms || {};
  const keys = Object.keys(data);

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6 h-full flex flex-col justify-between">
      <h3 className="text-sm font-black font-display text-white tracking-widest uppercase border-b border-emerald-500/10 pb-4 mb-4">
        Distribution (Histogram)
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 overflow-y-auto max-h-[340px] pr-1.5 scrollbar-thin">
        {keys.map((key, idx) => {
          const vals = data[key] || [0, 0, 0, 0, 0, 0, 0];
          const meta = getHistogramMeta(key, idx, dataset);
          const yMax = Math.max(5, ...vals);

          const chartData = {
            labels: meta.xLabels,
            datasets: [
              {
                data: vals,
                backgroundColor: meta.color,
                borderColor: meta.color,
                borderWidth: 0,
                borderRadius: 2,
                hoverBackgroundColor: meta.color
              }
            ]
          };

          const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(4, 12, 8, 0.95)',
                titleColor: '#64748b',
                titleFont: { family: 'Outfit, sans-serif', weight: '900', size: 9 },
                bodyColor: '#e2e8f0',
                bodyFont: { family: 'Outfit, sans-serif', weight: 'bold', size: 10 },
                borderColor: 'rgba(16, 185, 129, 0.25)',
                borderWidth: 1,
                padding: 6,
                cornerRadius: 6,
                callbacks: {
                  label: (context) => ` Count: ${context.parsed.y}`
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: '#64748b',
                  font: { family: 'Outfit, sans-serif', weight: 'bold', size: 8 }
                }
              },
              y: {
                min: 0,
                max: yMax,
                ticks: {
                  color: '#64748b',
                  font: { family: 'Outfit, sans-serif', weight: 'bold', size: 8 },
                  stepSize: Math.max(1, Math.round(yMax / 2))
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.04)',
                  drawTicks: false
                }
              }
            }
          };

          return (
            <div key={key} className="bg-slate-950/20 border border-slate-900 p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-black text-center mb-1.5" style={{ color: meta.color }}>
                {meta.label}
              </span>
              
              <div className="relative w-full h-[90px]">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DistributionHistograms;
