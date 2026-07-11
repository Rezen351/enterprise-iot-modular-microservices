function CorrelationHeatmap({ correlationMatrix }) {
  const dynamicParams = [];
  if (correlationMatrix && Array.isArray(correlationMatrix)) {
    correlationMatrix.forEach(item => {
      if (item.row && !dynamicParams.includes(item.row)) {
        dynamicParams.push(item.row);
      }
    });
  }
  const params = dynamicParams.length > 0 ? dynamicParams : ['TEMP OUT', 'TEMP IN', 'WATER T.', 'HUM OUT', 'HUM IN', 'EC', 'pH'];

  // Helper to calculate cell style based on value
  const getCellStyles = (val) => {
    if (val === 1.00) {
      return {
        backgroundColor: '#10b981',
        color: '#000000',
        fontWeight: '900'
      };
    }
    
    if (val > 0) {
      // Positive correlation -> Emerald
      return {
        backgroundColor: `rgba(16, 185, 129, ${val * 0.7})`,
        color: val > 0.4 ? '#ffffff' : '#94a3b8',
        fontWeight: '700'
      };
    }
    
    // Negative correlation -> Blue
    return {
      backgroundColor: `rgba(59, 130, 246, ${Math.abs(val) * 0.7})`,
      color: Math.abs(val) > 0.4 ? '#ffffff' : '#94a3b8',
      fontWeight: '700'
    };
  };

  const getVal = (row, col) => {
    if (!correlationMatrix || !Array.isArray(correlationMatrix)) {
      return row === col ? 1.00 : 0.00;
    }
    const match = correlationMatrix.find(m => m.row === row && m.col === col);
    return match ? match.val : 0.00;
  };

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-6 h-full flex flex-col justify-between">
      <h3 className="text-sm font-black font-display text-white tracking-widest uppercase border-b border-emerald-500/10 pb-4 mb-4">
        Parameter Correlation
      </h3>

      <div className="flex-1 flex flex-col justify-center">
        {/* Heatmap Grid */}
        <div className="w-full overflow-x-auto mb-6">
          <table className="w-full border-collapse table-fixed min-w-[320px]">
            <thead>
              <tr>
                <th className="p-1 text-[11px] font-black text-slate-500 tracking-wider text-left w-[20%]"></th>
                {params.map(col => (
                  <th key={col} className="p-1 text-[11px] font-black text-slate-400 tracking-wider text-center truncate" title={col}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {params.map(row => (
                <tr key={row}>
                  <td className="p-1 text-[11px] font-black text-slate-400 tracking-wider text-left uppercase truncate" title={row}>
                    {row}
                  </td>
                  {params.map(col => {
                    const val = getVal(row, col);
                    const cellStyle = getCellStyles(val);
                    return (
                      <td
                        key={col}
                        style={cellStyle}
                        className="p-1.5 md:p-2 text-center text-[11px] md:text-xs font-mono border border-slate-900/60 transition-all duration-300 hover:scale-[1.05] select-none"
                      >
                        {val === 1.0 ? '1.0' : val.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 px-2 mt-auto">
          <div className="w-full h-3 bg-gradient-to-r from-blue-500 via-[#030705] to-emerald-500 border border-slate-800" />
          <div className="flex items-center justify-between text-[11px] font-mono font-black text-slate-500">
            <span>-1.0</span>
            <span>-0.5</span>
            <span>0</span>
            <span>0.5</span>
            <span>1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CorrelationHeatmap;
