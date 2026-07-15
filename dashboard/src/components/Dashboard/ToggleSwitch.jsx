function ToggleSwitch({ checked, onChange, disabled = false, size = 'sm' }) {
  const isLarge = size === 'lg';

  const containerClass = isLarge 
    ? 'w-16 h-8' 
    : 'w-14 h-7';

  const circleClass = isLarge 
    ? 'after:h-7 after:w-7 peer-checked:after:translate-x-8' 
    : 'after:h-6 after:w-6 peer-checked:after:translate-x-7';

  return (
    <label 
      className={`relative inline-flex items-center select-none cursor-pointer shrink-0 transition-transform duration-100 ${
        disabled ? 'opacity-40 cursor-default' : 'active:scale-95'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          if (!disabled && onChange) {
            onChange(e.target.checked);
          }
        }}
        className="sr-only peer"
      />
      <div 
        className={`${containerClass} ${circleClass} bg-red-500/20 border border-red-500/30 transition-all duration-200 
                   peer-checked:bg-emerald-500 peer-checked:border-emerald-400/30 
                  
                   after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                   after:bg-red-400 peer-checked:after:bg-black 
                   after:transition-all`}
      />
    </label>
  );
}

export default ToggleSwitch;
