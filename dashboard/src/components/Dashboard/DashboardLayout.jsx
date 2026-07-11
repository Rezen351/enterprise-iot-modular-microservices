import { useState, useEffect } from 'react';
import {
  Menu,
  Clock,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ModuleProvider } from '../../context/ModuleContext';
import Sidebar from './Sidebar';
import Profile from './Pages/Users';
import UserManagement from './Pages/UserManagement';
import ModuleManagement from './Pages/DeviceManagement';
import NodeConfigPage from './Pages/NodeConfigPage';
import Analytics from './Pages/Analytics';

function DashboardContent({ onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [nodeConfig, setNodeConfig] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Current user (from session) — used for admin-only UI
  const me = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  })();
  const isAdmin = Array.isArray(me?.roles) && me.roles.includes('admin');

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}.${minutes}.${seconds}`;
  };

  const formatDate = (date) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${days[date.getDay()]}`;
  };

  const renderContent = () => {
    if (nodeConfig) {
      return <NodeConfigPage node={nodeConfig} onBack={() => { setNodeConfig(null); setActiveTab('module'); }} />;
    }
    switch (activeTab) {
      case 'profile':
        return <Profile onLogout={onLogout} />;
      case 'module':
        return <ModuleManagement onOpenNodeConfig={setNodeConfig} />;
      case 'analytics':
        return <Analytics />;
      case 'users':
        return isAdmin ? <UserManagement /> : <Profile onLogout={onLogout} />;
      default:
        return <Profile onLogout={onLogout} />;
    }
  };

  return (
    <div className="h-screen flex relative overflow-hidden transition-colors duration-300" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}>
      {/* Background Glows */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] right-[5%] w-[40%] h-[40%]  opacity-40 blur-[130px]" style={{ backgroundColor: 'var(--radial-glow-1)' }} />
        <div className="absolute bottom-[10%] left-[10%] w-[40%] h-[40%]  opacity-40 blur-[130px]" style={{ backgroundColor: 'var(--radial-glow-2)' }} />
      </div>

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        hidden={sidebarHidden}
        isAdmin={isAdmin}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 z-10 relative h-screen overflow-hidden">
        <header className={`shrink-0 transition-all duration-300 border-b flex items-center justify-between gap-2 backdrop-blur-md h-14 sm:h-16 lg:h-20 px-3 sm:px-4 lg:px-8 compact-mobile-header ${sidebarHidden ? 'lg:left-0' : (sidebarCollapsed ? 'lg:left-20' : 'lg:left-72')
          }`} style={{ backgroundColor: 'var(--bg-main)CC', borderColor: 'var(--border-main)' }}>
          {/* Header Left Actions */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2.5  border border-emerald-500/20 bg-slate-500/5 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all duration-200 cursor-pointer"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              onClick={() => setSidebarHidden(!sidebarHidden)}
              className="hidden lg:flex p-2.5  border border-emerald-500/20 bg-slate-500/5 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all duration-200 cursor-pointer"
              title={sidebarHidden ? "Show Sidebar" : "Hide Sidebar"}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Header Right widgets */}
          <div className="flex items-center gap-2 lg:gap-5 shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="h-10 w-10 flex items-center justify-center  transition-all duration-300 border border-emerald-500/10 bg-slate-500/5 hover:bg-emerald-500/10 cursor-pointer"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-slate-600" />
              ) : (
                <Sun className="w-5 h-5 text-emerald-400" />
              )}
            </button>

            {/* Live Clock Card */}
            <div className="hidden sm:flex items-center gap-2 lg:gap-3 px-3 py-1.5 sm:px-4 sm:py-2 lg:py-2.5 border  " style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}>
              <div className="flex flex-col items-end">
                <span className="text-xs sm:text-base lg:text-lg font-black font-display tracking-widest text-emerald-400 tabular-nums">
                  {formatTime(currentTime)}
                </span>
                <span className="hidden lg:inline text-[11px] font-black uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(currentTime)}
                </span>
              </div>
              <div className="p-1.5 sm:p-2 lg:p-2.5 bg-emerald-500/10 border border-emerald-500/20">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3  bg-red-500/5 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 font-display font-bold text-xs sm:text-sm tracking-wider transition-all duration-200 cursor-pointer"
              title="Logout from Session"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">LOGOUT</span>
            </button>
          </div>
        </header>

        {/* Content Page View */}
        <main className="flex-1 overflow-y-auto pt-14 sm:pt-16 lg:pt-20 main-content-area">
          <div className="p-3 sm:p-4 lg:p-6">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardLayout({ onExit, onLogout }) {
  return (
    <ModuleProvider>
      <DashboardContent onLogout={onLogout} />
    </ModuleProvider>
  );
}

export default DashboardLayout;
