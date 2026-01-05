
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Search, Info, SlidersHorizontal, Loader2 } from 'lucide-react';
import { useFeatureImportance } from '../hooks/useApi';
import { useApp } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';
import { QueryErrorFallback } from './ui/ErrorBoundary';

const FeatureImportanceView: React.FC = () => {
  const { isDark } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const chartTextColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  // Use TanStack Query hook for data fetching
  const { data: featuresResponse, isLoading: loading, error, refetch } = useFeatureImportance();
  const features = featuresResponse?.features ?? [];

  const filteredFeatures = features
    .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 20);

  if (loading) {
    return (
      <div className="space-y-8 pb-12">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-12 w-96 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            <Skeleton className="lg:col-span-3 h-[750px] rounded-[2.5rem]" />
            <div className="lg:col-span-2 space-y-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <QueryErrorFallback
        error={error}
        onRetry={() => refetch()}
        title="Failed to Load Feature Importance"
      />
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

      <Card className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
        <CardHeader className="p-0 pb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <CardTitle className="text-2xl flex items-center space-x-3">
               <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                  <SlidersHorizontal size={20} />
               </div>
               <span>Predictor Rankings</span>
            </CardTitle>
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10" size={20} />
              <Input
                type="text"
                placeholder="Search features (e.g. 'auto', 'secs')..."
                className="w-full pl-14 pr-6 py-4 h-auto bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 focus:border-indigo-500 font-bold text-sm shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">

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
                <Card key={i} className="group p-6 bg-white/60 dark:bg-slate-900/60 rounded-[2rem] border border-slate-50 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{f.name}</p>
                    <Badge variant="secondary" className="text-[10px] font-black">RANK #{f.rank}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4">{f.description || 'No description available'}</p>
                  <div className="flex items-center space-x-3">
                    <Progress value={f.importance * 100} className="flex-1 h-1.5" indicatorClassName="bg-gradient-to-r from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-300" />
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black font-mono">{(f.importance * 100).toFixed(1)}%</span>
                  </div>
                </Card>
              )) : (
                <div className="p-20 text-center space-y-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                   <Search size={40} className="mx-auto text-slate-200 dark:text-slate-700" />
                   <p className="text-slate-400 dark:text-slate-600 italic font-bold">No features matching your search.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeatureImportanceView;
