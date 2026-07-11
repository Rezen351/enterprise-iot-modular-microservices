import { useState, useEffect } from 'react';
import { Clock, Sun, Moon, Info } from 'lucide-react';
import ToggleSwitch from '../../ToggleSwitch';

function TouchNumberInput({ value, onChange, label, unit, min = 0, max = 9999, step = 0.1, disabled = false }) {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    if (parseFloat(inputValue) !== value) {
      setInputValue(value.toString());
    }
  }, [value]);

  const handleDecrement = () => {
    if (disabled) return;
    const newVal = Math.max(min, value - step);
    const rounded = parseFloat(newVal.toFixed(2));
    onChange(rounded);
    setInputValue(rounded.toString());
  };

  const handleIncrement = () => {
    if (disabled) return;
    const newVal = Math.min(max, value + step);
    const rounded = parseFloat(newVal.toFixed(2));
    onChange(rounded);
    setInputValue(rounded.toString());
  };

  const handleChange = (e) => {
    const rawVal = e.target.value;
    setInputValue(rawVal);

    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    } else if (rawVal === '') {
      onChange(0);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {label && <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>}
      <div className="flex items-center bg-slate-950 border border-slate-800 overflow-hidden h-12 sm:h-14">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={handleDecrement}
          className="w-12 sm:w-14 h-full flex items-center justify-center text-xl font-black text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border-r border-slate-800 select-none disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
        >
          -
        </button>
        <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
          <input
            type="number"
            step={step}
            value={inputValue}
            disabled={disabled}
            onChange={handleChange}
            className="w-full min-w-0 bg-transparent text-center font-mono text-base font-black text-white focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && <span className="text-[12px] text-emerald-400 font-black pr-2 shrink-0 select-none uppercase">{unit}</span>}
        </div>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={handleIncrement}
          className="w-12 sm:w-14 h-full flex items-center justify-center text-xl font-black text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border-l border-slate-800 select-none disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ScheduleSettings({
  actuators,
  setActuators
}) {
  const cyclicActuators = actuators.filter(a => a.schedule?.type === 'interval');
  const scheduledActuators = actuators.filter(a => a.schedule?.type === 'timerange');
  const feedbackActuators = actuators.filter(a => a.schedule?.type === 'thermostat');

  const updateSchedule = (key, field, value) => {
    setActuators(prev => prev.map(act => {
      if (act.key === key) {
        return {
          ...act,
          schedule: {
            ...act.schedule,
            [field]: value
          }
        };
      }
      return act;
    }));
  };

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6">
      <h3 className="text-sm font-black font-display text-white tracking-widest uppercase border-b border-emerald-500/10 pb-4 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-emerald-400" />
          Hardware Automation Cycles
        </span>
        <span className="text-[11px] font-black text-emerald-400/90 bg-emerald-500/5 px-3 py-1.5 border border-emerald-500/20 select-none tracking-tight">
          SCHEDULER ENGINE ACTIVE
        </span>
      </h3>

      <div className="flex flex-col gap-8">
        {/* Render Cyclic Controls */}
        {cyclicActuators.map((act) => {
          const sched = act.schedule;
          return (
            <div key={act.key} className="border border-emerald-500/10 bg-emerald-950/5 p-3 sm:p-6 flex flex-col gap-4 sm:gap-5">
              <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-5 bg-emerald-400"></div>
                  <h4 className="text-sm font-black text-white uppercase tracking-widest">{act.label || act.key} Cyclic Control</h4>
                </div>
                <ToggleSwitch 
                  checked={sched.isEnabled !== false} 
                  onChange={(val) => updateSchedule(act.key, 'isEnabled', val)} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Daytime settings */}
                <div className="p-3 sm:p-5 bg-[#040c08]/60 border border-emerald-500/5 flex flex-col gap-4 sm:gap-5">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-black border-b border-emerald-500/10 pb-3 uppercase tracking-widest">
                    <Sun className="w-5 h-5" />
                    Daytime
                  </div>
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Cycle Start Time:</span>
                      <input 
                        type="time" 
                        value={sched.day_start || '06:00'} 
                        disabled={sched.isEnabled === false}
                        onChange={(e) => updateSchedule(act.key, 'day_start', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 px-4 h-12 sm:h-14 text-base font-black text-white font-mono text-center disabled:opacity-40"
                      />
                    </div>
                    <TouchNumberInput
                      label="Runtime (ON)"
                      value={parseFloat(((sched.day_on_seconds || 0) / 60).toFixed(2))}
                      onChange={(val) => updateSchedule(act.key, 'day_on_seconds', Math.round(val * 60))}
                      unit="MIN"
                      disabled={sched.isEnabled === false}
                    />
                    <TouchNumberInput
                      label="Dwell (OFF)"
                      value={parseFloat(((sched.day_off_seconds || 0) / 60).toFixed(2))}
                      onChange={(val) => updateSchedule(act.key, 'day_off_seconds', Math.round(val * 60))}
                      unit="MIN"
                      disabled={sched.isEnabled === false}
                    />
                  </div>
                </div>

                {/* Nighttime settings */}
                <div className="p-3 sm:p-5 bg-[#040c08]/60 border border-emerald-500/5 flex flex-col gap-4 sm:gap-5">
                  <div className="flex items-center gap-2 text-indigo-400 text-sm font-black border-b border-emerald-500/10 pb-3 uppercase tracking-widest">
                    <Moon className="w-5 h-5" />
                    Nighttime
                  </div>
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Cycle Start Time:</span>
                      <input 
                        type="time" 
                        value={sched.night_start || '18:00'} 
                        disabled={sched.isEnabled === false}
                        onChange={(e) => updateSchedule(act.key, 'night_start', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 px-4 h-12 sm:h-14 text-base font-black text-white font-mono text-center disabled:opacity-40"
                      />
                    </div>
                    <TouchNumberInput
                      label="Runtime (ON)"
                      value={parseFloat(((sched.night_on_seconds || 0) / 60).toFixed(2))}
                      onChange={(val) => updateSchedule(act.key, 'night_on_seconds', Math.round(val * 60))}
                      unit="MIN"
                      disabled={sched.isEnabled === false}
                    />
                    <TouchNumberInput
                      label="Dwell (OFF)"
                      value={parseFloat(((sched.night_off_seconds || 0) / 60).toFixed(2))}
                      onChange={(val) => updateSchedule(act.key, 'night_off_seconds', Math.round(val * 60))}
                      unit="MIN"
                      disabled={sched.isEnabled === false}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {cyclicActuators.length === 0 && (
          <div className="border border-dashed border-slate-850 p-6 text-center text-slate-500 font-bold uppercase tracking-wider text-xs">
            Belum ada aktuator dengan kontrol siklus.
          </div>
        )}

        {/* Render Scheduled and Feedback Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {scheduledActuators.map((act) => {
            const sched = act.schedule;
            return (
              <div key={act.key} className="border border-emerald-500/10 bg-[#040c08]/50 p-3 sm:p-6 flex flex-col justify-between gap-4 sm:gap-5">
                <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4">
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">{act.label || act.key} Scheduled Control</span>
                  <ToggleSwitch 
                    checked={sched.isEnabled !== false} 
                    onChange={(val) => updateSchedule(act.key, 'isEnabled', val)} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-5">
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">START</span>
                    <input 
                      type="time" 
                      value={sched.start_time || '07:00'} 
                      onChange={(e) => updateSchedule(act.key, 'start_time', e.target.value)}
                      disabled={sched.isEnabled === false}
                      className="bg-slate-950 border border-slate-800 disabled:opacity-40 px-3 h-12 sm:h-14 text-sm font-black text-white font-mono text-center"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">END</span>
                    <input 
                      type="time" 
                      value={sched.end_time || '07:30'} 
                      onChange={(e) => updateSchedule(act.key, 'end_time', e.target.value)}
                      disabled={sched.isEnabled === false}
                      className="bg-slate-950 border border-slate-800 disabled:opacity-40 px-3 h-12 sm:h-14 text-sm font-black text-white font-mono text-center"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {feedbackActuators.map((act) => {
            const sched = act.schedule;
            return (
              <div key={act.key} className="border border-emerald-500/10 bg-[#040c08]/50 p-3 sm:p-6 flex flex-col justify-between gap-4 sm:gap-5">
                <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4">
                  <span className="text-xs font-black text-slate-200 uppercase tracking-widest">{act.label || act.key} Feedback Control</span>
                  <ToggleSwitch 
                    checked={sched.isEnabled !== false} 
                    onChange={(val) => updateSchedule(act.key, 'isEnabled', val)} 
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <TouchNumberInput
                    label="Temperature Set Point"
                    value={sched.temperature_setpoint ?? 26.0}
                    onChange={(val) => updateSchedule(act.key, 'temperature_setpoint', val)}
                    unit="°C"
                    min={15}
                    max={40}
                    step={0.5}
                    disabled={sched.isEnabled === false}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* SYSTEM CHECK INTERVAL HIDDEN FROM UI */}

      </div>
    </div>
  );
}

export default ScheduleSettings;
