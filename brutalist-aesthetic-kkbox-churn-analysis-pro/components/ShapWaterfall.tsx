
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { Zap, TrendingUp, TrendingDown } from 'lucide-react';

interface SHAPFactor {
  feature: string;
  value: number;
  contribution: number;
  description: string;
}

interface ShapWaterfallProps {
  riskFactors: SHAPFactor[];
  protectiveFactors: SHAPFactor[];
  baselineRisk?: number;
  finalRisk: number;
}

const ShapWaterfall: React.FC<ShapWaterfallProps> = ({
  riskFactors,
  protectiveFactors,
  baselineRisk = 4.7, // Base churn rate from dataset
  finalRisk,
}) => {
  // Combine all factors for the waterfall chart
  const allFactors = [
    ...riskFactors.map(f => ({ ...f, type: 'risk' as const })),
    ...protectiveFactors.map(f => ({ ...f, type: 'protective' as const })),
  ].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // Build waterfall data
  const waterfallData = [
    {
      feature: 'Base Rate',
      contribution: baselineRisk,
      displayContribution: baselineRisk,
      cumulative: baselineRisk,
      type: 'baseline' as const,
      description: 'Population average churn rate',
    },
    ...allFactors.map((f, i) => {
      const prev = i === 0 ? baselineRisk : 0;
      return {
        feature: f.feature.replace(/_/g, ' ').substring(0, 18),
        contribution: f.contribution * 100, // Convert to percentage points
        displayContribution: f.contribution * 100,
        cumulative: 0, // Will calculate below
        type: f.type,
        description: f.description,
        value: f.value,
      };
    }),
    {
      feature: 'Final Risk',
      contribution: finalRisk,
      displayContribution: finalRisk,
      cumulative: finalRisk,
      type: 'final' as const,
      description: 'Predicted churn probability',
    },
  ];

  // Calculate cumulative values
  let running = baselineRisk;
  for (let i = 1; i < waterfallData.length - 1; i++) {
    running += waterfallData[i].contribution;
    waterfallData[i].cumulative = Math.max(0, Math.min(100, running));
  }

  return (
    <div className="brutalist-border p-8 bg-white dark:bg-zinc-900 brutalist-shadow">
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b-2 border-black dark:border-white/20 pb-2 flex items-center dark:text-white">
        <Zap size={12} className="mr-2" /> SHAP Feature Contributions
      </h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={waterfallData}
            layout="vertical"
            margin={{ left: 10, right: 50, top: 10, bottom: 10 }}
          >
            <XAxis
              type="number"
              domain={[-20, Math.max(finalRisk + 10, 50)]}
              fontSize={9}
              fontWeight={900}
              tick={{ fill: 'currentColor' }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              dataKey="feature"
              type="category"
              width={120}
              fontSize={9}
              fontWeight={700}
              tick={{ fill: 'currentColor' }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '0',
                backgroundColor: '#fff',
                border: '2px solid black',
                fontSize: '10px',
                fontWeight: '700',
              }}
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-3 brutalist-border text-[10px]">
                    <p className="font-black uppercase mb-1">{data.feature}</p>
                    <p className="opacity-70 mb-2">{data.description}</p>
                    {data.value !== undefined && (
                      <p className="mb-1">Value: <span className="font-black">{typeof data.value === 'number' ? data.value.toFixed(2) : data.value}</span></p>
                    )}
                    <p>
                      Contribution:{' '}
                      <span className={`font-black ${data.type === 'risk' ? 'text-red-600' : data.type === 'protective' ? 'text-green-600' : ''}`}>
                        {data.type === 'baseline' || data.type === 'final'
                          ? `${data.contribution.toFixed(1)}%`
                          : `${data.contribution > 0 ? '+' : ''}${data.contribution.toFixed(1)}pp`}
                      </span>
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
            <Bar dataKey="displayContribution" stroke="#000" strokeWidth={1}>
              {waterfallData.map((entry, index) => {
                let fill = '#999';
                if (entry.type === 'baseline') fill = '#000';
                else if (entry.type === 'final') fill = finalRisk > 50 ? '#ff4d00' : '#000';
                else if (entry.type === 'risk') fill = '#ff4d00';
                else if (entry.type === 'protective') fill = '#22c55e';
                return <Cell key={index} fill={fill} />;
              })}
              <LabelList
                dataKey="displayContribution"
                position="right"
                fontSize={9}
                fontWeight={900}
                formatter={(v: number, entry: any) => {
                  const item = waterfallData.find(d => d.displayContribution === v);
                  if (!item) return '';
                  if (item.type === 'baseline' || item.type === 'final') {
                    return `${v.toFixed(1)}%`;
                  }
                  return v !== 0 ? `${v > 0 ? '+' : ''}${v.toFixed(1)}` : '';
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 mt-6 pt-4 border-t-2 border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#ff4d00] brutalist-border" />
          <span className="text-[9px] font-black uppercase dark:text-white">Increases Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#22c55e] brutalist-border" />
          <span className="text-[9px] font-black uppercase dark:text-white">Decreases Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-black brutalist-border" />
          <span className="text-[9px] font-black uppercase dark:text-white">Baseline / Final</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-light dark:bg-zinc-800 brutalist-border">
          <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Base Rate</p>
          <p className="text-xl font-black dark:text-white">{baselineRisk.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-brand/10 brutalist-border">
          <div className="flex items-center gap-1">
            <TrendingUp size={12} className="text-red-600" />
            <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Risk Factors</p>
          </div>
          <p className="text-xl font-black text-red-600">
            +{riskFactors.reduce((sum, f) => sum + f.contribution * 100, 0).toFixed(1)}pp
          </p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 brutalist-border">
          <div className="flex items-center gap-1">
            <TrendingDown size={12} className="text-green-600" />
            <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Protective</p>
          </div>
          <p className="text-xl font-black text-green-600">
            {protectiveFactors.reduce((sum, f) => sum + f.contribution * 100, 0).toFixed(1)}pp
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShapWaterfall;
