
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, Zap, Sun, Moon, MoveRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './components/Dashboard';
import MemberLookup from './components/MemberLookup';
import ModelPerformance from './components/ModelPerformance';
import FeatureImportanceView from './components/FeatureImportanceView';
import ROICalculator from './components/ROICalculator';
import About from './components/About';

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
    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-white transition-all ${
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
          CHURN ANALYSIS SUITE • PREDICTIVE MODELING • XGBOOST ENSEMBLE • GEMINI AI • KKBOX DATASET
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
          <h1 className="text-7xl font-black tracking-tighter leading-[0.8] mb-4 dark:text-white">
            CHURN.<span className="text-brand italic">ANALYSIS</span>
          </h1>
          <div className="flex items-center space-x-2">
            <div className="h-[2px] w-12 bg-black dark:bg-white"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] dark:text-white">Independent Developer Pro</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 w-full md:w-auto">
          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className="flex brutalist-border dark:border-white bg-white dark:bg-zinc-900 w-64">
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
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-black uppercase tracking-widest mb-1 dark:text-white">KKBOX_DSGN@2024</span>
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
    <div className="bg-black text-brand p-20 dark:bg-zinc-950 dark:text-brand border-t-2 border-black dark:border-white">
      <div className="flex flex-col md:flex-row justify-between items-end gap-12">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-50">Say hello</p>
          <a href="mailto:data@churnpro.ai" className="text-4xl font-black underline hover:text-white transition-colors">
            data@churnpro.ai
          </a>
        </div>
        <div className="text-right text-[10px] font-black uppercase tracking-widest space-y-2">
          <p className="hover:text-white cursor-pointer">Instagram</p>
          <p className="hover:text-white cursor-pointer">Twitter</p>
          <p className="hover:text-white cursor-pointer">LinkedIn</p>
          <p className="hover:text-white cursor-pointer">GitHub</p>
        </div>
      </div>
      <div className="mt-20 opacity-10">
        <h2 className="text-[15vw] font-black tracking-tighter leading-none whitespace-nowrap">
          CHURN.ANALYSIS
        </h2>
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
    <div className="min-h-screen max-w-[1440px] mx-auto brutalist-border dark:border-white bg-white dark:bg-zinc-950 shadow-2xl my-4 overflow-hidden transition-colors duration-300">
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
