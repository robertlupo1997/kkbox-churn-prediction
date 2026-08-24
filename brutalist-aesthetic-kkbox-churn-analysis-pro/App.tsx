
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, Zap, Sun, Moon, MoveRight, Github, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './components/Dashboard';
import MemberLookup from './components/MemberLookup';
import ModelPerformance from './components/ModelPerformance';
import FeatureImportanceView from './components/FeatureImportanceView';
import ROICalculator from './components/ROICalculator';
import About from './components/About';
import Soundwave from './components/Soundwave';

// Tech stack badges for recruiter visibility
const TechBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="px-2 py-1 text-[9px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600">
    {label}
  </span>
);

const TECH_STACK = ['Python', 'React', 'FastAPI', 'LightGBM', 'XGBoost', 'SHAP', 'DuckDB'];

// Sticky metrics banner for key stats visibility
const MetricsBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black text-white py-2 px-4 flex items-center justify-center gap-4 sm:gap-6 text-[10px] font-black uppercase tracking-widest">
      <span className="flex items-center gap-1">
        Archived Tuned-Val AUC <span className="text-brand">0.9696</span> — no served model
      </span>
      <span className="hidden sm:inline text-zinc-500">|</span>
      <span className="hidden sm:flex items-center gap-1">
        Served model: <span className="text-brand">121</span> Features
      </span>
      <span className="hidden md:inline text-zinc-500">|</span>
      <span className="hidden md:flex items-center gap-1">
        Browsable: <span className="text-brand">1,995</span> Holdout Members
      </span>
      <span className="hidden lg:inline text-zinc-500">|</span>
      <span className="hidden lg:flex items-center gap-1">
        Sample of <span className="text-brand">10K</span> Rows
      </span>
      <button
        onClick={() => setIsVisible(false)}
        className="ml-2 sm:ml-4 text-zinc-500 hover:text-white transition-colors"
        aria-label="Dismiss banner"
      >
        <X size={12} />
      </button>
    </div>
  );
};

const AppContext = createContext({
  isLoading: false,
  setLoading: (v: boolean) => {},
  isDark: false,
  toggleDark: () => {},
  globalSearch: '',
  setGlobalSearch: (s: string) => {}
});

export const useApp = () => useContext(AppContext);

const NavItem: React.FC<{ to: string; label: string; active: boolean; onClick?: () => void }> = ({ to, label, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-white transition-all hover:scale-105 ${
      active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-transparent text-black dark:text-white hover:bg-brand hover:text-white'
    }`}
  >
    {label}
  </Link>
);

const Ticker = () => (
  <div className="my-12 py-4 bg-brand overflow-hidden flex whitespace-nowrap askew-ticker border-y-2 border-black dark:border-white">
    <div className="animate-marquee">
      {[...Array(10)].map((_, i) => (
        <span key={i} className="mx-8 text-[14px] font-black uppercase tracking-widest flex items-center inline-flex text-black">
          <Zap size={16} className="mr-2 fill-black" />
          CHURN ANALYSIS SUITE • PREDICTIVE MODELING • LIGHTGBM • SHAP EXPLANATIONS • KKBOX DATASET
        </span>
      ))}
    </div>
  </div>
);

const Header = () => {
  const { isDark, toggleDark, globalSearch, setGlobalSearch } = useApp();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/lookup?id=${encodeURIComponent(globalSearch)}`);
    }
  };

  return (
    <header className="p-8 pb-4">
      <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-8">
        <div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-[0.8] mb-2 dark:text-white">
            CHURN.<span className="text-brand italic">ANALYSIS</span>
          </h1>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3 max-w-md">
            Predicting customer churn at <span className="text-brand font-bold">0.9696 AUC</span>, a tuned-validation figure rather than a held-out one, using 131 engineered features and ensemble ML models
          </p>
          <div className="flex flex-wrap gap-1 mb-3">
            {TECH_STACK.map(tech => <TechBadge key={tech} label={tech} />)}
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-[2px] w-12 bg-black dark:bg-white"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] dark:text-white">Portfolio Project</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 w-full md:w-auto">
          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className="flex brutalist-border dark:border-white bg-white dark:bg-zinc-900 w-full sm:w-64">
              <input
                type="text"
                placeholder="GLOBAL_MEMBER_SCAN..."
                className="flex-1 px-3 py-2 text-[10px] font-bold uppercase bg-transparent outline-none dark:text-white"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              <button type="submit" className="px-2 border-l-2 border-black dark:border-white hover:bg-brand transition-colors dark:text-white">
                <Search size={14} />
              </button>
            </form>
            <button
              onClick={toggleDark}
              className="p-3 brutalist-border dark:border-white hover:bg-brand transition-all bg-white dark:bg-zinc-900 dark:text-white"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <a
              href="https://github.com/robertlupo1997/kkbox-churn-prediction"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 brutalist-border dark:border-white hover:bg-brand hover:text-white transition-all bg-white dark:bg-zinc-900 dark:text-white flex items-center gap-2"
            >
              <Github size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">Code</span>
            </a>
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-black uppercase tracking-widest mb-1 dark:text-white">R.LUPO@2024</span>
              <div className="w-32 h-8 barcode-bg border-2 border-black dark:border-white opacity-20"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-brand p-4 brutalist-border dark:border-white flex flex-col md:flex-row justify-between items-center gap-4 mb-8 relative group overflow-hidden">
        <div className="text-[10px] font-black text-black uppercase tracking-tight max-w-xl leading-tight z-10">
          "Why did the data scientist break up with the outlier? Because their relationship was just too significant!"
          Think more, churn less. After use apply on CRM data.
          Please contact your data scientist.
        </div>
        <motion.div
          className="flex space-x-2 z-10 cursor-pointer"
          whileHover={{ x: 20 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="h-8 w-8 bg-black flex items-center justify-center">
            <MoveRight className="text-brand" size={18} />
          </div>
          <div className="h-8 w-2 bg-black"></div>
          <div className="h-8 w-4 bg-black"></div>
        </motion.div>
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-[-50px] opacity-10 font-black text-9xl pointer-events-none select-none">HA!</div>
      </div>
    </header>
  );
};

const Navigation = () => {
  const location = useLocation();
  const currentPath = location.pathname || '/';

  return (
    <nav className="px-8 mb-4 flex flex-wrap gap-2">
      <NavItem to="/" label="Dashboard" active={currentPath === '/'} />
      <NavItem to="/lookup" label="Member Lookup" active={currentPath === '/lookup'} />
      <NavItem to="/performance" label="Performance" active={currentPath === '/performance'} />
      <NavItem to="/features" label="Features" active={currentPath === '/features'} />
      <NavItem to="/roi" label="ROI Calc" active={currentPath === '/roi'} />
      <NavItem to="/about" label="Docs" active={currentPath === '/about'} />
    </nav>
  );
};

const Footer = () => (
  <footer className="mt-20">
    <div className="h-4 w-full animated-strip border-t-2 border-black dark:border-white"></div>
    <div className="bg-black text-brand p-8 sm:p-12 md:p-20 dark:bg-zinc-950 dark:text-brand border-t-2 border-black dark:border-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 md:gap-12">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-50">Portfolio Project by</p>
          <span className="text-2xl sm:text-3xl md:text-4xl font-black">Robert Lupo</span>
        </div>
        <div className="text-left md:text-right text-[10px] font-black uppercase tracking-widest space-y-2">
          <a href="https://github.com/robertlupo1997/kkbox-churn-prediction" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors">GitHub</a>
          <a href="https://linkedin.com/in/robertlupo1997" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors">LinkedIn</a>
        </div>
      </div>
      <div className="mt-12 md:mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-[10px] opacity-50">Built with React, FastAPI, LightGBM, and SHAP</p>
        <p className="text-[10px] opacity-50">2024 Robert Lupo</p>
      </div>
      <div className="mt-8 md:mt-12 opacity-70 hover:opacity-100 transition-opacity duration-300">
        <div className="hidden sm:block">
          <Soundwave numBars={80} barWidth={3} gap={3} maxHeight={50} />
        </div>
        <div className="sm:hidden">
          <Soundwave numBars={40} barWidth={2} gap={2} maxHeight={30} />
        </div>
      </div>
    </div>
  </footer>
);

function AppContent() {
  const location = useLocation();
  const { isDark } = useApp();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <>
      <MetricsBanner />
      <div className="min-h-screen max-w-[1440px] mx-auto brutalist-border dark:border-white bg-white dark:bg-zinc-950 shadow-2xl my-4 mt-12 overflow-hidden transition-colors duration-300">
        <Header />
        <Ticker />
        <div className="py-8">
          <Navigation />
          <main className="px-8">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/lookup" element={<MemberLookup />} />
                <Route path="/performance" element={<ModelPerformance />} />
                <Route path="/features" element={<FeatureImportanceView />} />
                <Route path="/roi" element={<ROICalculator />} />
                <Route path="/about" element={<About />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
        <Footer />
      </div>
    </>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [globalSearch, setGlobalSearch] = useState('');

  const toggleDark = () => {
    setIsDark(prev => {
      const newVal = !prev;
      localStorage.setItem('theme', newVal ? 'dark' : 'light');
      return newVal;
    });
  };

  return (
    <AppContext.Provider value={{
      isLoading,
      setLoading: setIsLoading,
      isDark,
      toggleDark,
      globalSearch,
      setGlobalSearch
    }}>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppContext.Provider>
  );
}
