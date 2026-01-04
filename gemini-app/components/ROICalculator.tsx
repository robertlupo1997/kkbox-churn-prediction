
import React, { useState, useMemo } from 'react';
import { Calculator, TrendingUp, DollarSign, Users, Target, BarChart as ChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

const CustomROITooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isProjected = label.includes('After');
    return (
      <div className="glass p-4 rounded-2xl shadow-2xl border-indigo-100 dark:border-indigo-900">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-lg font-black ${isProjected ? 'text-indigo-600' : 'text-slate-500'}`}>
          {payload[0].value.toLocaleString()} Monthly Churns
        </p>
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-500">
            {isProjected ? 'Reflects intervention impact' : 'Current unmanaged baseline'}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const ROICalculator: React.FC = () => {
  const [subs, setSubs] = useState(100000);
  const [arpu, setArpu] = useState(149);
  const [churn, setChurn] = useState(5.5);
  const [reduction, setReduction] = useState(15);

  const results = useMemo(() => {
    const monthlyChurnCount = subs * (churn / 100);
    const lostRevenue = monthlyChurnCount * arpu;
    const usersSaved = monthlyChurnCount * (reduction / 100);
    const revenueSaved = usersSaved * arpu;
    const yearlySavings = revenueSaved * 12;
    const projectedChurnCount = monthlyChurnCount - usersSaved;

    return {
      monthlyChurnCount: Math.round(monthlyChurnCount),
      projectedChurnCount: Math.round(projectedChurnCount),
      lostRevenue: Math.round(lostRevenue),
      usersSaved: Math.round(usersSaved),
      revenueSaved: Math.round(revenueSaved),
      yearlySavings: Math.round(yearlySavings)
    };
  }, [subs, arpu, churn, reduction]);

  const chartData = [
    { name: 'Before (Current)', value: results.monthlyChurnCount, color: '#94a3b8' },
    { name: 'After (Reduced)', value: results.projectedChurnCount, color: '#6366f1' }
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">ROI Calculator</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Modeling the financial impact of predictive retention strategies.</p>
        </div>
      </div>

      <div className="glass p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="space-y-8">
            <h3 className="text-2xl font-bold flex items-center space-x-3 text-slate-900 dark:text-white">
               <Calculator className="text-indigo-600" />
               <span>Simulated Parameters</span>
            </h3>
            <div className="space-y-8">
              <label className="block">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Total Subscriber Base</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-xl">{subs.toLocaleString()}</span>
                </div>
                <input
                  type="range" min="10000" max="1000000" step="10000"
                  className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  value={subs} onChange={(e) => setSubs(Number(e.target.value))}
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <label className="block">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Monthly ARPU (NTD)</span>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={16} />
                    <input
                      type="number"
                      className="w-full pl-10 pr-4 py-4 bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 font-black text-slate-700 dark:text-slate-200 shadow-inner transition-all"
                      value={arpu} onChange={(e) => setArpu(Number(e.target.value))}
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Monthly Churn (%)</span>
                  <div className="flex items-center space-x-3 h-[52px]">
                    <input
                      type="range" min="0.5" max="25" step="0.1"
                      className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      value={churn} onChange={(e) => setChurn(Number(e.target.value))}
                    />
                    <span className="text-indigo-600 dark:text-indigo-400 font-black min-w-[3.5rem] text-lg">{churn}%</span>
                  </div>
                </label>
              </div>

              <label className="block p-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-3xl border border-emerald-100/50 dark:border-emerald-900/20">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-widest flex items-center">
                    <Target size={16} className="mr-2" /> Model Precision Impact
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-xl">{reduction}% Saving</span>
                </div>
                <input
                  type="range" min="1" max="50" step="1"
                  className="w-full h-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  value={reduction} onChange={(e) => setReduction(Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-900 dark:bg-slate-950 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                <TrendingUp size={140} />
              </div>
              <div className="relative z-10 space-y-10">
                <div>
                  <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Projected Annual Saved Revenue</p>
                  <p className="text-6xl font-black tracking-tighter text-indigo-50 leading-none">${results.yearlySavings.toLocaleString()}</p>
                  <p className="text-[10px] text-indigo-400 font-bold mt-2 uppercase">NTD • Fiscal Proj.</p>
                </div>

                <div className="grid grid-cols-2 gap-10 pt-10 border-t border-slate-800">
                  <div>
                    <div className="flex items-center text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">
                      <Users size={12} className="mr-2 text-indigo-400" /> Subs Saved
                    </div>
                    <p className="text-3xl font-black text-emerald-400">{results.usersSaved.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-500 font-bold">per billing cycle</p>
                  </div>
                  <div>
                    <div className="flex items-center text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">
                      <DollarSign size={12} className="mr-2 text-indigo-400" /> Revenue/Mo
                    </div>
                    <p className="text-3xl font-black text-indigo-100">${results.revenueSaved.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-500 font-bold">recovered monthly</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/40 dark:bg-slate-900/40 border border-white/60 dark:border-slate-800/60 p-8 rounded-[3rem] shadow-xl">
               <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-8 flex items-center space-x-2">
                  <ChartIcon size={14} className="text-indigo-600" />
                  <span>Before vs After Churn Impact</span>
               </h4>
               <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <XAxis dataKey="name" fontSize={10} fontWeight={900} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                      <Tooltip content={<CustomROITooltip />} cursor={{fill: 'transparent'}} />
                      <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={80}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList dataKey="value" position="top" fontSize={11} fontWeight={900} fill="#64748b" formatter={(val: number) => val.toLocaleString()} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROICalculator;
