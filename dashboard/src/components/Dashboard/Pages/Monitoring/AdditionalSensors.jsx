import { Cpu, Maximize2 } from 'lucide-react';

const STANDARD_SENSORS = [
  'cwt_dalam_temp', 'cwt_luar_temp', 'npk_temp_air',
  'cwt_dalam_hum', 'cwt_luar_hum',
  'npk_ph', 'npk_ec',
  'reservoir_status', 'laser_1', 'laser_2', 'laser_status'
];

function AdditionalSensors({ activeModuleData }) {
  const sensors = activeModuleData?.sensors || {};

  // Filter sensor yang bukan sensor standar bawaan
  const additionalList = Object.entries(sensors)
    .filter(([key]) => !STANDARD_SENSORS.includes(key))
    .map(([key, sensor]) => {
      // Guess type dan unit berdasarkan nama key
      const name = key.replace(/_/g, ' ').toUpperCase();
      let value = sensor.value;
      let unit = '';
      let colorClass = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';

      const keyLower = key.toLowerCase();
      if (keyLower.includes('temp')) {
        unit = '°C';
        colorClass = 'text-orange-400 border-orange-500/20 bg-orange-500/5';
      } else if (keyLower.includes('hum') || keyLower.includes('kelembaban')) {
        unit = '%';
        colorClass = 'text-blue-400 border-blue-500/20 bg-blue-500/5';
      } else if (keyLower.includes('ph')) {
        unit = 'pH';
        colorClass = 'text-purple-400 border-purple-500/20 bg-purple-500/5';
      } else if (keyLower.includes('ec')) {
        unit = 'mS/cm';
        colorClass = 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5';
      } else if (keyLower.includes('lux') || keyLower.includes('light') || keyLower.includes('cahaya')) {
        unit = 'lux';
        colorClass = 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      } else if (keyLower.includes('nitrogen') || keyLower.includes('potassium') || keyLower.includes('phosphorus') || keyLower.includes('npk')) {
        unit = 'ppm';
        colorClass = 'text-teal-400 border-teal-500/20 bg-teal-500/5';
      }

      return {
        key,
        name,
        value,
        unit,
        colorClass
      };
    });

  if (additionalList.length === 0) return null;

  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3.5 sm:p-6 relative overflow-hidden group w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
        <span className="text-xs font-black text-white uppercase tracking-widest">Extra Sensors</span>
      </div>

      {/* Grid of Dynamic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {additionalList.map((sensor) => (
          <button
            type="button"
            key={sensor.key}
            onClick={() => alert(`Maximize graph for ${sensor.name}`)}
            className={`flex items-center justify-between p-3.5 border group/item transition-all select-none active:scale-[0.98] cursor-pointer text-left focus:outline-none bg-slate-950/40 hover:border-emerald-500/30 ${sensor.colorClass}`}
          >
            <div className="flex flex-col min-w-0">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate">{sensor.name}</span>
              <span className="text-sm font-black tracking-wider mt-0.5 text-slate-300">
                ACTIVE
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xl font-black font-display ">
                {sensor.value !== null && sensor.value !== undefined ? (
                  typeof sensor.value === 'number' ? sensor.value.toFixed(1) : String(sensor.value)
                ) : '--'}
                <span className="text-xs font-bold ml-0.5 opacity-80">{sensor.unit}</span>
              </span>
              <div 
                className="p-1 bg-slate-950/70 border border-slate-900 text-slate-600 group-hover/item:text-emerald-400 group-hover/item:border-emerald-500/20 transition-all"
                title="Maximize Graph"
              >
                <Maximize2 className="w-3 h-3" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default AdditionalSensors;
