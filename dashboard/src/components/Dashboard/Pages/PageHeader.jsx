function PageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="border border-emerald-500/15 bg-[#030705]/80 backdrop-blur-md p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
        {Icon && (
          <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
            <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-wide uppercase truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="hidden sm:block text-slate-400 text-xs sm:text-sm mt-0.5 font-medium truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
