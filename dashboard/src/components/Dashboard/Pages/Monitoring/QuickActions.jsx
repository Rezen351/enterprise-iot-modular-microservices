import { Sliders } from 'lucide-react';
import ToggleSwitch from '../../ToggleSwitch';

function QuickActions({ 
  isMistPumpOn, setMistPump,
  isInletPumpOn, setInletPump,
  isValveOn, setValve,
  isCoolingOn, setCooling,
  autoMode, setAutoMode,
  systemPower = true, // Default to true if not provided
  setActiveTab
}) {
  const actions = [
    { id: 'mist_pump', name: 'Mist Pump', active: isMistPumpOn, onChange: setMistPump, disabled: autoMode, title: autoMode ? 'Disable Auto Mode to control manually' : 'Control mist pump' },
    { id: 'inlet_pump', name: 'Inlet Pump', active: isInletPumpOn, onChange: setInletPump, disabled: autoMode, title: autoMode ? 'Disable Auto Mode to control manually' : 'Control inlet pump' },
    { id: 'valve', name: 'Valve', active: isValveOn, onChange: setValve, disabled: autoMode, title: autoMode ? 'Disable Auto Mode to control manually' : 'Control solenoid valve' },
    { id: 'cooling_system', name: 'Cooling System', active: isCoolingOn, onChange: setCooling, disabled: autoMode, title: autoMode ? 'Disable Auto Mode to control manually' : 'Control cooling system' }
  ];

  return (
    <div className="border border-emerald-500/15 bg-[#040c08]/40 backdrop-blur-md p-3.5 sm:p-6 flex flex-col h-auto md:h-[450px] justify-between relative overflow-hidden group">


      {/* Header */}
      <div className="flex items-center justify-between z-10 w-full">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-black text-white uppercase tracking-widest">Actions</span>
        </div>
        <button 
          onClick={() => setActiveTab && setActiveTab('setting')}
          className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer border border-transparent focus:outline-none"
        >
          <span>Settings</span>
          <span>&rarr;</span>
        </button>
      </div>

      {/* Switches Grid */}
      <div className="flex-1 grid grid-cols-2 gap-3 my-2.5 sm:my-4 z-10">
        {/* Master Control: Auto Mode */}
        <div 
          onClick={() => setAutoMode(!autoMode)} 
          className="col-span-2 flex items-center justify-between p-3 sm:p-4 border border-emerald-500/20 bg-emerald-950/10 group/item hover:border-emerald-500/40 transition-all duration-150 cursor-pointer select-none active:scale-[0.98]"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white uppercase tracking-wider">Auto Mode</span>
              <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                {autoMode ? 'System Managed' : 'Manual Override'}
              </span>
            </div>
          </div>
          <div className="pointer-events-none">
            <ToggleSwitch checked={autoMode} size="lg" />
          </div>
        </div>

        {/* Regular Actuator Controls */}
        {actions.map((act) => (
          <div 
            key={act.id} 
            onClick={() => !act.disabled && act.onChange(!act.active)}
            className={`flex items-center justify-between p-2.5 sm:p-3.5 border group/item transition-all duration-150 select-none ${
              act.disabled 
                ? 'opacity-60 border-slate-900 bg-slate-950/20 cursor-not-allowed' 
                : act.active 
                  ? 'border-emerald-500/20 bg-emerald-950/5 hover:border-emerald-500/40 cursor-pointer active:scale-[0.96]' 
                  : 'border-slate-800/80 bg-[#020604]/40 hover:border-slate-700/60 cursor-pointer active:scale-[0.96]'
            }`}
            title={act.title}
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white uppercase tracking-wider">{act.name}</span>
              <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${act.active ? 'text-emerald-400' : 'text-slate-600'}`}>
                {act.active ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="pointer-events-none">
              <ToggleSwitch checked={act.active} disabled={act.disabled} />
            </div>
          </div>
        ))}
      </div>


    </div>
  );
}

export default QuickActions;
