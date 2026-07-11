function TagFilter({ tagCounts, categoryFilter, setCategoryFilter }) {
  const tags = [
    { name: 'Growth', count: tagCounts.Growth, color: 'bg-emerald-400' },
    { name: 'Root Health', count: tagCounts['Root Health'], color: 'bg-fuchsia-400' },
    { name: 'Leaf Health', count: tagCounts['Leaf Health'], color: 'bg-lime-400' },
    { name: 'System', count: tagCounts.System, color: 'bg-blue-400' },
    { name: 'Monitoring', count: tagCounts.Monitoring, color: 'bg-indigo-400' },
    { name: 'Overview', count: tagCounts.Overview, color: 'bg-cyan-400' }
  ];

  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-5 flex flex-col gap-4">
      <h3 className="font-bold text-white font-display tracking-wider text-xs border-b border-emerald-500/10 pb-2.5">
        FILTER BY TAG
      </h3>

      <div className="flex flex-col gap-2">
        {tags.map((tag) => {
          const isSelectedFilter = categoryFilter === tag.name;
          return (
            <button
              key={tag.name}
              onClick={() => setCategoryFilter(isSelectedFilter ? 'ALL' : tag.name)}
              className={`flex items-center justify-between p-2.5 border text-xs font-semibold transition-all cursor-pointer text-left ${
                isSelectedFilter 
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                  : 'bg-[#040e0a]/50 border-emerald-500/10 hover:border-emerald-500/20 text-slate-300 hover:bg-[#06140e]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 ${tag.color}`}></span>
                <span>{tag.name}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold bg-[#030705] border border-emerald-500/10 px-2 py-0.5">
                {tag.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TagFilter;
