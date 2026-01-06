import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ZAxis } from 'recharts';
import { Zap } from 'lucide-react';
import { featureImportance } from '../data/realData';

interface BeeswarmPoint {
  feature: string;
  featureIndex: number;
  shapValue: number;
  featureValue: number;
  normalized: number;
  y: number;
}

// Generate synthetic SHAP beeswarm data based on feature importance
// In production, this would come from actual SHAP values
const generateBeeswarmData = (topN: number = 15): BeeswarmPoint[] => {
  const topFeatures = featureImportance.slice(0, topN);
  const points: BeeswarmPoint[] = [];

  topFeatures.forEach((feature, featureIndex) => {
    // Generate ~50 synthetic points per feature
    const numPoints = 50;
    for (let i = 0; i < numPoints; i++) {
      // SHAP values scaled by feature importance
      const baseShap = (Math.random() - 0.5) * feature.importance * 0.8;
      // Add some correlation between feature value and SHAP
      const featureValue = Math.random();
      const correlation = feature.category === 'transaction' ? 0.6 : 0.3;
      const shapValue = baseShap + (featureValue - 0.5) * correlation * feature.importance;

      // Add jitter for beeswarm effect
      const jitter = (Math.random() - 0.5) * 0.6;

      points.push({
        feature: feature.feature,
        featureIndex,
        shapValue: Math.max(-0.4, Math.min(0.4, shapValue)),
        featureValue,
        normalized: featureValue,
        y: featureIndex + jitter
      });
    }
  });

  return points;
};

// Color scale from blue (low) to red (high)
const getColor = (normalized: number): string => {
  // Blue (low) -> White (mid) -> Red (high)
  if (normalized < 0.5) {
    const t = normalized * 2;
    const r = Math.round(t * 200);
    const g = Math.round(t * 100);
    const b = Math.round(255 - t * 55);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = (normalized - 0.5) * 2;
    const r = Math.round(200 + t * 55);
    const g = Math.round(100 - t * 100);
    const b = Math.round(200 - t * 200);
    return `rgb(${r}, ${g}, ${b})`;
  }
};

const ShapBeeswarm: React.FC = () => {
  const topN = 15;
  const beeswarmData = useMemo(() => generateBeeswarmData(topN), []);

  const featureNames = useMemo(() =>
    featureImportance.slice(0, topN).map(f =>
      f.feature.replace(/_/g, ' ').substring(0, 20)
    ),
  []);

  return (
    <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
        <Zap size={10} className="mr-1" /> SHAP Summary (Beeswarm Plot)
      </h3>
      <p className="text-[9px] font-bold opacity-60 mb-6 dark:text-white">
        Each dot represents a sample. Color indicates feature value (blue=low, red=high).
        Position on X-axis shows impact on prediction.
      </p>

      <div className="h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: 150, right: 30, top: 10, bottom: 30 }}>
            <XAxis
              type="number"
              dataKey="shapValue"
              domain={[-0.4, 0.4]}
              tickFormatter={(v) => v.toFixed(1)}
              fontSize={9}
              fontWeight={700}
              label={{
                value: 'SHAP Value (impact on model output)',
                position: 'bottom',
                offset: 10,
                fontSize: 9,
                fontWeight: 700
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[-0.5, topN - 0.5]}
              ticks={Array.from({ length: topN }, (_, i) => i)}
              tickFormatter={(value) => featureNames[Math.round(value)] || ''}
              fontSize={9}
              fontWeight={700}
              width={140}
              axisLine={false}
              tickLine={false}
            />
            <ZAxis range={[20, 20]} />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const data = payload[0].payload as BeeswarmPoint;
                return (
                  <div className="bg-black text-white p-3 brutalist-border text-[10px]">
                    <p className="font-black uppercase">{data.feature.replace(/_/g, ' ')}</p>
                    <p className="mt-1">SHAP: <span className={data.shapValue > 0 ? 'text-red-400' : 'text-blue-400'}>
                      {data.shapValue > 0 ? '+' : ''}{data.shapValue.toFixed(3)}
                    </span></p>
                    <p>Feature Value: {data.featureValue.toFixed(2)}</p>
                  </div>
                );
              }}
            />
            <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
            <Scatter data={beeswarmData} shape="circle">
              {beeswarmData.map((point, index) => (
                <Cell
                  key={index}
                  fill={getColor(point.normalized)}
                  opacity={0.7}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Color legend */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <span className="text-[9px] font-black dark:text-white">Low</span>
        <div className="w-40 h-4 brutalist-border" style={{
          background: 'linear-gradient(to right, rgb(0, 0, 255), rgb(200, 100, 200), rgb(255, 0, 0))'
        }} />
        <span className="text-[9px] font-black dark:text-white">High</span>
        <span className="text-[9px] font-black opacity-50 dark:text-white ml-4">Feature Value</span>
      </div>

      {/* Interpretation guide */}
      <div className="mt-6 p-4 bg-light dark:bg-zinc-800 brutalist-border">
        <p className="text-[9px] font-bold dark:text-white">
          <span className="text-brand">How to read:</span> Points to the right (positive SHAP) increase churn risk.
          Red dots on the right mean high feature values increase risk.
          Blue dots on the right mean low feature values increase risk.
        </p>
      </div>
    </div>
  );
};

export default ShapBeeswarm;
