
import React, { useState, useMemo } from 'react';
import { Calculator, TrendingUp, DollarSign, Users, Target, BarChart as ChartIcon, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

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
    { name: 'BASELINE', value: results.monthlyChurnCount, fill: '#000' },
    { name: 'OPTIMIZED', value: results.projectedChurnCount, fill: '#ff4d00' }
  ];

  return (
    <div className="space-y-12 pb-12">
      <div className="max-w-3xl">
        <h2 className="text-6xl font-black tracking-tighter leading-none mb-4 uppercase">
          ROI<br/><span className="text-brand">PROJECTION</span>
        </h2>
        <p className="text-[12px] font-black uppercase tracking-widest opacity-60">Modeling the financial impact of predictive retention strategies.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-10">
          <div className="p-8 bg-white brutalist-border brutalist-shadow space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b border-black pb-2 flex items-center">
              <Zap size={10} className="mr-1 fill-black" /> SIMULATION_CONTROLS
            </h3>

            <div className="space-y-10">
              <label className="block">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest">Subscriber Base</span>
                  <span className="text-2xl font-black font-mono">{subs.toLocaleString()}</span>
                </div>
                <input
                  type="range" min="10000" max="1000000" step="10000"
                  className="w-full h-6 appearance-none bg-light brutalist-border cursor-pointer accent-black"
                  value={subs} onChange={(e) => setSubs(Number(e.target.value))}
                />
              </label>

              <div className="grid grid-cols-2 gap-8">
                <label className="block">
                  <span className="text-[9px] font-black uppercase tracking-widest block mb-2 opacity-50">ARPU (NTD)</span>
                  <input
                    type="number"
                    className="w-full p-4 bg-white brutalist-border font-black text-lg outline-none focus:bg-brand focus:text-white transition-all"
                    value={arpu} onChange={(e) => setArpu(Number(e.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-black uppercase tracking-widest block mb-2 opacity-50">Churn Rate (%)</span>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range" min="0.5" max="25" step="0.1"
                      className="flex-1 h-6 appearance-none bg-light brutalist-border cursor-pointer accent-black"
                      value={churn} onChange={(e) => setChurn(Number(e.target.value))}
                    />
                    <span className="text-xl font-black font-mono w-16">{churn}%</span>
                  </div>
                </label>
              </div>

              <div className="p-6 bg-brand brutalist-border">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest flex items-center">
                    <Target size={14} className="mr-2" /> INTERVENTION_EFFICIENCY
                  </span>
                  <span className="text-2xl font-black font-mono">{reduction}%</span>
                </div>
                <input
                  type="range" min="1" max="50" step="1"
                  className="w-full h-6 appearance-none bg-white brutalist-border cursor-pointer accent-black"
                  value={reduction} onChange={(e) => setReduction(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-black text-white p-10 brutalist-border brutalist-shadow relative overflow-hidden">
            <div className="absolute top-[-20px] right-[-20px] opacity-10 rotate-12">
               <TrendingUp size={200} />
            </div>
            <div className="relative z-10 space-y-12">
              <div>
                <p className="text-brand text-[10px] font-black uppercase tracking-widest mb-4">Projected Annual Recovery</p>
                <p className="text-7xl font-black tracking-tighter leading-none">${results.yearlySavings.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/20">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">Users Saved / Mo</p>
                  <p className="text-3xl font-black text-brand">{results.usersSaved.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">Monthly Yield</p>
                  <p className="text-3xl font-black">${results.revenueSaved.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 brutalist-border brutalist-shadow h-[280px]">
             <h4 className="text-[9px] font-black uppercase tracking-widest mb-8 flex items-center space-x-2">
                <ChartIcon size={12} className="text-brand" />
                <span>Impact Comparison (Monthly Churns)</span>
             </h4>
             <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 0 }}>
                    <XAxis dataKey="name" fontSize={9} fontWeight={900} tickLine={false} axisLine={false} tick={{fill: '#000'}} />
                    <Bar dataKey="value" stroke="#000" strokeWidth={1}>
                      {chartData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                      <LabelList dataKey="value" position="top" fontSize={10} fontWeight={900} fill="#000" formatter={(val: number) => val.toLocaleString()} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROICalculator;
