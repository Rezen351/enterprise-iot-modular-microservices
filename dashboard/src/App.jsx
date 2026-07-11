import { useState, useEffect } from 'react';
import { 
  Leaf, 
  Activity, 
  ShieldAlert, 
  Video, 
  ArrowRight, 
  Sparkles, 
  LogOut,
  User as UserIcon,
  Cpu,
  Database,
  Layers,
  Network,
  Sun,
  Moon
} from 'lucide-react';
import heroImage from './assets/aeroponic_hero.png';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import DashboardLayout from './components/Dashboard/DashboardLayout';
import WebSerialClient from './components/WebSerial/WebSerialClient';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { authApi } from './api/auth';

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  // Initialize user synchronously from localStorage
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // Initialize view based on current path and user session
  const [view, setView] = useState(() => {
    const path = window.location.pathname;
    const savedUser = sessionStorage.getItem('user');
    if (path === '/dashboard' && savedUser) {
      return 'dashboard';
    }
    return 'landing';
  });

  // Sync state changes to browser URL
  useEffect(() => {
    if (view === 'dashboard' && user) {
      if (window.location.pathname !== '/dashboard') {
        window.history.pushState(null, '', '/dashboard');
      }
    } else if (view === 'webserial') {
      if (window.location.pathname !== '/configurator') {
        window.history.pushState(null, '', '/configurator');
      }
    } else {
      if (window.location.pathname !== '/') {
        window.history.pushState(null, '', '/');
      }
    }
  }, [view, user]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const savedUser = sessionStorage.getItem('user');
      if (path === '/dashboard' && savedUser) {
        setView('dashboard');
      } else if (path === '/configurator') {
        setView('webserial');
      } else {
        setView('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = async () => {
    await authApi.logout();
    setUser(null);
    setView('landing');
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowAuth(false);
    setView('dashboard');
  };

  if (view === 'dashboard' && user) {
    return <DashboardLayout onExit={() => setView('landing')} onLogout={handleLogout} />;
  }

  if (view === 'webserial') {
    return (
      <div className="min-h-screen font-sans selection:bg-emerald-500/30 overflow-x-hidden relative" style={{ backgroundColor: 'var(--bg-main)' }}>
        <nav className="relative z-50 border-b border-emerald-500/10 bg-inherit/80 backdrop-blur-xl sticky top-0" style={{ borderColor: 'var(--border-main)' }}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center compact-mobile-px">
            <div className="flex items-center cursor-pointer group" onClick={() => setView('landing')}>
              <img src="/Smart Farm Logo.svg" className={`h-9 sm:h-10 w-auto object-contain ${theme === 'light' ? 'invert opacity-80' : ''}`} alt="Smart Farm Logo" />
            </div>
            <button onClick={() => setView('landing')} className="text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
              <LogOut className="w-4 h-4 rotate-180" /> Back to Home
            </button>
          </div>
        </nav>
        <WebSerialClient />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans selection:bg-emerald-500/30 overflow-x-hidden relative">
      
      {/* Background Radial Glows */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%]  opacity-40 blur-[150px]" style={{ backgroundColor: 'var(--radial-glow-1)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%]  opacity-40 blur-[150px]" style={{ backgroundColor: 'var(--radial-glow-2)' }} />
      </div>

      {/* Auth Modal Overlay */}
      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            onClick={() => setShowAuth(false)}
          />
          <div className="relative z-10 w-full flex justify-center animate-in fade-in zoom-in duration-300">
            {authMode === 'login' ? (
              <Login 
                onLoginSuccess={handleLoginSuccess} 
                onToggleMode={() => setAuthMode('register')} 
              />
            ) : (
              <Register 
                onRegisterSuccess={() => setAuthMode('login')} 
                onToggleMode={() => setAuthMode('login')} 
              />
            )}
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <nav className="relative z-50 border-b border-emerald-500/10 bg-inherit/80 backdrop-blur-xl sticky top-0" style={{ borderColor: 'var(--border-main)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center compact-mobile-px">
          <div className="flex items-center cursor-pointer group select-none" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <img src="/Smart Farm Logo.svg" className={`h-9 sm:h-10 w-auto object-contain ${theme === 'light' ? 'invert opacity-80' : ''}`} alt="Smart Farm Logo" />
          </div>
          
          <div className="hidden md:flex items-center gap-10 text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
            <a href="#hero" className="hover:text-emerald-500 transition-colors">Home</a>
            <a href="#features" className="hover:text-emerald-500 transition-colors">Technology</a>
            <a href="#architecture" className="hover:text-emerald-500 transition-colors">System</a>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              className="h-10 w-10 flex items-center justify-center  transition-all duration-300 border border-emerald-500/10 hover:bg-emerald-500/5 cursor-pointer"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-slate-600" />
              ) : (
                <Sun className="w-5 h-5 text-emerald-400" />
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 px-4 h-10 bg-emerald-500/10 border border-emerald-500/20 ">
                  <UserIcon className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">{user.username}</span>
                </div>
                <button 
                  onClick={() => setView('dashboard')}
                  className="px-6 h-10 bg-emerald-500 text-black font-black  text-xs uppercase tracking-widest transition-all duration-300 hover:bg-emerald-400 active:scale-95  cursor-pointer"
                >
                  Dashboard
                </button>
                <button 
                  onClick={handleLogout}
                  className="h-10 w-10 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors cursor-pointer border border-white/5  hover:bg-red-500/5"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => { setAuthMode('login'); setShowAuth(true); }}
                  className="px-6 h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black  text-xs uppercase tracking-widest transition-all duration-300 active:scale-95 "
                >
                  Login
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="max-w-7xl mx-auto px-6 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10 compact-mobile-px">
        <div className="lg:col-span-7 flex flex-col items-start text-left">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400  text-[10px] font-black tracking-[0.2em] uppercase mb-8 ">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Smart Farming
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black font-display leading-[1.05] tracking-tighter mb-8 uppercase" style={{ color: 'var(--text-main)' }}>
            Precision <br />
            <span className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 bg-clip-text text-transparent">Potato Seedling</span> <br />
            Cultivation
          </h1>
          <p className="text-lg sm:text-xl max-w-2xl leading-relaxed mb-10 font-medium" style={{ color: 'var(--text-muted)' }}>
            IoT + AI monitoring for aeroponic farming.{user ? ` Welcome, ${user.username}.` : ''}
          </p>
          
          <div className="flex flex-wrap gap-5 mb-12">
            {user ? (
              <button 
                onClick={() => setView('dashboard')}
                className="px-10 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black  transition-all duration-300 active:scale-95 flex items-center gap-3 cursor-pointer  uppercase tracking-widest text-sm"
              >
                Launch Dashboard <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onClick={() => { setAuthMode('login'); setShowAuth(true); }}
                className="px-10 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black  transition-all duration-300 active:scale-95 flex items-center gap-3 cursor-pointer  uppercase tracking-widest text-sm"
              >
                Access Control <ArrowRight className="w-5 h-5" />
              </button>
            )}
            <a href="#features" className="px-10 h-16 border bg-slate-500/5 hover:bg-slate-500/10 font-black  transition-all duration-300 active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>
              Technical Specs
            </a>
          </div>

          <div className="flex items-center gap-10 opacity-60 grayscale group-hover:opacity-100 transition-all duration-500">
             <div className="flex flex-col gap-1">
                <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--text-main)' }}>15s</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Misting</span>
             </div>
             <div className="flex flex-col gap-1">
                <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--text-main)' }}>98.4%</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">AI</span>
             </div>
             <div className="flex flex-col gap-1">
                <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--text-main)' }}>24/7</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Uptime</span>
             </div>
          </div>
        </div>

        <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
          <div className="relative w-full max-w-[480px] aspect-[4/5]  overflow-hidden border border-emerald-500/5  group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10" />
            <div className="absolute inset-0 bg-emerald-500/5 mix-blend-overlay z-10" />
            <img src={heroImage} alt="Aeroponics" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
            
            {/* Overlay Status Card */}
            <div className="absolute bottom-8 left-8 right-8 z-20 p-5 backdrop-blur-md border  animate-fadeIn" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}>
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2  bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Node-01 Active</span>
                  </div>
                  <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>12:30:15 UTC</span>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[9px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>Air Temp</div>
                    <div className="text-lg font-black" style={{ color: 'var(--text-main)' }}>18.4°C</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>Humidity</div>
                    <div className="text-lg font-black" style={{ color: 'var(--text-main)' }}>82%</div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-32 border-t relative z-10 compact-mobile-px" style={{ borderColor: 'var(--border-main)' }}>
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em] mb-4">Core Ecosystem</h2>
          <h3 className="text-4xl sm:text-5xl font-black uppercase tracking-tight leading-tight" style={{ color: 'var(--text-main)' }}>Advanced Control <br />for Modern Farms</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-10 border  transition-all duration-500 group " style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}>
                <div className="p-4 bg-emerald-500/10  w-fit mb-8 group-hover:scale-110 transition-transform duration-300">
                    <Activity className="w-8 h-8 text-emerald-400" />
                </div>
                <h4 className="text-xl font-black mb-4 uppercase tracking-wider" style={{ color: 'var(--text-main)' }}>Live Telemetry</h4>
                <p className="leading-relaxed font-medium" style={{ color: 'var(--text-muted)' }}>ESP32 telemetry. Monitor pH, EC, climate live.</p>
            </div>
            <div className="p-10 border  transition-all duration-500 group " style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}>
                <div className="p-4 bg-emerald-500/10  w-fit mb-8 group-hover:scale-110 transition-transform duration-300">
                    <Video className="w-8 h-8 text-emerald-400" />
                </div>
                <h4 className="text-xl font-black mb-4 uppercase tracking-wider" style={{ color: 'var(--text-main)' }}>YOLOv8 AI Vision</h4>
                <p className="leading-relaxed font-medium" style={{ color: 'var(--text-muted)' }}>Deep learning root/leaf analysis on S3.</p>
            </div>
            <div className="p-10 border  transition-all duration-500 group " style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}>
                <div className="p-4 bg-emerald-500/10  w-fit mb-8 group-hover:scale-110 transition-transform duration-300">
                    <ShieldAlert className="w-8 h-8 text-emerald-400" />
                </div>
                <h4 className="text-xl font-black mb-4 uppercase tracking-wider" style={{ color: 'var(--text-main)' }}>Edge Protection</h4>
                <p className="leading-relaxed font-medium" style={{ color: 'var(--text-muted)' }}>Relay switching + pump failsafes.</p>
            </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="max-w-7xl mx-auto px-6 py-32 border-t relative z-10 overflow-hidden compact-mobile-px" style={{ borderColor: 'var(--border-main)' }}>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1 grid grid-cols-2 gap-4">
                <div className="space-y-4 pt-12">
                    <div className="p-6 border  " style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}>
                        <Cpu className="w-6 h-6 text-emerald-400 mb-3" />
                        <span className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Compute</span>
                        <span className="text-sm font-black uppercase" style={{ color: 'var(--text-main)' }}>Distributed Go DAL</span>
                    </div>
                    <div className="p-6 border  " style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}>
                        <Database className="w-6 h-6 text-emerald-400 mb-3" />
                        <span className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Persistence</span>
                        <span className="text-sm font-black uppercase" style={{ color: 'var(--text-main)' }}>MariaDB + Redis</span>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="p-6 border  " style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}>
                        <Network className="w-6 h-6 text-emerald-400 mb-3" />
                        <span className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Traffic</span>
                        <span className="text-sm font-black uppercase" style={{ color: 'var(--text-main)' }}>Nginx Gateway</span>
                    </div>
                    <div className="p-6 border  " style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}>
                        <Layers className="w-6 h-6 text-emerald-400 mb-3" />
                        <span className="block text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Logic</span>
                        <span className="text-sm font-black uppercase" style={{ color: 'var(--text-main)' }}>Node-RED Engine</span>
                    </div>
                </div>
            </div>
            <div className="order-1 lg:order-2">
                <h2 className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em] mb-4">The Backbone</h2>
                <h3 className="text-4xl font-black uppercase tracking-tight leading-tight mb-8" style={{ color: 'var(--text-main)' }}>Production Grade <br />Infrastructure</h3>
                <p className="text-lg leading-relaxed font-medium mb-10" style={{ color: 'var(--text-muted)' }}>
                   Production-grade microservices on Docker. Isolated, scalable, SSL-secured.
                </p>
                <ul className="space-y-4">
                    {['WebSocket Streams', 'S3 Storage', 'Encrypted Handshake', 'Auto DB Migrations'].map((item) => (
                        <li key={item} className="flex items-center gap-3 font-black uppercase tracking-widest text-[11px]" style={{ color: 'var(--text-main)' }}>
                            <div className="w-1.5 h-1.5  bg-emerald-400" />
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-16 text-center relative z-10" style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-main)' }}>
        <div className="flex justify-center items-center mb-8 opacity-60 select-none">
            <img src="/Smart Farm Logo.svg" className={`h-8 w-auto object-contain ${theme === 'light' ? 'invert opacity-80' : ''}`} alt="Smart Farm Logo" />
        </div>
        <div className="flex justify-center gap-10 text-[10px] font-black uppercase tracking-[0.2em] mb-10" style={{ color: 'var(--text-muted)' }}>
            <a href="#" className="hover:text-emerald-400 transition-colors">Safety Logs</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Documentation</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">API Status</a>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>© 2026 Aeroponik. Built for scale.</p>
      </footer>

    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
