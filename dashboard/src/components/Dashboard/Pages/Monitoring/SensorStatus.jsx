import { useState } from 'react';
import { ShieldCheck, Maximize2 } from 'lucide-react';

function SensorStatus({ activeModuleData }) {
  const [sensorType, setSensorType] = useState('temperature'); // 'temperature' | 'humidity' | 'other'

  // Extract real values with null fallbacks (no more mockup data)
  const itemTempInner = activeModuleData?.sensors?.cwt_dalam_temp?.value ?? null;
  const itemTempOuter = activeModuleData?.sensors?.cwt_luar_temp?.value ?? null;
  const itemTempWater = activeModuleData?.sensors?.npk_temp_air?.value ?? null;

  const itemHumInner = activeModuleData?.sensors?.cwt_dalam_hum?.value ?? null;
  const itemHumOuter = activeModuleData?.sensors?.cwt_luar_hum?.value ?? null;

  const itemPh = activeModuleData?.sensors?.npk_ph?.value ?? null;
  const itemEc = activeModuleData?.sensors?.npk_ec?.value ?? null;
  const rawReservoirVal = activeModuleData?.sensors?.reservoir_status?.value;
  const isReservoirFull = rawReservoirVal === true || rawReservoirVal === 1;

  const getSensorsList = () => {
    switch (sensorType) {
      case 'temperature':
        return [
          { label: 'Inside Temperature', value: itemTempInner !== null ? `${itemTempInner} C` : '--' },
          { label: 'Outside Temperature', value: itemTempOuter !== null ? `${itemTempOuter} C` : '--' },
          { label: 'Water Temperature', value: itemTempWater !== null ? `${itemTempWater} C` : '--' }
        ];
      case 'humidity':
        return [
          { label: 'Inside Humidity', value: itemHumInner !== null ? `${itemHumInner} %` : '--' },
          { label: 'Outside Humidity', value: itemHumOuter !== null ? `${itemHumOuter} %` : '--' }
        ];
      case 'other':
      default:
        return [
          { label: 'pH Balance', value: itemPh !== null ? `${itemPh} pH` : '--' },
          { label: 'EC Level', value: itemEc !== null ? `${itemEc} mS/cm` : '--' }
        ];
    }
  };

  const sensors = getSensorsList();

  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3.5 sm:p-6 flex flex-col h-auto md:h-[380px] justify-between relative overflow-hidden group">


      {/* Header */}
      <div className="flex items-center justify-between z-10 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-black text-white uppercase tracking-widest">Sensors</span>
        </div>
        
        {/* Selector (Segmented Tab Control - HMI Touch Target >= 48px) */}
        <div className="flex bg-[#020604] border border-emerald-500/20 p-0.5 z-10 h-9 sm:h-12 items-center shrink-0">
          <button
            type="button"
            onClick={() => setSensorType('temperature')}
            className={`px-3 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider transition-all duration-150 select-none active:scale-95 cursor-pointer ${
              sensorType === 'temperature'
                ? 'bg-emerald-500 text-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Temp
          </button>
          <button
            type="button"
            onClick={() => setSensorType('humidity')}
            className={`px-3 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider transition-all duration-150 select-none active:scale-95 cursor-pointer ${
              sensorType === 'humidity'
                ? 'bg-emerald-500 text-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Hum
          </button>
          <button
            type="button"
            onClick={() => setSensorType('other')}
            className={`px-3 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider transition-all duration-150 select-none active:scale-95 cursor-pointer ${
              sensorType === 'other'
                ? 'bg-emerald-500 text-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Nutrients
          </button>
        </div>
      </div>

      {/* Sensor values list */}
      <div className="flex-1 flex flex-col justify-center gap-4 my-2.5 sm:my-4 z-10 w-full">
        {sensors.map((sensor) => (
          <button
            type="button"
            key={sensor.label}
            onClick={() => alert(`Maximize graph for ${sensor.label}`)}
            className="w-full flex items-center justify-between p-2.5 sm:p-3.5 border border-slate-900/60 bg-[#020604]/50 group/item hover:border-emerald-500/25 transition-all select-none active:scale-[0.98] cursor-pointer text-left focus:outline-none"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{sensor.label}</span>
              <span className={`text-sm font-black tracking-wider mt-1 truncate uppercase ${
                sensor.value === 'EMPTY' ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {sensor.label.split(' ')[0]}
              </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
              <span className={`text-2xl font-black font-display ${
                sensor.value === 'EMPTY'
                  ? 'text-red-400 '
                  : 'text-emerald-400 '
              }`}>
                {sensor.value.split(' ')[0]}
                <span className={`text-xs font-bold ml-1 ${
                  sensor.value === 'EMPTY' ? 'text-red-400/80' : 'text-emerald-400/80'
                }`}>{sensor.value.split(' ')[1]}</span>
              </span>
              <div 
                className="p-1 bg-slate-950/50 border border-slate-900 text-slate-600 group-hover/item:text-emerald-400 group-hover/item:border-emerald-500/20 transition-all"
                title="Maximize Graph"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Link */}
      <div className="border-t border-emerald-500/10 pt-2.5 z-10 flex justify-end">
        <a 
          href="#/settings" 
          className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
        >
          <span>Controls</span>
          <span>&rarr;</span>
        </a>
      </div>
    </div>
  );
}

export default SensorStatus;
