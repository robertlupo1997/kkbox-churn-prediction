import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../App';
import type { ApiShapExplanation } from '../services/apiService';

/**
 * Per-member SHAP attribution, drawn in the units the model works in.
 *
 * The model's SHAP values are additive in LOG-ODDS, not in probability points:
 * `base_value + sum(shap_values) == logit(probability_explained)`, where
 * `probability_explained` is the model's PRE-calibration output the API ships
 * in the payload (the served risk_score is isotonic-calibrated -- a monotone
 * remap, not the identity). Reconciles to within 1e-6 on the real path. An
 * earlier version of this chart multiplied contributions by 100 and labelled
 * them "pp", which is not a conversion -- it is a different quantity.
 *
 * Only the strongest contributors get their own bar. Everything else is summed
 * into one "all other features" bar so the waterfall still adds up to the
 * log-odds it explains.
 *
 * The caller must have passed `checkShapReconciles` before rendering this. An
 * explanation that does not sum to the probability it names is not drawn at
 * all.
 */

interface ShapWaterfallProps {
  explanation: ApiShapExplanation;
  /** The pre-calibration probability this attribution explains, in [0, 1]. */
  finalScore: number;
}

const logit = (p: number): number => {
  const clamped = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
  return Math.log(clamped / (1 - clamped));
};

const prettyFeature = (name: string): string => name.replace(/_/g, ' ');

const ShapWaterfall: React.FC<ShapWaterfallProps> = ({ explanation, finalScore }) => {
  const { isDark } = useApp();

  const textColor = isDark ? '#a1a1aa' : '#000000';
  const strokeColor = isDark ? '#ffffff' : '#000000';
  const secondaryColor = isDark ? '#71717a' : '#666666';
  const tooltipBg = isDark ? '#18181b' : '#ffffff';
  const baselineFinalColor = isDark ? '#ffffff' : '#000000';
  const neutralColor = isDark ? '#71717a' : '#999999';

  const named = [
    ...explanation.top_risk_factors.map(f => ({ ...f, type: 'risk' as const })),
    ...explanation.top_protective_factors.map(f => ({ ...f, type: 'protective' as const })),
  ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const namedKeys = new Set(named.map(f => f.feature));
  const otherImpact = Object.entries(explanation.shap_values)
    .filter(([feature]) => !namedKeys.has(feature))
    .reduce((sum: number, [, impact]) => sum + Number(impact), 0);

  const finalLogOdds = logit(finalScore);
  const reconstructed =
    explanation.base_value + named.reduce((s, f) => s + f.impact, 0) + otherImpact;
  /** How far the drawn bars land from the served score, in log-odds. */
  const residual = Math.abs(finalLogOdds - reconstructed);

  const rows = [
    {
      feature: 'base value',
      contribution: explanation.base_value,
      type: 'baseline' as const,
      description: 'Model output before any feature is taken into account',
    },
    ...named.map(f => ({
      feature: prettyFeature(f.feature),
      contribution: f.impact,
      type: f.type,
      description: `SHAP contribution for ${f.feature}`,
    })),
    {
      feature: `all other features (${Object.keys(explanation.shap_values).length - named.length})`,
      contribution: otherImpact,
      type: 'other' as const,
      description: 'Every feature not shown individually, summed',
    },
    {
      feature: 'final (log-odds)',
      contribution: finalLogOdds,
      type: 'final' as const,
      description: `Equals logit(${(finalScore * 100).toFixed(2)}%)`,
    },
  ];

  const magnitudes = rows.map(r => r.contribution);
  const axisMax = Math.max(...magnitudes, 0) * 1.15 + 0.2;
  const axisMin = Math.min(...magnitudes, 0) * 1.15 - 0.2;

  const riskTotal = explanation.top_risk_factors.reduce((s, f) => s + f.impact, 0);
  const protectiveTotal = explanation.top_protective_factors.reduce((s, f) => s + f.impact, 0);

  return (
    <div className="brutalist-border p-8 bg-white dark:bg-zinc-900 brutalist-shadow">
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b-2 border-black dark:border-white/20 pb-2 flex items-center dark:text-white">
        <Zap size={12} className="mr-2" /> Feature contributions (SHAP, log-odds)
      </h3>
      <p className="text-[9px] font-bold opacity-60 mb-6 dark:text-white">
        Real SHAP values for this member, served by the model — they explain the
        uncalibrated model output shown as the final bar, not the calibrated score above.{' '}
        {explanation.is_approximate
          ? 'The API reports these as approximate.'
          : 'The API reports these as exact.'}{' '}
        Contributions are in log-odds, the units the model is additive in — they do not convert
        to percentage points. Base value plus every bar equals the final log-odds
        {` — they reconcile to within ${Math.max(residual, 1e-6).toExponential(0)}.`}
      </p>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 10, right: 60, top: 10, bottom: 10 }}>
            <XAxis
              type="number"
              domain={[axisMin, axisMax]}
              fontSize={9}
              fontWeight={900}
              tick={{ fill: textColor }}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <YAxis
              dataKey="feature"
              type="category"
              width={150}
              fontSize={9}
              fontWeight={700}
              tick={{ fill: textColor }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '0',
                backgroundColor: tooltipBg,
                border: `2px solid ${strokeColor}`,
                fontSize: '10px',
                fontWeight: '700',
                color: textColor,
              }}
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-zinc-900 p-3 brutalist-border text-[10px] dark:text-white">
                    <p className="font-black uppercase mb-1">{data.feature}</p>
                    <p className="opacity-70 mb-2">{data.description}</p>
                    <p>
                      {data.type === 'baseline' || data.type === 'final' ? 'Log-odds: ' : 'Contribution: '}
                      <span
                        className={`font-black ${
                          data.type === 'risk'
                            ? 'text-red-600'
                            : data.type === 'protective'
                              ? 'text-green-600'
                              : ''
                        }`}
                      >
                        {data.contribution > 0 && data.type !== 'baseline' && data.type !== 'final'
                          ? '+'
                          : ''}
                        {data.contribution.toFixed(3)}
                      </span>
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine x={0} stroke={secondaryColor} strokeDasharray="3 3" />
            <Bar dataKey="contribution" stroke={strokeColor} strokeWidth={1}>
              {rows.map((entry, index) => {
                let fill = neutralColor;
                if (entry.type === 'baseline' || entry.type === 'final') fill = baselineFinalColor;
                else if (entry.type === 'risk') fill = '#ff4d00';
                else if (entry.type === 'protective') fill = '#22c55e';
                return <Cell key={index} fill={fill} />;
              })}
              <LabelList
                dataKey="contribution"
                position="right"
                fontSize={9}
                fontWeight={900}
                fill={textColor}
                formatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-6 mt-6 pt-4 border-t-2 border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#ff4d00] brutalist-border" />
          <span className="text-[9px] font-black uppercase dark:text-white">Increases risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#22c55e] brutalist-border" />
          <span className="text-[9px] font-black uppercase dark:text-white">Decreases risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-black dark:bg-white brutalist-border" />
          <span className="text-[9px] font-black uppercase dark:text-white">Base / final</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-light dark:bg-zinc-800 brutalist-border">
          <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Base value</p>
          <p className="text-xl font-black dark:text-white">{explanation.base_value.toFixed(3)}</p>
        </div>
        <div className="p-4 bg-brand/10 brutalist-border">
          <div className="flex items-center gap-1">
            <TrendingUp size={12} className="text-red-600" />
            <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Top risk factors</p>
          </div>
          <p className="text-xl font-black text-red-600">+{riskTotal.toFixed(3)}</p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 brutalist-border">
          <div className="flex items-center gap-1">
            <TrendingDown size={12} className="text-green-600" />
            <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Top protective</p>
          </div>
          <p className="text-xl font-black text-green-600">{protectiveTotal.toFixed(3)}</p>
        </div>
      </div>
    </div>
  );
};

export default ShapWaterfall;
