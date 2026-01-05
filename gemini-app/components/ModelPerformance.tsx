
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Info, Book, Target, Loader2 } from 'lucide-react';
import { useMetrics, useCalibration } from '../hooks/useApi';
import { useApp } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';
import { QueryErrorFallback } from './ui/ErrorBoundary';

const ModelPerformance: React.FC = () => {
  const { isDark } = useApp();

  const chartTextColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  // Use TanStack Query hooks for data fetching
  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useMetrics();

  const {
    data: calibration,
    isLoading: calibrationLoading,
    error: calibrationError,
    refetch: refetchCalibration
  } = useCalibration();

  const loading = metricsLoading || calibrationLoading;
  const error = metricsError || calibrationError;

  if (loading) {
    return (
      <div className="space-y-8 pb-12">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Skeleton className="h-[400px] w-full rounded-[2rem]" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}
              </div>
              <Skeleton className="h-64 rounded-[2.5rem]" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !metrics || !calibration) {
    const handleRetry = () => {
      refetchMetrics();
      refetchCalibration();
    };
    return (
      <QueryErrorFallback
        error={error || new Error('No data available')}
        onRetry={handleRetry}
        title="Failed to Load Performance Data"
      />
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Model Performance</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Quantifying predictive reliability and calibration quality.</p>
        </div>
      </div>

      <Card className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
        <CardHeader className="p-0 pb-6">
          <CardTitle className="text-2xl flex items-center space-x-3">
            <Target size={24} className="text-indigo-600" />
            <span>Reliability & Calibration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6 min-w-0">
            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/30 flex items-start space-x-4">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm shrink-0">
                <Info className="text-indigo-600" size={20} />
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                <p className="font-black text-indigo-950 dark:text-indigo-200 mb-1">What is Model Calibration?</p>
                <p>For a well-calibrated model, if we predict a 70% churn risk for 100 users, approximately 70 of them should actually churn. Without calibration, models often "over-confidence" or "under-confidence" predictions.</p>
              </div>
            </div>

            <div className="h-[400px] w-full border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 bg-white/40 dark:bg-slate-950/40 shadow-inner">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center mb-8">Reliability Diagram (Binned)</h4>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    label={{ value: 'Mean Predicted Risk', position: 'bottom', offset: 0, fontSize: 10, fontWeight: 900, fill: chartTextColor }}
                    type="number"
                    domain={[0, 1]}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tick={{fill: chartTextColor}}
                  />
                  <YAxis
                    label={{ value: 'Fraction of Positives', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 900, fill: chartTextColor }}
                    type="number"
                    domain={[0, 1]}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tick={{fill: chartTextColor}}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '20px',
                      backgroundColor: isDark ? '#0f172a' : '#fff',
                      border: 'none',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={48}
                    iconType="circle"
                    wrapperStyle={{fontSize: '11px', fontWeight: '900', color: chartTextColor}}
                  />
                  <Line name="Perfect Calibration" type="monotone" data={[{mean_predicted:0, fraction_of_positives:0}, {mean_predicted:1, fraction_of_positives:1}]} dataKey="fraction_of_positives" stroke={isDark ? '#334155' : '#cbd5e1'} strokeDasharray="5 5" dot={false} strokeWidth={1} />
                  <Line name="Uncalibrated (XGBoost)" type="monotone" data={calibration.uncalibrated} dataKey="fraction_of_positives" stroke="#ef4444" strokeWidth={3} dot={{ r: 6, fill: '#ef4444', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 8 }} />
                  <Line name="Calibrated (Isotonic)" type="monotone" data={calibration.calibrated} dataKey="fraction_of_positives" stroke="#10b981" strokeWidth={3} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Log Loss', val: metrics.log_loss.toFixed(4), color: 'text-indigo-600 dark:text-indigo-400', indicatorClass: 'bg-indigo-500', progress: Math.max(0, 100 - metrics.log_loss * 100) },
                { label: 'AUC Score', val: metrics.auc.toFixed(4), color: 'text-violet-600 dark:text-violet-400', indicatorClass: 'bg-violet-500', progress: metrics.auc * 100 },
                { label: 'ECE Error', val: metrics.ece?.toFixed(4) || 'N/A', color: 'text-emerald-600 dark:text-emerald-400', indicatorClass: 'bg-emerald-500', progress: metrics.ece ? Math.max(0, 100 - metrics.ece * 100) : 70 },
                { label: 'Brier Score', val: metrics.brier_score?.toFixed(4) || 'N/A', color: 'text-amber-600 dark:text-amber-400', indicatorClass: 'bg-amber-500', progress: metrics.brier_score ? Math.max(0, 100 - metrics.brier_score * 100) : 70 }
              ].map((m, i) => (
                <Card key={i} className="p-7 bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow group">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{m.label}</p>
                  <p className={`text-4xl font-black ${m.color} tracking-tighter`}>{m.val}</p>
                  <Progress value={m.progress} className="mt-4 h-1" indicatorClassName={m.indicatorClass} />
                </Card>
              ))}
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                  <Book size={20} />
                </div>
                <h4 className="font-black text-slate-900 dark:text-white text-xl tracking-tight">Understanding Brier Score</h4>
              </div>

              <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                <p className="font-medium">The <strong>Brier Score</strong> is the Mean Squared Error (MSE) applied to probability forecasts. It provides a comprehensive measure of both <span className="text-indigo-600 dark:text-indigo-400 font-black">Calibration</span> and <span className="text-indigo-600 dark:text-indigo-400 font-black">Refinement</span>.</p>

                <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-inner group">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Mathematical Formula</p>
                  <div className="font-mono text-lg text-indigo-900 dark:text-indigo-300 flex justify-center py-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                    BS = <span className="mx-2">1/N</span> <span className="mx-2">Σ</span> <span className="mx-2">(f<sub>t</sub> - o<sub>t</sub>)<sup>2</sup></span>
                  </div>
                  <div className="mt-4 flex justify-around text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>f<sub>t</sub> = Predicted Prob</span>
                    <span>o<sub>t</sub> = Outcome (0/1)</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-[0.2em]">Score Interpretation</h5>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { val: '0.00', lab: 'Perfect', bg: 'bg-emerald-50 dark:bg-emerald-900/20', col: 'text-emerald-600 dark:text-emerald-400' },
                      { val: '0.25', lab: 'Random', bg: 'bg-amber-50 dark:bg-amber-900/20', col: 'text-amber-600 dark:text-amber-400' },
                      { val: '1.00', lab: 'Failure', bg: 'bg-rose-50 dark:bg-rose-900/20', col: 'text-rose-600 dark:text-rose-400' }
                    ].map((item, i) => (
                      <div key={i} className={`p-4 ${item.bg} rounded-2xl border border-transparent text-center transition-all hover:scale-105`}>
                        <p className={`font-black text-lg ${item.col}`}>{item.val}</p>
                        <p className={`text-[8px] uppercase font-black opacity-60 ${item.col}`}>{item.lab}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl">
                   <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 leading-relaxed">
                     <span className="font-black">Significance:</span> Unlike AUC which only cares about ranking, Brier Score penalizes "confident but wrong" predictions, making it critical for financial projections.
                   </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModelPerformance;
