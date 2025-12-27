import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ShapValue {
  feature: string;
  impact: number;
}

interface ShapWaterfallProps {
  riskFactors: ShapValue[];
  protectiveFactors: ShapValue[];
  baseValue: number;
  prediction: number;
}

const ShapWaterfall: React.FC<ShapWaterfallProps> = ({
  riskFactors,
  protectiveFactors,
  baseValue,
  prediction
}) => {
  // Combine and sort by absolute impact
  const allFactors = [
    ...riskFactors.map(f => ({ ...f, type: 'risk' as const })),
    ...protectiveFactors.map(f => ({ ...f, type: 'protective' as const }))
  ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 8);

  // Format feature names for display
  const formatFeature = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/(\d+)d$/, ' ($1d)')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const chartData = allFactors.map(f => ({
    name: formatFeature(f.feature),
    value: f.impact,
    fill: f.impact > 0 ? '#ef4444' : '#10b981'
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
        <span>Base Rate: {(baseValue * 100).toFixed(1)}%</span>
        <span>→ Prediction: {(prediction * 100).toFixed(1)}%</span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <XAxis type="number" domain={['auto', 'auto']} tickFormatter={(v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} width={95} />
            <Tooltip
              formatter={(value: number) => [`${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`, 'Impact']}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="flex items-center space-x-2">
          <TrendingUp className="text-rose-500" size={14} />
          <span className="text-slate-600 dark:text-slate-400">Increases churn risk</span>
        </div>
        <div className="flex items-center space-x-2">
          <TrendingDown className="text-emerald-500" size={14} />
          <span className="text-slate-600 dark:text-slate-400">Decreases churn risk</span>
        </div>
      </div>
    </div>
  );
};

export default ShapWaterfall;
