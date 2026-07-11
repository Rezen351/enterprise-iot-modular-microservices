import { Plus, Minus } from 'lucide-react';

function NumericAdjuster({ 
  value, 
  onChange, 
  step = 1, 
  min = 0, 
  max = 1000, 
  unit = '', 
  label = '', 
  disabled = false,
  precision = 1
}) {
  const handleIncrement = () => {
    const newValue = parseFloat((value + step).toFixed(precision));
    if (newValue <= max) onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = parseFloat((value - step).toFixed(precision));
    if (newValue >= min) onChange(newValue);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>}
      <div className={`flex items-center h-12 bg-[#040e0a] border border-emerald-500/20 overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <button
          type="button"
          onClick={handleDecrement}
          className="w-12 h-full flex items-center justify-center bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 border-r border-emerald-500/10 transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        
        <div className="flex-1 flex items-center justify-center gap-1 min-w-[60px]">
          <span className="text-sm font-bold text-white tabular-nums">{value}</span>
          {unit && <span className="text-[10px] font-bold text-slate-500 uppercase">{unit}</span>}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          className="w-12 h-full flex items-center justify-center bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 border-l border-emerald-500/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default NumericAdjuster;
