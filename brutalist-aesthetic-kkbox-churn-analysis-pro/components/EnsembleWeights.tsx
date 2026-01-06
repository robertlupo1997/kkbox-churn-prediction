
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { Layers, Zap } from 'lucide-react';
import { ensembleWeights } from '../data/realData';

const EnsembleWeights: React.FC = () => {
  const coefficients = ensembleWeights.coefficients;

  // Transform coefficients for bar chart
  const barData = Object.entries(coefficients).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    coefficient: value,
    fill: value > 0 ? '#ff4d00' : '#000',
  }));

  // Calculate absolute sum for relative contribution
  const totalAbs = Object.values(coefficients).reduce((sum, v) => sum + Math.abs(v), 0);

  return (
    <div className="brutalist-border p-8 bg-white dark:bg-zinc-900 brutalist-shadow">
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b-2 border-black dark:border-white/20 pb-2 flex items-center dark:text-white">
        <Layers size={12} className="mr-2" /> Stacked Ensemble Weights
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coefficient Bar Chart */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-4 dark:text-white">
            Meta-Learner Coefficients
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 50 }}>
                <XAxis
                  type="number"
                  domain={[-4, 6]}
                  fontSize={9}
                  fontWeight={900}
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={80}
                  fontSize={10}
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
                  formatter={(value: number) => [value.toFixed(2), 'Coefficient']}
                />
                <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
                <Bar dataKey="coefficient" stroke="#000" strokeWidth={2}>
                  {barData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="coefficient"
                    position="right"
                    fontSize={10}
                    fontWeight={900}
                    formatter={(v: number) => v.toFixed(2)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] font-bold opacity-60 mt-4 dark:text-white">
            Negative CatBoost coefficient indicates it provides complementary signal when combined with XGBoost and LightGBM.
          </p>
        </div>

        {/* Validation Results */}
        <div className="space-y-4">
          <div className="p-6 bg-brand brutalist-border">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Stacked Ensemble AUC</p>
            <p className="text-4xl font-black">{ensembleWeights.validation_results.stacked_ensemble_auc.toFixed(4)}</p>
            <p className="text-[8px] font-black uppercase opacity-50 mt-1">
              Log Loss: {ensembleWeights.validation_results.stacked_ensemble_logloss.toFixed(4)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 brutalist-border bg-light dark:bg-zinc-800">
              <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">XGBoost</p>
              <p className="text-lg font-black dark:text-white">{ensembleWeights.validation_results.xgboost_auc.toFixed(3)}</p>
            </div>
            <div className="p-4 brutalist-border bg-light dark:bg-zinc-800">
              <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">LightGBM</p>
              <p className="text-lg font-black dark:text-white">{ensembleWeights.validation_results.lightgbm_auc.toFixed(3)}</p>
            </div>
            <div className="p-4 brutalist-border bg-light dark:bg-zinc-800">
              <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">CatBoost</p>
              <p className="text-lg font-black dark:text-white">{ensembleWeights.validation_results.catboost_auc.toFixed(3)}</p>
            </div>
          </div>

          <div className="p-4 brutalist-border bg-light dark:bg-zinc-800">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Simple Average</p>
                <p className="text-lg font-black dark:text-white">{ensembleWeights.validation_results.simple_average_auc.toFixed(4)}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Cross-Val Folds</p>
                <p className="text-lg font-black dark:text-white">{ensembleWeights.n_folds}</p>
              </div>
            </div>
          </div>

          {/* Relative Contribution */}
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-50 dark:text-white">
              Relative Contribution (|coef|)
            </p>
            {barData.map((model, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[9px] font-black uppercase w-20 dark:text-white">{model.name}</span>
                <div className="flex-1 h-4 bg-light dark:bg-zinc-800 brutalist-border overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${(Math.abs(model.coefficient) / totalAbs) * 100}%`,
                      backgroundColor: model.fill,
                    }}
                  />
                </div>
                <span className="text-[9px] font-black w-12 text-right dark:text-white">
                  {((Math.abs(model.coefficient) / totalAbs) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnsembleWeights;
