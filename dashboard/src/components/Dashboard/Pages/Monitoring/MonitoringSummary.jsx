function MonitoringSummary() {
  const stats = [
    { label: 'Sensors', value: 'Active', color: 'text-emerald-400' },
    { label: 'Plants', value: 'Healthy', color: 'text-emerald-400' },
    { label: 'System', value: 'Optimal', color: 'text-emerald-400' }
  ];

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="p-6 border border-emerald-500/10 bg-emerald-950/10 compact-mobile-padding">
          <div className="text-slate-400 text-xs uppercase font-semibold">{stat.label}</div>
          <div className={`${stat.color} text-2xl font-bold mt-2`}>{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

export default MonitoringSummary;
