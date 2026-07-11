import { useState, useEffect } from 'react';

const ValveIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 12h16" />
    <path d="M12 12V4" />
    <path d="M8 4h8" />
    <circle cx="4" cy="12" r="2" fill="currentColor" />
    <circle cx="20" cy="12" r="2" fill="currentColor" />
  </svg>
);

function ValveSchedule({ otherSchedules, liveTimer }) {
  const isEnabled = otherSchedules?.solenoid_valve?.isEnabled ?? false;
  const startTime = otherSchedules?.solenoid_valve?.startTime || '07:00';
  const endTime = otherSchedules?.solenoid_valve?.endTime || '07:30';

  // Helper to determine if current time is within schedule range
  const checkIfTimeInRange = (start, end) => {
    try {
      const now = new Date();
      // Local time in GMT+7
      const localTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60 * 1000);
      const currentMin = localTime.getUTCHours() * 60 + localTime.getUTCMinutes();
      
      const [startH, startM] = start.split(":").map(Number);
      const [endH, endM] = end.split(":").map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      
      if (startMin < endMin) {
        return currentMin >= startMin && currentMin < endMin;
      } else {
        return currentMin >= startMin || currentMin < endMin;
      }
    } catch (e) {
      return false;
    }
  };

  const isValveActive = liveTimer ? liveTimer.state === "ON" : (isEnabled ? checkIfTimeInRange(startTime, endTime) : false);

  // Countdown seconds left state
  const [secondsLeft, setSecondsLeft] = useState(480);

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
            return 480; // Fallback simulation wrap around
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
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);
      
      const startSec = (startH * 60 + startM) * 60;
      const endSec = (endH * 60 + endM) * 60;
      
      let total = 0;
      if (liveTimer.state === "ON") {
        if (startSec < endSec) {
          total = endSec - startSec;
        } else {
          total = (24 * 60 * 60 - startSec) + endSec;
        }
      } else {
        // Off duration is the rest of the day
        if (startSec < endSec) {
          total = 24 * 60 * 60 - (endSec - startSec);
        } else {
          total = 24 * 60 * 60 - ((24 * 60 * 60 - startSec) + endSec);
        }
      }
      
      if (total <= 0) total = 1800; // default fallback 30 minutes
      progress = Math.max(0, Math.min(100, ((total - secondsLeft) / total) * 100));
    } else {
      progress = Math.max(0, Math.min(100, ((480 - secondsLeft) / 480) * 100));
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
          <ValveIcon className={`w-4 h-4 transition-colors duration-300 ${isValveActive ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Valve</span>
        </div>
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
          isValveActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-950/40 text-slate-500'
        }`}>
          {isValveActive ? 'ON' : 'OFF'}
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
          {startTime} - {endTime}
        </span>
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">
          {liveTimer 
            ? (isValveActive ? `Active Left: ${formatTime(secondsLeft)}` : `Next In: ${formatTime(secondsLeft)}`)
            : `Next Cycle ${isEnabled ? formatTime(secondsLeft) : '00.00'}`
          }
        </span>
      </div>
    </div>
  );
}

export default ValveSchedule;
