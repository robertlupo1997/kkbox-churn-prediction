
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell } from 'recharts';
import { Info, Book, Zap, TrendingUp } from 'lucide-react';
import { modelMetrics, calibrationCurves, bestModel, calibratedModels, datasetStats } from '../data/realData';
import EnsembleWeights from './EnsembleWeights';
import LiftGainsCurve from './LiftGainsCurve';
import PrecisionRecallCurve from './PrecisionRecallCurve';

const BrutalistCard = ({ children, title, className = "" }: { children?: React.ReactNode, title?: string, className?: string }) => (
  <div className={`brutalist-border p-8 bg-white dark:bg-zinc-900 hover:bg-light dark:hover:bg-zinc-800 transition-colors brutalist-shadow ${className}`}>
    {title && <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b-2 border-black dark:border-white/20 pb-2 flex items-center dark:text-white">
      <Zap size={10} className="mr-1 fill-black dark:fill-brand" /> {title}
    </h3>}
    {children}
  </div>
);

const ModelPerformance: React.FC = () => {
  const gridColor = 'rgba(0, 0, 0, 0.1)';

  // Transform data for bar chart comparison - sorted by AUC descending
  const comparisonData = [...modelMetrics]
    .sort((a, b) => b.auc - a.auc)
    .map(m => ({
      name: m.display_name,
      auc: m.auc,
      log_loss: m.log_loss,
      brier: m.brier,
    }));

  // Calibration improvement data for models that have it
  const calibrationImprovement = calibratedModels.map(m => ({
    name: m.display_name,
    before: m.log_loss,
    after: m.calibrated_log_loss,
    improvement: m.log_loss_improvement,
  }));

  // Top 4 models for metric cards
  const topModels = [...modelMetrics]
    .sort((a, b) => b.auc - a.auc)
    .slice(0, 4);

  return (
    <div className="space-y-12 pb-12">
      {/* Header */}
      <div className="max-w-3xl">
        <h2 className="text-6xl font-black tracking-tighter leading-none mb-4 uppercase dark:text-white">
          MODEL<br/><span className="text-brand">PERFORMANCE</span>
        </h2>
        <p className="text-[12px] font-black uppercase tracking-widest opacity-60 dark:text-white">
          Comparing {modelMetrics.length} models trained on {datasetStats.total_members.toLocaleString()} members
        </p>
      </div>

      {/* Best Model Highlight */}
      <div className="bg-brand p-8 brutalist-border brutalist-shadow">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-black text-white brutalist-border">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Best Performing Model</p>
            <p className="text-3xl md:text-4xl font-black">{bestModel.display_name} — AUC {bestModel.auc.toFixed(4)}</p>
          </div>
        </div>
      </div>

      {/* Model Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* AUC Comparison Bar Chart */}
        <BrutalistCard title="Model AUC Comparison">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  type="number"
                  domain={[0.8, 1]}
                  fontSize={9}
                  fontWeight={900}
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  fontSize={9}
                  fontWeight={900}
                  tick={{ fill: 'currentColor' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '0',
                    backgroundColor: '#fff',
                    border: '2px solid black',
                    fontSize: '10px',
                    fontWeight: '900',
                    textTransform: 'uppercase'
                  }}
                  formatter={(value: number) => [value.toFixed(4), 'AUC']}
                />
                <Bar dataKey="auc" stroke="#000" strokeWidth={1}>
                  {comparisonData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.name === bestModel.display_name ? '#ff4d00' : '#000'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BrutalistCard>

        {/* Calibration Before/After */}
        <BrutalistCard title="Calibration Impact (Log Loss)">
          <div className="bg-brand/10 p-4 brutalist-border mb-6 flex items-start space-x-3">
            <div className="p-2 bg-black text-white brutalist-border shrink-0">
              <Info size={14} />
            </div>
            <p className="text-[10px] font-bold uppercase leading-tight dark:text-white opacity-70">
              Lower log loss = better calibrated probabilities. Calibration reduced log loss by ~70%.
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calibrationImprovement} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="name"
                  fontSize={9}
                  fontWeight={900}
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis
                  domain={[0, 0.5]}
                  fontSize={9}
                  fontWeight={900}
                  tick={{ fill: 'currentColor' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '0',
                    backgroundColor: '#fff',
                    border: '2px solid black',
                    fontSize: '10px',
                    fontWeight: '900',
                    textTransform: 'uppercase'
                  }}
                  formatter={(value: number) => [value.toFixed(4), 'Log Loss']}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }}
                />
                <Bar dataKey="before" name="Before Calibration" fill="#000" stroke="#000" strokeWidth={1} />
                <Bar dataKey="after" name="After Calibration" fill="#ff4d00" stroke="#000" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BrutalistCard>
      </div>

      {/* Reliability Diagram */}
      <BrutalistCard title="Reliability Diagram (Calibration Curves)">
        <div className="bg-brand/10 p-4 brutalist-border mb-6 flex items-start space-x-3">
          <div className="p-2 bg-black text-white brutalist-border shrink-0">
            <Info size={14} />
          </div>
          <div className="text-[10px] font-bold uppercase leading-tight dark:text-white">
            <p className="mb-1">Statistical Integrity Note:</p>
            <p className="opacity-70">A perfectly calibrated model follows the diagonal. The stacked ensemble (orange) shows excellent calibration compared to raw XGBoost/LightGBM predictions.</p>
          </div>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                type="number"
                domain={[0, 1]}
                dataKey="mean_predicted"
                label={{ value: 'MEAN PREDICTED PROBABILITY', position: 'bottom', offset: 10, fontSize: 9, fontWeight: 900, fill: 'currentColor' }}
                fontSize={9}
                fontWeight={900}
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                type="number"
                domain={[0, 1]}
                label={{ value: 'FRACTION OF POSITIVES', angle: -90, position: 'insideLeft', fontSize: 9, fontWeight: 900, fill: 'currentColor' }}
                fontSize={9}
                fontWeight={900}
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '0',
                  backgroundColor: '#fff',
                  border: '2px solid black',
                  fontSize: '10px',
                  fontWeight: '900',
                  textTransform: 'uppercase'
                }}
              />
              <Legend
                verticalAlign="top"
                height={48}
                wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }}
              />
              {/* Perfect calibration line */}
              <Line
                name="Perfect Calibration"
                data={[{ mean_predicted: 0, fraction_of_positives: 0 }, { mean_predicted: 1, fraction_of_positives: 1 }]}
                dataKey="fraction_of_positives"
                stroke="#ccc"
                strokeDasharray="4 4"
                dot={false}
                strokeWidth={2}
              />
              {/* Model calibration curves */}
              {calibrationCurves.map((curve, idx) => (
                <Line
                  key={curve.model}
                  name={curve.model.toUpperCase()}
                  data={curve.points}
                  dataKey="fraction_of_positives"
                  stroke={idx === 2 ? '#ff4d00' : idx === 0 ? '#000' : '#666'}
                  strokeWidth={idx === 2 ? 3 : 2}
                  dot={{ r: 4, fill: idx === 2 ? '#ff4d00' : idx === 0 ? '#000' : '#666', stroke: '#000', strokeWidth: 1 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </BrutalistCard>

      {/* Model Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {topModels.map((m, i) => (
          <div key={i} className="p-6 bg-white dark:bg-zinc-900 brutalist-border brutalist-shadow group transition-all hover:bg-brand">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[9px] font-black text-black/50 dark:text-white/50 uppercase tracking-widest mb-1 group-hover:text-black">{m.display_name}</p>
                <p className="text-3xl font-black tracking-tighter group-hover:text-white dark:text-white">{m.auc.toFixed(3)}</p>
              </div>
              {i === 0 && (
                <div className="px-2 py-1 bg-brand text-black text-[8px] font-black uppercase brutalist-border group-hover:bg-black group-hover:text-brand">
                  Best
                </div>
              )}
            </div>
            <p className="text-[8px] font-black text-black/30 dark:text-white/30 uppercase group-hover:text-black">
              Log Loss: {m.log_loss.toFixed(3)} | Brier: {m.brier.toFixed(3)}
            </p>
          </div>
        ))}
      </div>

      {/* Statistical Insight Box */}
      <div className="bg-black text-white p-8 brutalist-border brutalist-shadow">
        <div className="flex items-center space-x-3 mb-6">
          <Book size={20} className="text-brand" />
          <h4 className="font-black uppercase text-sm tracking-widest">Statistical Insight</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-[11px] font-bold leading-relaxed opacity-80 uppercase mb-4">
              The stacked ensemble combines XGBoost, LightGBM, and CatBoost predictions using logistic regression meta-learner.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold leading-relaxed opacity-80 uppercase mb-4">
              Isotonic calibration improves probability estimates, reducing log loss by ~70% for gradient boosting models.
            </p>
          </div>
          <div className="p-4 border-2 border-white/20 font-mono text-center">
            <p className="text-brand text-lg">AUC = {bestModel.auc.toFixed(4)}</p>
            <p className="text-[9px] opacity-50 mt-2">BEST MODEL: {bestModel.display_name.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Ensemble Weights */}
      <EnsembleWeights />

      {/* Lift and Gains Curves */}
      <LiftGainsCurve />

      {/* Precision-Recall Curve with Threshold Selector */}
      <PrecisionRecallCurve />
    </div>
  );
};

export default ModelPerformance;
