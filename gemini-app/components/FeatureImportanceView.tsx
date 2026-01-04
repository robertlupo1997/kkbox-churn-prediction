
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Search, Info, SlidersHorizontal, Loader2, AlertTriangle } from 'lucide-react';
import { fetchFeatureImportance } from '../services/backendService';
import type { FeatureImportanceItem } from '../types';
import { useApp } from '../App';

const FeatureImportanceView: React.FC = () => {
  const { isDark } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [features, setFeatures] = useState<FeatureImportanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chartTextColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  useEffect(() => {
    const loadFeatures = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchFeatureImportance();
        setFeatures(response.features);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feature importance');
        console.error('Failed to load feature importance:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFeatures();
  }, []);

  const filteredFeatures = features
    .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 20);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 size={48} className="animate-spin text-indigo-600" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Loading feature importance...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass p-10 rounded-[2.5rem] shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-4">
          <AlertTriangle size={48} className="text-rose-500" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Failed to Load Data</h3>
          <p className="text-slate-500 dark:text-slate-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Feature Importance</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Global model drivers and variable contribution rankings (Top 20).</p>
        </div>
      </div>

      <div className="glass p-8 rounded-[2.5rem] shadow-xl shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div className="flex items-center space-x-3">
             <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                <SlidersHorizontal size={20} />
             </div>
             <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Predictor Rankings</h3>
          </div>
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search features (e.g. 'auto', 'secs')..."
              className="w-full pl-14 pr-6 py-4 bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 focus:border-indigo-500 outline-none transition-all font-bold text-sm shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-3 h-[750px] w-full min-w-0 bg-white/40 dark:bg-slate-950/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                layout="vertical"
                data={filteredFeatures}
                margin={{ left: 50, right: 60, top: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  fontSize={10}
                  fontWeight={900}
                  width={140}
                  tickLine={false}
                  axisLine={false}
                  tick={{fill: chartTextColor}}
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(99, 102, 241, 0.05)' }}
                  contentStyle={{
                    borderRadius: '20px',
                    backgroundColor: isDark ? '#0f172a' : '#fff',
                    border: 'none',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                    padding: '15px'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: '900', color: '#6366f1' }}
                />
                <Bar dataKey="importance" fill="#4f46e5" radius={[0, 10, 10, 0]} barSize={28}>
                  {filteredFeatures.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={isDark ? `rgba(129, 140, 248, ${1 - index * 0.04})` : `rgba(79, 70, 229, ${1 - index * 0.04})`}
                    />
                  ))}
                  <LabelList
                    dataKey="importance"
                    position="right"
                    formatter={(val: number) => `${(val * 100).toFixed(1)}%`}
                    fontSize={10}
                    fontWeight={900}
                    fill={chartTextColor}
                    offset={10}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center space-x-2 mb-2">
              <Info size={16} className="text-slate-300 dark:text-slate-600" />
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Detailed Definitions</h4>
            </div>
            <div className="space-y-4 max-h-[680px] overflow-y-auto pr-3 custom-scrollbar">
              {filteredFeatures.length > 0 ? filteredFeatures.map((f, i) => (
                <div key={i} className="group p-6 bg-white/60 dark:bg-slate-900/60 rounded-[2rem] border border-slate-50 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{f.name}</p>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-600">RANK #{f.rank}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4">{f.description || 'No description available'}</p>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-300 rounded-full transition-all duration-1000" style={{ width: `${f.importance * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black font-mono">{(f.importance * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )) : (
                <div className="p-20 text-center space-y-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                   <Search size={40} className="mx-auto text-slate-200 dark:text-slate-700" />
                   <p className="text-slate-400 dark:text-slate-600 italic font-bold">No features matching your search.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureImportanceView;
