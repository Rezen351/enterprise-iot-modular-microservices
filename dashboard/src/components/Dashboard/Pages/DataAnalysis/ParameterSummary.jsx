import { Thermometer, Droplets, FlaskConical, Wind, Waves } from 'lucide-react';

const getCardMeta = (key, idx) => {
    const PREDEFINED = {
        temp_out:   { title: 'TEMP OUTDOOR',  icon: Thermometer,  color: 'text-orange-400', border: 'border-orange-500/15', unit: ' °C', decimals: 1 },
        temp_in:    { title: 'TEMP INDOOR',   icon: Thermometer,  color: 'text-emerald-400', border: 'border-emerald-500/15', unit: ' °C', decimals: 1 },
        water_temp: { title: 'WATER TEMP',    icon: Waves,        color: 'text-cyan-400', border: 'border-cyan-500/15', unit: ' °C', decimals: 1 },
        hum_out:    { title: 'HUMID OUTDOOR', icon: Wind,         color: 'text-amber-400', border: 'border-amber-500/15', unit: ' %', decimals: 0 },
        hum_in:     { title: 'HUMID INDOOR',  icon: Droplets,     color: 'text-yellow-400', border: 'border-yellow-500/15', unit: ' %', decimals: 0 },
        ec:         { title: 'EC LEVEL',      icon: Droplets,     color: 'text-blue-400', border: 'border-blue-500/15', unit: ' mS/cm', decimals: 2 },
        ph:         { title: 'pH LEVEL',      icon: FlaskConical, color: 'text-purple-400', border: 'border-purple-500/15', unit: '', decimals: 2 }
    };
    
    if (PREDEFINED[key]) return PREDEFINED[key];
    
    const colors = [
        { color: 'text-orange-400', border: 'border-orange-500/15' },
        { color: 'text-emerald-400', border: 'border-emerald-500/15' },
        { color: 'text-cyan-400', border: 'border-cyan-500/15' },
        { color: 'text-amber-400', border: 'border-amber-500/15' },
        { color: 'text-yellow-400', border: 'border-yellow-500/15' },
        { color: 'text-blue-400', border: 'border-blue-500/15' },
        { color: 'text-purple-400', border: 'border-purple-500/15' },
        { color: 'text-pink-400', border: 'border-pink-500/15' }
    ];
    const theme = colors[idx % colors.length];
    
    let icon = Droplets;
    let unit = '';
    let decimals = 2;
    
    if (key.includes('temp')) {
        icon = Thermometer;
        unit = ' °C';
        decimals = 1;
    } else if (key.includes('hum')) {
        icon = Wind;
        unit = ' %';
        decimals = 0;
    } else if (key.includes('ph')) {
        icon = FlaskConical;
    }
    
    return {
        title: key.replace(/_/g, ' ').toUpperCase(),
        icon,
        color: theme.color,
        border: theme.border,
        unit,
        decimals
    };
};

function ParameterSummary({ summary }) {
    return (
        <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6 h-full flex flex-col">
            <h3 className="text-sm font-black font-display text-white tracking-widest uppercase border-b border-emerald-500/10 pb-4 mb-4">
                Parameters
            </h3>

            <div className="grid grid-cols-1 gap-2.5 flex-1 overflow-y-auto max-h-[420px] pr-1">
                {Object.keys(summary || {}).map((key, idx) => {
                    const s = summary[key];
                    if (!s || (s.avg === 0 && s.min === 0 && s.max === 0)) return null;

                    const meta = getCardMeta(key, idx);
                    const Icon = meta.icon;
                    const avgStr = `${s.avg.toFixed(meta.decimals)}${meta.unit}`;
                    const minStr = `${s.min.toFixed(meta.decimals)}${meta.unit}`;
                    const maxStr = `${s.max.toFixed(meta.decimals)}${meta.unit}`;

                    return (
                        <div
                            key={key}
                            className={`border ${meta.border} bg-slate-950/20 px-4 py-3 flex items-center gap-4`}
                        >
                            {/* Icon */}
                            <div className={`p-2 bg-slate-900/60 border ${meta.border} ${meta.color} shrink-0`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            {/* Label + Avg */}
                            <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                                    {meta.title}
                                </span>
                                <span className={`text-lg font-black font-display tracking-tight ${meta.color}`}>
                                    {avgStr}
                                </span>
                            </div>
                            {/* Min / Max */}
                            <div className="text-right text-[11px] font-black font-mono text-slate-500 shrink-0">
                                <div>↑ <span className="text-red-400">{maxStr}</span></div>
                                <div>↓ <span className="text-blue-400">{minStr}</span></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ParameterSummary;
