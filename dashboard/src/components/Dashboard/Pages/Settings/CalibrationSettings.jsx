import { useState } from 'react';
import { Sliders, Activity, Play, Plus, X, Trash2 } from 'lucide-react';

function CalibrationTouchInput({ value, onChange, label, step = 0.1, min = -99, max = 99, disabled = false }) {
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
    <div className="flex flex-col gap-1.5 w-full">
      {label && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>}
      <div className="flex items-center bg-slate-950 border border-slate-800 overflow-hidden h-10 sm:h-12">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={handleDecrement}
          className="w-12 h-full flex items-center justify-center text-lg font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border-r border-slate-800 select-none disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
        >
          -
        </button>
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
          className="flex-1 min-w-0 bg-transparent text-center font-mono text-sm font-bold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={handleIncrement}
          className="w-12 h-full flex items-center justify-center text-lg font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border-l border-slate-800 select-none disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

const CALIB_CONFIGS = {
  air_temperature: { step: 0.1, min: -10, max: 10 },
  humidity: { step: 0.5, min: -20, max: 20 },
  water_temperature: { step: 0.1, min: -10, max: 10 },
  ph_level: { step: 0.05, min: -5, max: 5 },
  ec_level: { step: 0.05, min: -2, max: 2 },
  water_level: { step: 1.0, min: -50, max: 50 },
  nutrient_level: { step: 0.5, min: -20, max: 20 },
  light_intensity: { step: 1.0, min: -1000, max: 1000 }
};

function CalibrationSettings({
  calibrations = [],
  setCalibrations,
  availableSensors = [],
  activeCalibTest,
  setActiveCalibTest,
  testRawInput,
  setTestRawInput,
  testResult,
  handleRunCalibrationTest
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSensorDbId, setSelectedSensorDbId] = useState('');
  const [customName, setCustomName] = useState('');
  const [method, setMethod] = useState('offset');
  const [offsetVal, setOffsetVal] = useState(0.0);
  const [formulaVal, setFormulaVal] = useState('x');

  // Filter out configured sensors
  const unconfiguredSensors = (availableSensors || []).filter(
    dbSens => !(calibrations || []).some(c => c.sensor_db_id === dbSens.db_id)
  );

  const getSensorConfig = (sensorType) => {
    const key = (sensorType || '').toLowerCase().replace(/\s+/g, '_');
    return CALIB_CONFIGS[key] || { step: 0.1, min: -100, max: 100 };
  };

  const handleSelectSensor = (dbIdStr) => {
    setSelectedSensorDbId(dbIdStr);
    const dbId = parseInt(dbIdStr);
    const dbSens = (availableSensors || []).find(s => s.db_id === dbId);
    if (dbSens) {
      setCustomName(dbSens.name.replace(/_/g, ' ').toUpperCase() + ' SENSOR');
    } else {
      setCustomName('');
    }
  };

  const handleAddCalibration = (e) => {
    e.preventDefault();
    if (!selectedSensorDbId || !customName.trim()) {
      alert('Pilih sensor dan tentukan nama kalibrasi!');
      return;
    }

    const dbId = parseInt(selectedSensorDbId);
    const dbSens = (availableSensors || []).find(s => s.db_id === dbId);
    if (!dbSens) return;

    const newCalib = {
      sensor_db_id: dbId,
      key: dbSens.name.toLowerCase().replace(/\s+/g, '_'),
      name: customName.trim(),
      method: method,
      offset: parseFloat(offsetVal),
      formula: formulaVal.trim(),
      rawValue: 20.0
    };

    setCalibrations(prev => [...(prev || []), newCalib]);

    // Reset Form
    setSelectedSensorDbId('');
    setCustomName('');
    setMethod('offset');
    setOffsetVal(0.0);
    setFormulaVal('x');
    setShowAddForm(false);
  };

  const handleRemoveCalibration = (index) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus kalibrasi untuk sensor ini?')) {
      setCalibrations(prev => (prev || []).filter((_, idx) => idx !== index));
    }
  };

  const updateCalibField = (index, updates) => {
    setCalibrations(prev => (prev || []).map((item, idx) => idx === index ? { ...item, ...updates } : item));
  };

  const activeSensor = (calibrations || []).find(c => c.key === activeCalibTest);

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6">
      <div className="border-b border-emerald-500/10 pb-4 mb-4 sm:mb-5 flex items-center justify-between">
        <h3 className="text-xs font-bold font-display text-white tracking-widest uppercase flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-emerald-400" />
          Sensor Calibration
        </h3>
        
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold uppercase transition-all select-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Calibration
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddCalibration} className="mb-6 p-4 border border-emerald-500/20 bg-emerald-950/5 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
            <h4 className="text-xs font-black text-white uppercase tracking-widest">Configure Calibration</h4>
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
                Debug: Available={availableSensors?.length || 0}, Unconfigured={unconfiguredSensors?.length || 0}, Calibrations={calibrations?.length || 0}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Calibration Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-bold px-4 h-12 focus:border-emerald-500 focus:outline-none cursor-pointer"
                required
              >
                <option value="offset">OFFSET ONLY</option>
                <option value="formula">JS FORMULA</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Calibration Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Air Temp Sensor"
                className="w-full h-12 bg-slate-950 border border-slate-800 px-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            {selectedSensorDbId && (() => {
              const dbSens = availableSensors.find(s => s.db_id === parseInt(selectedSensorDbId));
              const conf = getSensorConfig(dbSens?.type);

              if (method === 'offset') {
                return (
                  <CalibrationTouchInput
                    label="Calibration Offset Value"
                    value={offsetVal}
                    step={conf.step}
                    min={conf.min}
                    max={conf.max}
                    onChange={setOffsetVal}
                  />
                );
              }

              return (
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">JS Formula (x = raw value)</label>
                    <span className="text-[9px] text-slate-500">e.g. `x * 1.02`</span>
                  </div>
                  <input
                    type="text"
                    value={formulaVal}
                    onChange={(e) => setFormulaVal(e.target.value)}
                    placeholder="x * 1.00"
                    className="w-full h-12 bg-slate-950 border border-slate-800 px-4 text-sm font-bold text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              );
            })()}
          </div>

          <div className="flex justify-end border-t border-emerald-500/10 pt-3">
            <button
              type="submit"
              className="px-6 py-2 border border-emerald-500/30 bg-emerald-500 text-black text-xs font-black uppercase transition-all select-none hover:bg-emerald-400 active:scale-[0.98] cursor-pointer"
            >
              Add Calibration
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
        {(calibrations || []).map((sensor, index) => {
          const config = getSensorConfig(sensor.name);
          
          return (
            <div key={index} className="border border-emerald-500/10 bg-[#040c08]/30 p-3 sm:p-4.5 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800/40 pb-2.5">
                <input
                  type="text"
                  value={sensor.name}
                  onChange={(e) => updateCalibField(index, { name: e.target.value })}
                  className="bg-transparent border-b border-transparent hover:border-slate-800 focus:border-emerald-500 focus:outline-none text-xs font-bold text-white uppercase px-1 py-0.5 min-w-[150px]"
                />
                
                <div className="flex items-center gap-3">
                  <select 
                    value={sensor.method}
                    onChange={(e) => updateCalibField(index, { method: e.target.value })}
                    className="bg-slate-950 border border-slate-800 text-[10px] text-emerald-400 font-bold px-2.5 py-1.5 focus:outline-none cursor-pointer"
                  >
                    <option value="offset">OFFSET ONLY</option>
                    <option value="formula">JS FORMULA</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveCalibration(index)}
                    className="p-1.5 border border-slate-800 hover:border-red-500/40 bg-black/40 hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors cursor-pointer select-none"
                    title="Hapus Kalibrasi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-end gap-3">
                {sensor.method === 'offset' ? (
                  <div className="flex-1">
                    <CalibrationTouchInput
                      label="Calibration Offset"
                      value={sensor.offset}
                      step={config.step}
                      min={config.min}
                      max={config.max}
                      onChange={(val) => updateCalibField(index, { offset: val })}
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">JS Formula (x = raw value)</label>
                      <span className="text-[9px] text-slate-500">e.g. `x * 1.02`</span>
                    </div>
                    <input 
                      type="text" 
                      value={sensor.formula}
                      onChange={(e) => updateCalibField(index, { formula: e.target.value })}
                      placeholder="x * 1.00"
                      className="w-full h-10 sm:h-12 bg-slate-950 border border-slate-800 px-3 text-sm font-bold text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveCalibTest(sensor.key);
                    setTestRawInput((sensor.rawValue || 0).toString());
                  }}
                  className="h-10 sm:h-12 px-3 sm:px-4 bg-emerald-950/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/15 hover:border-emerald-500 text-xs font-bold text-emerald-400 transition-colors uppercase shrink-0 select-none cursor-pointer active:scale-95 flex items-center justify-center"
                  title="Open Tester for this sensor"
                >
                  TEST
                </button>
              </div>
            </div>
          );
        })}

        {(calibrations || []).length === 0 && (
          <div className="border border-dashed border-slate-850 p-8 text-center text-slate-500 font-bold uppercase tracking-wider text-xs">
            Belum ada kalibrasi sensor yang ditambahkan.
          </div>
        )}
      </div>

      {/* LIVE JS FORMULA / OFFSET CALIBRATOR TESTER */}
      {activeSensor && (
        <div className="mt-4 sm:mt-5 p-3.5 sm:p-5 border border-dashed border-emerald-500/15 bg-emerald-950/5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 select-none">
              <Activity className="w-4 h-4 text-emerald-400" />
              Live Calibration Tester
            </span>
            <span className="text-[10px] font-mono text-slate-500 select-none">
              Tested Sensor: <strong className="text-emerald-400">{activeSensor.name}</strong>
            </span>
          </div>

          <div className="flex gap-2.5">
            <input 
              type="text"
              value={testRawInput}
              onChange={(e) => setTestRawInput(e.target.value)}
              placeholder="Raw value"
              className="flex-1 h-10 sm:h-12 bg-slate-950 border border-slate-800 px-4 text-sm font-mono text-white text-center focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => handleRunCalibrationTest(activeCalibTest)}
              className="h-10 sm:h-12 px-4 sm:px-5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shrink-0 flex items-center gap-1.5 select-none cursor-pointer active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              RUN
            </button>
          </div>

          {testResult && (
            <div className="bg-black/50 border border-emerald-500/15 p-3.5 text-xs font-bold font-mono text-emerald-400/90 text-center">
              Calibrated Value: {testResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CalibrationSettings;
