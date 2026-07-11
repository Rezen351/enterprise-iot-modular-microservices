import {
  ChevronLeft,
  ChevronRight,
  X,
  User,
  ShieldCheck,
  Server
} from 'lucide-react';

function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed, mobileOpen, setMobileOpen, hidden = false, isAdmin = false }) {
  const menuItems = [
    { id: 'profile', label: 'PROFILE', icon: User },
    { id: 'module', label: 'MODULE', icon: Server },
  ];

  if (isAdmin) {
    menuItems.push({ id: 'users', label: 'Account', icon: ShieldCheck });
  }

  return (
    <>
      {/* Backdrop for mobile view */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col border-r border-emerald-500/15 bg-[#030705] transition-all duration-300 ${hidden ? 'lg:w-0 lg:border-r-0 overflow-hidden' : (collapsed ? 'lg:w-20' : 'lg:w-72')
          } ${mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        {/* Top Branding Section */}
        <div className="p-6 border-b border-emerald-500/10 flex items-center justify-between h-24">
          {/* Collapsed State Logo (Desktop Only) */}
          <div className={`mx-auto animate-fadeIn ${collapsed ? 'lg:flex hidden' : 'hidden'
            }`}>
            <img src="/favicon.svg" className="w-8 h-8 select-none" alt="Smart Farm Icon" />
          </div>

          {/* Full Branding (Mobile always, Desktop only if not collapsed) */}
          <div className={`items-center justify-between w-full ${collapsed ? 'flex lg:hidden' : 'flex'
            }`}>
            <div className="flex items-center animate-fadeIn overflow-hidden select-none">
              <img src="/Smart Farm Logo.svg" className="h-10 w-auto object-contain" alt="Smart Farm Logo" />
            </div>

            {/* Close drawer button (Mobile Only) */}
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-2  border border-emerald-500/20 text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/20 cursor-pointer transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className={`flex-1 py-8 space-y-4 ${collapsed ? 'lg:px-3 px-5' : 'px-5'}`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (setMobileOpen) setMobileOpen(false);
                }}
                className={`w-full flex items-center  transition-all duration-200 group relative ${collapsed ? 'lg:justify-center lg:h-14 lg:px-0 px-4 h-16 gap-5 text-left' : 'gap-5 px-5 h-16 text-left'
                  } ${isActive
                    ? 'bg-emerald-500 text-black font-black '
                    : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/20 border border-transparent'
                  }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-black' : 'text-emerald-500'
                    } w-6 h-6`}
                />

                <span className={`text-sm font-black tracking-[0.1em] font-display truncate uppercase ${collapsed ? 'lg:hidden inline' : 'inline'
                  }`}>
                  {item.label}
                </span>

                {/* Tooltip for collapsed sidebar */}
                {collapsed && (
                  <div className="absolute left-full ml-5 px-3 py-1.5 bg-black/95 border border-emerald-500/30 text-emerald-400 text-[11px] font-black  opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 whitespace-nowrap z-50  lg:block hidden uppercase tracking-widest">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse Toggle Footer */}
        <div className="p-5 border-t border-emerald-500/10 hidden lg:flex justify-center">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="h-12 w-12 flex items-center justify-center  bg-emerald-950/20 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all duration-200 cursor-pointer  active:scale-[0.95]"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
