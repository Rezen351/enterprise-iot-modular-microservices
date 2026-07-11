import { useState, useEffect } from 'react';
import { Droplet } from 'lucide-react';

function IntakeSchedule({ intakeSchedule, liveTimer }) {
  const isEnabled = intakeSchedule?.isEnabled ?? true;
  const isTimerActive = liveTimer ? liveTimer.state === "ON" : isEnabled;
  
  const isDay = liveTimer ? liveTimer.isDaytime : true;
  const onMin = isDay 
    ? (intakeSchedule?.dayOn ? Math.round(intakeSchedule.dayOn / 60) : 30)
    : (intakeSchedule?.nightOn ? Math.round(intakeSchedule.nightOn / 60) : 10);
  const offMin = isDay
    ? (intakeSchedule?.dayOff ? Math.round(intakeSchedule.dayOff / 60) : 600)
    : (intakeSchedule?.nightOff ? Math.round(intakeSchedule.nightOff / 60) : 1800);

  // Countdown seconds left state
  const [secondsLeft, setSecondsLeft] = useState(340);

  // Sync with live timer from backend when it changes
  useEffect(() => {
    if (liveTimer) {
      setSecondsLeft(liveTimer.sisa_waktu_detik);
    }
  }, [liveTimer?.sisa_waktu_detik]);

  // Local ticker countdown interval
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (!liveTimer) {
            return 340; // Fallback simulation wrap around
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [liveTimer]);

  // Derive progress percentage dynamically
  let progress = 0;
  if (isEnabled) {
    if (liveTimer) {
      const total = liveTimer.state === "ON"
        ? (isDay ? (intakeSchedule?.dayOn || 1800) : (intakeSchedule?.nightOn || 600))
        : (isDay ? (intakeSchedule?.dayOff || 36000) : (intakeSchedule?.nightOff || 108000));
      progress = total > 0 ? Math.max(0, Math.min(100, ((total - secondsLeft) / total) * 100)) : 0;
    } else {
      progress = Math.max(0, Math.min(100, ((340 - secondsLeft) / 340) * 100));
    }
  }

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}.${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3.5 sm:p-4 flex flex-col justify-between h-[150px] relative overflow-hidden group">


      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Droplet className={`w-4 h-4 ${isTimerActive ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Intake</span>
        </div>
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
          isTimerActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-950/40 text-slate-500'
        }`}>
          {isTimerActive ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Progress slider bar */}
      <div className="w-full h-2 bg-slate-950 border border-slate-900 overflow-hidden my-2 z-10">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000" 
          style={{ width: `${isEnabled ? progress : 0}%` }}
        />
      </div>

      {/* Cycle timing text */}
      <div className="text-center z-10 flex flex-col">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
          {onMin}M ON / {offMin}M OFF {isDay ? "(DAY)" : "(NIGHT)"}
        </span>
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">
          Next Cycle {isEnabled ? formatTime(secondsLeft) : '00.00'}
        </span>
      </div>
    </div>
  );
}

export default IntakeSchedule;
