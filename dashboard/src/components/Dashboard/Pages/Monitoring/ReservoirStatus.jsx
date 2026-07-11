import { useState, useEffect } from 'react';
import { Droplets } from 'lucide-react';

function ReservoirStatus({ activeModuleData }) {
  // Sensor is boolean: true/1 = FULL, false/0 = EMPTY
  const rawValue = activeModuleData?.sensors?.reservoir_status?.value;
  const isFull = rawValue === true || rawValue === 1;
  
  // Visual height mapping for boolean
  const waterLvlHeight = isFull ? 90 : 10;

  // Let's add styling for the wave animation in React style tag so it runs smoothly
  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3.5 sm:p-4 flex flex-col justify-between h-[150px] relative overflow-hidden group">


      <style dangerouslySetInnerHTML={{__html: `
        @keyframes waveMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-wave-slow {
          animation: waveMove 4s linear infinite;
        }
        .animate-wave-fast {
          animation: waveMove 2.5s linear infinite;
        }
      `}} />

      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest font-display">Reservoir</span>
        </div>
        <span className={`text-[8px] font-black px-2 py-0.5 border transition-colors duration-500 ${
          isFull 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
          {isFull ? 'STABLE' : 'CRITICAL'}
        </span>
      </div>

      {/* Animated Water Tank Container */}
      <div className="flex-1 w-full bg-slate-950/60 border border-slate-900 relative overflow-hidden my-2 h-[60px] z-10 flex items-center justify-center">
        {/* Water Level Waves */}
        <div 
          className={`absolute bottom-0 left-0 w-[200%] h-full flex flex-col justify-end transition-all duration-1000`}
          style={{ height: `${waterLvlHeight}%` }}
        >
          <div className="relative w-full h-[15px] overflow-hidden">
            {/* Wave 1 (Back Layer) */}
            <svg 
              className={`absolute bottom-0 left-0 w-full h-[15px] animate-wave-slow ${isFull ? 'text-blue-500/30' : 'text-red-500/30'}`} 
              viewBox="0 0 100 15" 
              preserveAspectRatio="none"
              style={{ width: '200%' }}
            >
              <path d="M0,7 C25,12 25,2 50,7 C75,12 75,2 100,7 C125,12 125,2 150,7 C175,12 175,2 200,7 L200,15 L0,15 Z" fill="currentColor" />
            </svg>

            {/* Wave 2 (Front Layer) */}
            <svg 
              className={`absolute bottom-0 left-0 w-full h-[15px] animate-wave-fast ${isFull ? 'text-blue-400/50' : 'text-red-400/50'}`} 
              viewBox="0 0 100 15" 
              preserveAspectRatio="none"
              style={{ width: '200%', animationDirection: 'reverse' }}
            >
              <path d="M0,5 C20,1 30,9 50,5 C70,1 80,9 100,5 C120,1 130,9 150,5 C170,1 180,9 200,5 L200,15 L0,15 Z" fill="currentColor" />
            </svg>
          </div>
          {/* Deep Water base fill */}
          <div className={`bg-gradient-to-t flex-1 w-full ${isFull ? 'from-blue-600/60 to-blue-400/40' : 'from-red-600/60 to-red-400/40'}`} />
        </div>

        {/* Level Indicator Text overlay */}
        <div className="z-20 text-center flex flex-col items-center">
          <span className={`text-base font-black  uppercase tracking-widest ${isFull ? 'text-white' : 'text-red-400 animate-pulse'}`}>
            {isFull ? 'FULL' : 'EMPTY'}
          </span>
          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest ">Float Switch</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center z-10">
        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
          Level Sensor
        </span>
      </div>
    </div>
  );
}

export default ReservoirStatus;
