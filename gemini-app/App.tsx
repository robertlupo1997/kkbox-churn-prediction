
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, UserSearch, BarChart3, Target, Calculator, BookOpen, Menu, X, Sun, Moon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './components/Dashboard';
import MemberLookup from './components/MemberLookup';
import ModelPerformance from './components/ModelPerformance';
import FeatureImportanceView from './components/FeatureImportanceView';
import ROICalculator from './components/ROICalculator';
import About from './components/About';

// Global Context for Theme and Loading
const AppContext = createContext({
  isDark: false,
  toggleTheme: () => {},
  isLoading: false,
  setLoading: (v: boolean) => {}
});

export const useApp = () => useContext(AppContext);

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; active: boolean; onClick?: () => void }> = ({ to, icon, label, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 translate-x-1' 
        : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 hover:shadow-sm'
    }`}
  >
    <span className={active ? 'text-white' : 'group-hover:text-indigo-600 transition-colors'}>
      {icon}
    </span>
    <span className="font-semibold text-sm">{label}</span>
  </Link>
);

const Sidebar: React.FC<{ isOpen: boolean; toggle: () => void; isDark: boolean; toggleTheme: () => void }> = ({ isOpen, toggle, isDark, toggleTheme }) => {
  const location = useLocation();
  const currentPath = location.pathname || '/';

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggle}
      />
      <aside className={`fixed top-4 left-4 bottom-4 w-64 glass rounded-[2rem] z-50 transform transition-all duration-500 lg:translate-x-0 shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-[120%]'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center space-x-3 mb-12">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white font-black text-xl italic">K</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Churn<span className="text-indigo-600">Pro</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Analysis Suite</p>
            </div>
          </div>
          
          <nav className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
            <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" active={currentPath === '/'} onClick={toggle} />
            <NavItem to="/lookup" icon={<UserSearch size={20} />} label="Member Lookup" active={currentPath === '/lookup'} onClick={toggle} />
            <NavItem to="/performance" icon={<BarChart3 size={20} />} label="Performance" active={currentPath === '/performance'} onClick={toggle} />
            <NavItem to="/features" icon={<Target size={20} />} label="Features" active={currentPath === '/features'} onClick={toggle} />
            <NavItem to="/roi" icon={<Calculator size={20} />} label="ROI Calc" active={currentPath === '/roi'} onClick={toggle} />
            <NavItem to="/about" icon={<BookOpen size={20} />} label="Documentation" active={currentPath === '/about'} onClick={toggle} />
          </nav>

          <div className="mt-auto pt-6 space-y-4">
            <button 
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 transition-all hover:ring-2 hover:ring-indigo-100 dark:hover:ring-indigo-900"
            >
              <div className="flex items-center space-x-2">
                {isDark ? <Moon size={18} /> : <Sun size={18} />}
                <span className="text-xs font-bold">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
              </div>
              <div className={`w-8 h-4 rounded-full bg-slate-300 dark:bg-indigo-600 relative transition-colors`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isDark ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </div>
            </button>

            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter mb-1">Status</p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Model Live</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

const LoadingBar: React.FC<{ active: boolean }> = ({ active }) => (
  <div className={`fixed top-0 left-0 right-0 h-1 z-[100] transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>
    <div className="h-full bg-indigo-600 animate-progress origin-left w-full shadow-[0_0_10px_#4f46e5]" />
  </div>
);

// Inner component to safely use router hooks
function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { isDark, toggleTheme, isLoading } = useApp();

  return (
    <div className="min-h-screen flex selection:bg-indigo-100 dark:selection:bg-indigo-900/50">
      <LoadingBar active={isLoading} />
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        isDark={isDark} 
        toggleTheme={toggleTheme}
      />
      
      <main className="flex-1 lg:ml-72 p-4 md:p-10 transition-all duration-500">
        <header className="flex items-center justify-between mb-10 lg:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 glass rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600">
            <Menu size={24} />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg italic">K</span>
            </div>
            <h1 className="text-lg font-black tracking-tight dark:text-white">ChurnPro</h1>
          </div>
          <button onClick={toggleTheme} className="p-2 glass rounded-xl text-slate-600 dark:text-slate-300">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
              <Route path="/lookup" element={<PageTransition><MemberLookup /></PageTransition>} />
              <Route path="/performance" element={<PageTransition><ModelPerformance /></PageTransition>} />
              <Route path="/features" element={<PageTransition><FeatureImportanceView /></PageTransition>} />
              <Route path="/roi" element={<PageTransition><ROICalculator /></PageTransition>} />
              <Route path="/about" element={<PageTransition><About /></PageTransition>} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <AppContext.Provider value={{ 
      isDark, 
      toggleTheme: () => setIsDark(prev => !prev), 
      isLoading, 
      setLoading: setIsLoading 
    }}>
      <HashRouter>
        <AppContent />
      </HashRouter>
      <style>{`
        @keyframes progress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.5); }
          100% { transform: scaleX(1); }
        }
        .animate-progress {
          animation: progress 1s infinite linear;
        }
      `}</style>
    </AppContext.Provider>
  );
}
