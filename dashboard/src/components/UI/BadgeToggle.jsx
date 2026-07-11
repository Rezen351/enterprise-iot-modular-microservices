function BadgeToggle({ 
  options, 
  value, 
  onChange, 
  label = '', 
  multiSelect = false 
}) {
  const handleToggle = (optionValue) => {
    if (multiSelect) {
      const newValue = value.includes(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue];
      onChange(newValue);
    } else {
      onChange(optionValue);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = multiSelect 
            ? value.includes(option.value) 
            : value === option.value;
            
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToggle(option.value)}
              className={`h-11 px-4 text-xs font-bold transition-all border cursor-pointer ${
                isActive 
                  ? 'bg-emerald-500 text-black border-emerald-500' 
                  : 'bg-emerald-500/5 text-slate-400 border-emerald-500/10 hover:bg-emerald-500/10 hover:border-emerald-500/20'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default BadgeToggle;
