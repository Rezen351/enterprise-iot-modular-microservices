import { Droplets, TrendingUp } from 'lucide-react';

function NutrientWaterStatus({ activeModuleData, alertsConfig }) {
  // Extract values with null fallbacks (no more mockup data)
  const ec = activeModuleData?.sensors?.npk_ec?.value ?? null;
  const ph = activeModuleData?.sensors?.npk_ph?.value ?? null;
  const wtemp = activeModuleData?.sensors?.npk_temp_air?.value ?? null;
  const rawLevelValue = activeModuleData?.sensors?.reservoir_status?.value;
  const isReservoirFull = rawLevelValue === true || rawLevelValue === 1;

  // Extract alert threshold settings
  const ecConfig = alertsConfig?.ec_level;
  const phConfig = alertsConfig?.ph_level;
  const wtempConfig = alertsConfig?.water_temp;
  const reservoirConfig = alertsConfig?.reservoir_level;

  const ecMin = ecConfig?.min !== undefined ? parseFloat(ecConfig.min) : 1.20;
  const ecMax = ecConfig?.max !== undefined ? parseFloat(ecConfig.max) : 1.80;
  const phMin = phConfig?.min !== undefined ? parseFloat(phConfig.min) : 5.5;
  const phMax = phConfig?.max !== undefined ? parseFloat(phConfig.max) : 6.5;
  const tempMin = wtempConfig?.min !== undefined ? parseFloat(wtempConfig.min) : 18.0;
  const tempMax = wtempConfig?.max !== undefined ? parseFloat(wtempConfig.max) : 26.0;

  const formatVal = (v) => Number.isInteger(v) ? v : v.toFixed(1);

  const getStatus = (val, min, max, severity = 'critical') => {
    if (val === null || val === undefined) return 'Offline';
    if (val >= min && val <= max) return 'Optimal';
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  const ecStatus = getStatus(ec, ecMin, ecMax, ecConfig?.severity);
  const phStatus = getStatus(ph, phMin, phMax, phConfig?.severity);
  const tempStatus = getStatus(wtemp, tempMin, tempMax, wtempConfig?.severity);
  
  const wlSeverity = reservoirConfig?.severity || 'critical';
  const wlStatus = rawLevelValue === undefined ? 'Offline' : (isReservoirFull ? 'Optimal' : (wlSeverity.charAt(0).toUpperCase() + wlSeverity.slice(1)));

  const parameters = [
    { name: 'EC', value: ec !== null ? `${ec} mS/cm` : '--', range: `${ecMin.toFixed(2)} - ${ecMax.toFixed(2)}`, status: ecStatus, raw: ec },
    { name: 'pH', value: ph !== null ? `${ph}` : '--', range: `${phMin.toFixed(1)} - ${phMax.toFixed(1)}`, status: phStatus, raw: ph },
    { name: 'Water Temp', value: wtemp !== null ? `${wtemp} °C` : '--', range: `${formatVal(tempMin)} - ${formatVal(tempMax)} °C`, status: tempStatus, raw: wtemp },
    { name: 'Water Level', value: rawLevelValue === undefined ? '--' : (isReservoirFull ? 'FULL' : 'EMPTY'), range: 'FULL / EMPTY', status: wlStatus, raw: isReservoirFull }
  ];

  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3.5 sm:p-6 flex flex-col h-auto md:h-[380px] justify-between relative overflow-hidden group">


      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-black text-white uppercase tracking-widest">
            Nutrients & Water
          </span>
        </div>
      </div>

      {/* Mini Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2.5 sm:my-4 z-10">
        {parameters.map((param) => (
          <div key={param.name} className="p-1.5 sm:p-2 border border-slate-900 bg-[#020604]/50 flex flex-col justify-between h-[68px] sm:h-[80px]">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{param.name}</span>
            <span className="text-xs font-black text-white truncate my-0.5">{param.value}</span>
            <span className={`text-[7px] font-black uppercase tracking-wider border px-1 py-0.5 rounded text-center ${
              param.status === 'Optimal'
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : param.status === 'Warning'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>
              {param.status}
            </span>
          </div>
        ))}
      </div>

      {/* Table Summary */}
      <div className="flex-1 w-full overflow-hidden z-10 border border-slate-950 bg-[#020604]/60 p-2 sm:p-3 flex flex-col justify-between mb-4">
        <div className="flex items-center justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-900 pb-1.5 px-1.5">
          <span className="w-1/3">Parameter</span>
          <span className="w-1/5 text-center">Value</span>
          <span className="w-1/4 text-center">Range</span>
          <span className="w-1/5 text-right">Status</span>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-1.5 py-2">
          {parameters.map((param) => (
            <div key={param.name} className="flex items-center justify-between text-[10px] font-medium text-slate-300 px-1.5 py-0.5 hover:bg-slate-900/25 transition-all">
              <span className="w-1/3 font-black text-white text-[9px] uppercase tracking-wider">{param.name}</span>
              <span className="w-1/5 text-center text-slate-400 font-bold">{param.value.split(' ')[0]}</span>
              <span className="w-1/4 text-center text-slate-500 text-[8px] font-bold">{param.range}</span>
              <span className="w-1/5 text-right flex items-center justify-end gap-1">
                <span className={`w-1.5 h-1.5 ${
                  param.status === 'Optimal' 
                    ? 'bg-emerald-400' 
                    : param.status === 'Warning'
                      ? 'bg-amber-400'
                      : 'bg-red-400'
                }`} />
                <span className={`text-[8px] font-black uppercase tracking-wide ${
                  param.status === 'Optimal' 
                    ? 'text-emerald-400' 
                    : param.status === 'Warning'
                      ? 'text-amber-400'
                      : 'text-red-400'
                }`}>{param.status}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer link */}
      <div className="border-t border-emerald-500/10 pt-2.5 z-10 flex justify-end">
        <a 
          href="#/data-analysis" 
          className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
        >
          <span>Trends</span>
          <span>&rarr;</span>
        </a>
      </div>
    </div>
  );
}

export default NutrientWaterStatus;
