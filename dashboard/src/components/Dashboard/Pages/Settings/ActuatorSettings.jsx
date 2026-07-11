import { useState } from 'react';
import { Power, Info, Trash2, Plus, X } from 'lucide-react';
import ToggleSwitch from '../../ToggleSwitch';

function ActuatorSettings({ actuators, setActuators, toggleActuator, autoMode, availableActuators }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDbId, setSelectedDbId] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [controlType, setControlType] = useState('none');

  // Filter out actuators already added to the control panel
  const unconfiguredActuators = availableActuators.filter(
    dbAct => !actuators.some(a => a.actuator_db_id === dbAct.db_id)
  );

  const handleSelectActuator = (dbIdStr) => {
    setSelectedDbId(dbIdStr);
    const dbId = parseInt(dbIdStr);
    const dbAct = availableActuators.find(a => a.db_id === dbId);
    if (dbAct) {
      setCustomKey(dbAct.name.toLowerCase().replace(/\s+/g, '_'));
      setCustomLabel(dbAct.name.replace(/_/g, ' ').toUpperCase());
    } else {
      setCustomKey('');
      setCustomLabel('');
    }
  };

  const handleAddControl = (e) => {
    e.preventDefault();
    if (!selectedDbId || !customKey.trim() || !customLabel.trim()) {
      alert('Semua kolom harus diisi!');
      return;
    }

    const dbId = parseInt(selectedDbId);
    const dbAct = availableActuators.find(a => a.db_id === dbId);
    if (!dbAct) return;

    // Check if key already exists to prevent duplication
    if (actuators.some(a => a.key === customKey.trim())) {
      alert('Key/Address ini sudah digunakan untuk aktuator lain!');
      return;
    }

    const newActuator = {
      actuator_db_id: dbId,
      key: customKey.trim(),
      label: customLabel.trim(),
      actuator_type: dbAct.type,
      pin: dbAct.pin,
      is_active: false,
      schedule: {
        type: controlType,
        temperature_setpoint: 26.0,
        day_start: '06:00',
        night_start: '18:00',
        day_on_seconds: 15,
        day_off_seconds: 45,
        night_on_seconds: 5,
        night_off_seconds: 120,
        start_time: '07:00',
        end_time: '07:30'
      }
    };

    setActuators(prev => [...prev, newActuator]);

    // Reset Form
    setSelectedDbId('');
    setCustomKey('');
    setCustomLabel('');
    setControlType('none');
    setShowAddForm(false);
  };

  const handleRemoveControl = (keyToRemove) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus tombol kontrol untuk "${keyToRemove}"?`)) {
      setActuators(prev => prev.filter(a => a.key !== keyToRemove));
    }
  };

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6">
      <div className="border-b border-emerald-500/10 pb-4 mb-5 flex items-center justify-between">
        <h3 className="text-sm font-black font-display text-white tracking-widest uppercase flex items-center gap-3">
          <Power className="w-5 h-5 text-emerald-400" />
          Actuator Control Center
        </h3>
        
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold uppercase transition-all select-none cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            Add Control
          </button>
        )}
      </div>

      {/* Inline Form to Add Actuator Control */}
      {showAddForm && (
        <form onSubmit={handleAddControl} className="mb-6 p-4 border border-emerald-500/20 bg-emerald-950/5 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
            <h4 className="text-xs font-black text-white uppercase tracking-widest">Configure New Button</h4>
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
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Select Actuator</label>
              <select
                value={selectedDbId}
                onChange={(e) => handleSelectActuator(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-bold px-4 h-12 focus:border-emerald-500 focus:outline-none cursor-pointer"
                required
              >
                <option value="">-- Pilih Aktuator Modul --</option>
                {unconfiguredActuators.map(act => (
                  <option key={act.db_id} value={act.db_id}>
                    {act.name} ({act.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Control Type</label>
              <select
                value={controlType}
                onChange={(e) => setControlType(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-bold px-4 h-12 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="none">Manual Control (ON/OFF)</option>
                <option value="interval">Cyclic Control (ON/OFF Duration)</option>
                <option value="timerange">Scheduled Control (Time Range)</option>
                <option value="thermostat">Feedback Control (Sensor/Threshold)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Key / Address (Unik)</label>
              <input
                type="text"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="e.g. misting_pump"
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-bold px-4 h-12 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-display">Display Label</label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Pompa Misting Utama"
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-bold px-4 h-12 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-bold uppercase transition-all select-none cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase transition-all select-none cursor-pointer"
            >
              Add Control
            </button>
          </div>
        </form>
      )}

      {/* Actuators Control Cards List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {actuators.map((act) => (
          <div 
            key={act.key} 
            onClick={() => {
              if (!autoMode) {
                toggleActuator(act.key);
              }
            }}
            className={`border p-3 sm:p-6 flex items-center justify-between gap-3 sm:gap-5 transition-all duration-300 select-none ${
              !autoMode 
                ? 'cursor-pointer hover:bg-[#05100a]/50 active:scale-[0.98]' 
                : 'cursor-default opacity-90'
            } ${
              act.is_active 
                ? 'border-emerald-500/50 bg-emerald-950/20-500/5' 
                : 'border-slate-800 bg-slate-950/30'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className={`w-3.5 h-3.5 shrink-0 ${act.is_active ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                <h4 className="text-base font-black text-white truncate uppercase tracking-tight">{act.label || act.key}</h4>
              </div>
              <div className="flex items-center flex-wrap gap-2.5 mt-2.5 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                <span className="bg-black/20 px-2 py-0.5 border border-white/5">{act.pin || 'GPIO ?'}</span>
                <span className="text-slate-700">•</span>
                <span className="bg-emerald-950/10 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 text-[9px]">
                  {act.schedule?.type === 'interval' && 'Cyclic Control'}
                  {act.schedule?.type === 'timerange' && 'Scheduled Control'}
                  {act.schedule?.type === 'thermostat' && 'Feedback Control'}
                  {(!act.schedule || act.schedule?.type === 'none') && 'Manual Control'}
                </span>
                <span className="text-slate-700">•</span>
                <span className={act.is_active ? 'text-emerald-400' : 'text-slate-600'}>
                  {act.is_active ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3.5" onClick={e => e.stopPropagation()}>
              <ToggleSwitch 
                checked={act.is_active} 
                disabled={autoMode} 
                onChange={() => {
                  if (!autoMode) {
                    toggleActuator(act.key);
                  }
                }}
                size="lg" 
              />
              <button
                type="button"
                onClick={() => handleRemoveControl(act.key)}
                className="p-2 border border-slate-800 hover:border-red-500/40 bg-black/40 hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors cursor-pointer select-none"
                title="Hapus Kontrol"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        
        {actuators.length === 0 && (
          <div className="col-span-full border border-dashed border-slate-850 p-8 text-center text-slate-500 font-bold uppercase tracking-wider text-xs">
            Belum ada tombol kontrol aktuator yang ditambahkan.
          </div>
        )}
      </div>
      
      {autoMode && (
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-emerald-950/15 border border-emerald-500/20 flex items-start gap-3.5">
          <Info className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-slate-300 leading-relaxed font-bold uppercase tracking-tight">
            <strong className="text-emerald-400">Automated Logic Engaged</strong>: Individual device overrides are locked to system schedules. Toggle manual mode to unlock.
          </p>
        </div>
      )}
    </div>
  );
}

export default ActuatorSettings;
