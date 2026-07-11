import { useState } from 'react';
import { ShieldAlert, Plus, X, Trash2, Info } from 'lucide-react';
import ToggleSwitch from '../../ToggleSwitch';

function TouchDecimalInput({ value, onChange, label, unit, step = 0.1, min = 0, max = 9999, disabled = false }) {
  const handleDecrement = () => {
    if (disabled) return;
    const newVal = parseFloat((value - step).toFixed(2));
    onChange(Math.max(min, newVal));
  };

  const handleIncrement = () => {
    if (disabled) return;
    const newVal = parseFloat((value + step).toFixed(2));
    onChange(Math.min(max, newVal));
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>}
      <div className="flex items-center bg-slate-950 border border-slate-800 overflow-hidden h-12">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={handleDecrement}
          className="w-12 h-full flex items-center justify-center text-xl font-black text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border-r border-slate-800 select-none disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
        >
          -
        </button>
        <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 min-w-0">
          <input
            type="number"
            step={step}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) {
                onChange(val);
              } else if (e.target.value === '') {
                onChange(0);
              }
            }}
            className="w-full min-w-0 bg-transparent text-center font-mono text-base font-black text-white focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && <span className="text-[11px] text-emerald-400 font-black pr-2 shrink-0 select-none uppercase">{unit}</span>}
        </div>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={handleIncrement}
          className="w-12 h-full flex items-center justify-center text-xl font-black text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border-l border-slate-800 select-none disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

const ALERT_CONFIGS = {
  air_temperature: { step: 0.5, min: 0, max: 80, unit: '°C' },
  humidity: { step: 1.0, min: 0, max: 100, unit: '%' },
  water_temperature: { step: 0.5, min: 0, max: 80, unit: '°C' },
  ph_level: { step: 0.05, min: 0, max: 14, unit: 'pH' },
  ec_level: { step: 0.05, min: 0, max: 10, unit: 'mS/cm' },
  water_level: { step: 1.0, min: 0, max: 200, unit: 'cm' },
  nutrient_level: { step: 1.0, min: 0, max: 100, unit: '%' },
  light_intensity: { step: 10, min: 0, max: 100000, unit: 'lux' }
};

function AlertSettings({ alerts = [], setAlerts, availableSensors = [] }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSensorDbId, setSelectedSensorDbId] = useState('');
  const [minLimit, setMinLimit] = useState(0);
  const [maxLimit, setMaxLimit] = useState(100);
  const [severity, setSeverity] = useState('warning');
  const [channelUi, setChannelUi] = useState(true);
  const [channelEmail, setChannelEmail] = useState(false);
  const [channelTelegram, setChannelTelegram] = useState(false);
  const [triggerValue, setTriggerValue] = useState(true);
  const [customName, setCustomName] = useState('');

  // Filter out sensors already configured
  const unconfiguredSensors = (availableSensors || []).filter(
    dbSens => !(alerts || []).some(a => a.sensor_db_id === dbSens.db_id)
  );

  const getSensorConfig = (sensorType) => {
    const key = (sensorType || '').toLowerCase().replace(/\s+/g, '_');
    return ALERT_CONFIGS[key] || { step: 1.0, min: 0, max: 9999, unit: '' };
  };

  const handleSelectSensor = (dbIdStr) => {
    setSelectedSensorDbId(dbIdStr);
    const dbId = parseInt(dbIdStr);
    const dbSens = (availableSensors || []).find(s => s.db_id === dbId);
    if (dbSens) {
      setCustomName(dbSens.name.replace(/_/g, ' ').toUpperCase() + ' ALERT');
      const conf = getSensorConfig(dbSens.type);
      setMinLimit(conf.min);
      setMaxLimit(conf.max);
    } else {
      setCustomName('');
    }
  };

  const handleAddAlert = (e) => {
    e.preventDefault();
    if (!selectedSensorDbId || !customName.trim()) {
      alert('Pilih sensor dan isi nama alarm!');
      return;
    }

    const dbId = parseInt(selectedSensorDbId);
    const dbSens = (availableSensors || []).find(s => s.db_id === dbId);
    if (!dbSens) return;

    const isBool = dbSens.type?.toLowerCase().includes('boolean') || 
                   dbSens.name?.toLowerCase().includes('status') || 
                   dbSens.name?.toLowerCase().includes('laser') || 
                   dbSens.type?.toLowerCase().includes('laser') || 
                   dbSens.type?.toLowerCase().includes('detector');

    const conf = getSensorConfig(dbSens.type);

    const newAlert = {
      sensor_db_id: dbId,
      key: dbSens.name.toLowerCase().replace(/\s+/g, '_'),
      name: customName.trim(),
      unit: conf.unit,
      severity: severity,
      isActive: true,
      isBoolean: isBool,
      triggerValue: isBool ? triggerValue : undefined,
      min: isBool ? 0 : parseFloat(minLimit),
      max: isBool ? 1 : parseFloat(maxLimit),
      channelUi: channelUi,
      channelEmail: channelEmail,
      channelTelegram: channelTelegram
    };

    setAlerts(prev => [...(prev || []), newAlert]);

    // Reset Form
    setSelectedSensorDbId('');
    setCustomName('');
    setMinLimit(0);
    setMaxLimit(100);
    setSeverity('warning');
    setChannelUi(true);
    setChannelEmail(false);
    setChannelTelegram(false);
    setTriggerValue(true);
    setShowAddForm(false);
  };

  const handleRemoveAlert = (index) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus batas alarm untuk sensor ini?')) {
      setAlerts(prev => (prev || []).filter((_, idx) => idx !== index));
    }
  };

  const updateAlertField = (index, updates) => {
    setAlerts(prev => (prev || []).map((item, idx) => idx === index ? { ...item, ...updates } : item));
  };

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6">
      <div className="border-b border-emerald-500/10 pb-4 mb-4 sm:mb-6 flex items-center justify-between">
        <h3 className="text-sm font-black font-display text-white tracking-widest uppercase flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-emerald-400" />
          Threshold Guard Limits
        </h3>
        
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold uppercase transition-all select-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Alert
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddAlert} className="mb-6 p-4 border border-emerald-500/20 bg-emerald-950/5 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
            <h4 className="text-xs font-black text-white uppercase tracking-widest">Configure Alert Guard</h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Select Sensor</label>
              <select
                value={selectedSensorDbId}
                onChange={(e) => handleSelectSensor(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-bold px-4 h-12 focus:border-emerald-500 focus:outline-none cursor-pointer"
                required
              >
                <option value="">-- Pilih Sensor Modul --</option>
                {unconfiguredSensors.map(sens => (
                  <option key={sens.db_id} value={sens.db_id}>
                    {sens.name} ({sens.type})
                  </option>
                ))}
              </select>
              <span className="text-[9px] text-slate-500 font-mono mt-1 select-none">
                Debug: Available={availableSensors?.length || 0}, Unconfigured={unconfiguredSensors?.length || 0}, Alerts={alerts?.length || 0}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Severity Level</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-bold px-4 h-12 focus:border-emerald-500 focus:outline-none cursor-pointer"
                required
              >
                <option value="info">INFO (Low)</option>
                <option value="warning">WARNING (Medium)</option>
                <option value="critical">CRITICAL (High)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Alert Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Air Temp Alert"
                className="w-full h-12 bg-slate-950 border border-slate-800 px-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {selectedSensorDbId && (() => {
            const dbSens = availableSensors.find(s => s.db_id === parseInt(selectedSensorDbId));
            const isBool = dbSens?.type?.toLowerCase().includes('boolean') || 
                           dbSens?.name?.toLowerCase().includes('status') || 
                           dbSens?.name?.toLowerCase().includes('laser') || 
                           dbSens?.type?.toLowerCase().includes('laser') || 
                           dbSens?.type?.toLowerCase().includes('detector');
            const conf = getSensorConfig(dbSens?.type);

            if (isBool) {
              return (
                <div className="flex flex-col gap-3 p-4 border border-cyan-500/15 bg-cyan-950/5">
                  <div className="flex items-center gap-3 border-b border-cyan-500/10 pb-2">
                    <div className="w-2 h-2 bg-cyan-400 shrink-0 animate-pulse" />
                    <p className="text-[11px] font-black text-cyan-400 uppercase tracking-widest">
                      Boolean State Logic (Active High / Active Low)
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Picu Alarm Saat Sensor Bernilai</label>
                    <select
                      value={triggerValue ? 'true' : 'false'}
                      onChange={(e) => setTriggerValue(e.target.value === 'true')}
                      className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-bold px-4 h-12 focus:border-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="true">TRUE / 1 (Active High / Alarm saat terdeteksi)</option>
                      <option value="false">FALSE / 0 (Active Low / Alarm saat terputus)</option>
                    </select>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TouchDecimalInput
                  label="Lower Limit (MIN)"
                  value={minLimit}
                  step={conf.step}
                  min={conf.min}
                  max={conf.max}
                  unit={conf.unit}
                  onChange={setMinLimit}
                />
                <TouchDecimalInput
                  label="Upper Limit (MAX)"
                  value={maxLimit}
                  step={conf.step}
                  min={conf.min}
                  max={conf.max}
                  unit={conf.unit}
                  onChange={setMaxLimit}
                />
              </div>
            );
          })()}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-emerald-500/10 pt-3 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">Alert Channels:</span>
              <button
                type="button"
                onClick={() => setChannelUi(prev => !prev)}
                className={`px-3 py-1.5 text-[10px] font-black border transition-all cursor-pointer ${channelUi ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
              >
                DASHBOARD
              </button>
              <button
                type="button"
                onClick={() => setChannelEmail(prev => !prev)}
                className={`px-3 py-1.5 text-[10px] font-black border transition-all cursor-pointer ${channelEmail ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
              >
                EMAIL
              </button>
              <button
                type="button"
                onClick={() => setChannelTelegram(prev => !prev)}
                className={`px-3 py-1.5 text-[10px] font-black border transition-all cursor-pointer ${channelTelegram ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
              >
                TELEGRAM
              </button>
            </div>

            <button
              type="submit"
              className="px-6 py-2 border border-emerald-500/30 bg-emerald-500 text-black text-xs font-black uppercase transition-all select-none hover:bg-emerald-400 active:scale-[0.98] cursor-pointer"
            >
              Add Guard Limit
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-6 max-h-[650px] overflow-y-auto pr-1">
        {(alerts || []).map((item, index) => {
          const config = getSensorConfig(item.name);
          const isBooleanAlert = item.isBoolean || 
                                 item.key?.includes('reservoir') || 
                                 item.key?.includes('laser') || 
                                 item.key?.includes('detector') || 
                                 item.key?.includes('status');

          return (
            <div key={index} className="border border-emerald-500/10 bg-[#040c08]/40 p-3 sm:p-6 flex flex-col gap-4 sm:gap-5 relative">
              <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`w-3.5 h-3.5 shrink-0 ${item.severity === 'critical' ? 'bg-red-400' : item.severity === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateAlertField(index, { name: e.target.value })}
                    className="bg-transparent border-b border-transparent hover:border-slate-850 focus:border-emerald-500 focus:outline-none text-base font-black text-white uppercase px-1 py-0.5 min-w-[200px]"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <ToggleSwitch
                    checked={item.isActive}
                    onChange={(val) => updateAlertField(index, { isActive: val })}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAlert(index)}
                    className="p-1.5 border border-slate-800 hover:border-red-500/40 bg-black/40 hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors cursor-pointer select-none"
                    title="Hapus Alarm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {!isBooleanAlert && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <TouchDecimalInput
                    label="Lower Limit (MIN)"
                    value={item.min}
                    disabled={!item.isActive}
                    step={config.step}
                    min={config.min}
                    max={config.max}
                    unit={item.unit}
                    onChange={(val) => updateAlertField(index, { min: val })}
                  />

                  <TouchDecimalInput
                    label="Upper Limit (MAX)"
                    value={item.max}
                    disabled={!item.isActive}
                    step={config.step}
                    min={config.min}
                    max={config.max}
                    unit={item.unit}
                    onChange={(val) => updateAlertField(index, { max: val })}
                  />
                </div>
              )}

              {isBooleanAlert && (
                <div className="flex flex-col gap-3 p-4 border border-cyan-500/15 bg-cyan-950/5">
                  <div className="flex items-center gap-3 border-b border-cyan-500/10 pb-2">
                    <div className="w-2 h-2 bg-cyan-400 shrink-0 animate-pulse" />
                    <p className="text-[11px] font-black text-cyan-400 uppercase tracking-widest">
                      Boolean State Logic (Active High / Active Low)
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Picu Alarm Saat Sensor Bernilai</label>
                    <select
                      value={item.triggerValue !== undefined ? String(item.triggerValue) : 'true'}
                      disabled={!item.isActive}
                      onChange={(e) => updateAlertField(index, { triggerValue: e.target.value === 'true' })}
                      className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-bold px-4 h-12 focus:border-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="true">TRUE / 1 (Active High / Alarm saat terdeteksi)</option>
                      <option value="false">FALSE / 0 (Active Low / Alarm saat terputus)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Channels & Severity settings */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between text-[11px] font-black text-slate-500 border-t border-slate-800/40 pt-3 sm:pt-4 gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <span className="uppercase tracking-widest">SEVERITY:</span>
                  <select
                    value={item.severity}
                    onChange={(e) => updateAlertField(index, { severity: e.target.value })}
                    className="bg-slate-950 border border-slate-800 text-slate-300 font-black px-4 h-10 sm:h-11 focus:outline-none cursor-pointer uppercase text-[11px] sm:text-xs"
                  >
                    <option value="info">INFO (Low)</option>
                    <option value="warning">WARNING (Med)</option>
                    <option value="critical">CRITICAL (High)</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="uppercase tracking-widest pr-1">NOTIFICATION CHANNELS:</span>
                  <button
                    type="button"
                    disabled={!item.isActive}
                    onClick={() => updateAlertField(index, { channelUi: !item.channelUi })}
                    className={`h-10 sm:h-11 px-3 sm:px-4 text-[10px] font-black border transition-all cursor-pointer select-none flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none uppercase tracking-widest ${item.channelUi
                        ? 'bg-emerald-500 text-black border-emerald-500'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                  >
                    DASHBOARD
                  </button>
                  <button
                    type="button"
                    disabled={!item.isActive}
                    onClick={() => updateAlertField(index, { channelEmail: !item.channelEmail })}
                    className={`h-10 sm:h-11 px-3 sm:px-4 text-[10px] font-black border transition-all cursor-pointer select-none flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none uppercase tracking-widest ${item.channelEmail
                        ? 'bg-emerald-500 text-black border-emerald-500'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                  >
                    EMAIL
                  </button>
                  <button
                    type="button"
                    disabled={!item.isActive}
                    onClick={() => updateAlertField(index, { channelTelegram: !item.channelTelegram })}
                    className={`h-10 sm:h-11 px-3 sm:px-4 text-[10px] font-black border transition-all cursor-pointer select-none flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none uppercase tracking-widest ${item.channelTelegram
                        ? 'bg-emerald-500 text-black border-emerald-500'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                  >
                    TELEGRAM
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {(alerts || []).length === 0 && (
          <div className="border border-dashed border-slate-850 p-8 text-center text-slate-500 font-bold uppercase tracking-wider text-xs">
            Belum ada batas alarm yang ditambahkan.
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertSettings;
