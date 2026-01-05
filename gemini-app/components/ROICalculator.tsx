
import React, { useMemo } from 'react';
import { Calculator, TrendingUp, DollarSign, Users, Target, BarChart as ChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';

// Zod schema for form validation
const roiFormSchema = z.object({
  subs: z.number().min(10000).max(1000000),
  arpu: z.number().min(1).max(10000),
  churn: z.number().min(0.5).max(25),
  reduction: z.number().min(1).max(50)
});

type ROIFormData = z.infer<typeof roiFormSchema>;

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
  const { watch, setValue } = useForm<ROIFormData>({
    resolver: zodResolver(roiFormSchema),
    defaultValues: {
      subs: 100000,
      arpu: 149,
      churn: 5.5,
      reduction: 15
    }
  });

  const subs = watch('subs');
  const arpu = watch('arpu');
  const churn = watch('churn');
  const reduction = watch('reduction');

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

      <Card className="glass p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="space-y-8">
            <CardHeader className="p-0">
              <CardTitle className="text-2xl flex items-center space-x-3">
                 <Calculator className="text-indigo-600" />
                 <span>Simulated Parameters</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-8">
              <div className="block">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Total Subscriber Base</Label>
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-xl">{subs.toLocaleString()}</span>
                </div>
                <Slider
                  value={[subs]}
                  min={10000}
                  max={1000000}
                  step={10000}
                  onValueChange={(value) => setValue('subs', value[0])}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="block">
                  <Label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Monthly ARPU (NTD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 z-10" size={16} />
                    <Input
                      type="number"
                      className="w-full pl-10 pr-4 py-4 h-auto bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 font-black text-slate-700 dark:text-slate-200 shadow-inner"
                      value={arpu}
                      onChange={(e) => setValue('arpu', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="block">
                  <Label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Monthly Churn (%)</Label>
                  <div className="flex items-center space-x-3 h-[52px]">
                    <Slider
                      value={[churn]}
                      min={0.5}
                      max={25}
                      step={0.1}
                      onValueChange={(value) => setValue('churn', value[0])}
                      className="flex-1"
                    />
                    <span className="text-indigo-600 dark:text-indigo-400 font-black min-w-[3.5rem] text-lg">{churn}%</span>
                  </div>
                </div>
              </div>

              <Card className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-3xl border border-emerald-100/50 dark:border-emerald-900/20">
                <div className="flex justify-between items-center mb-4">
                  <Label className="text-sm font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-widest flex items-center">
                    <Target size={16} className="mr-2" /> Model Precision Impact
                  </Label>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-xl">{reduction}% Saving</span>
                </div>
                <Slider
                  value={[reduction]}
                  min={1}
                  max={50}
                  step={1}
                  onValueChange={(value) => setValue('reduction', value[0])}
                  className="w-full [&_[role=slider]]:bg-emerald-500"
                />
              </Card>
            </CardContent>
          </div>

          <div className="space-y-8">
            <Card className="bg-slate-900 dark:bg-slate-950 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group border-0">
              <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                <TrendingUp size={140} />
              </div>
              <CardContent className="p-0 relative z-10 space-y-10">
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
              </CardContent>
            </Card>

            <Card className="bg-white/40 dark:bg-slate-900/40 border border-white/60 dark:border-slate-800/60 p-8 rounded-[3rem] shadow-xl">
              <CardHeader className="p-0 pb-8">
                <CardTitle className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center space-x-2">
                  <ChartIcon size={14} className="text-indigo-600" />
                  <span>Before vs After Churn Impact</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-48 w-full">
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
              </CardContent>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ROICalculator;
