import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Area, ComposedChart } from 'recharts';
import { Zap, Sliders, Target, Users, TrendingUp } from 'lucide-react';
import { prCurveData, datasetStats } from '../data/realData';
import { useApp } from '../App';

const PrecisionRecallCurve: React.FC = () => {
  const { isDark } = useApp();
  const [threshold, setThreshold] = useState(0.5);

  // Theme-aware colors
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : '#e5e5e5';
  const textColor = isDark ? '#a1a1aa' : '#000000';
  const strokeColor = isDark ? '#ffffff' : '#000000';

  // At the top of the PR curve nothing is flagged correctly, so the contact
  // count is 0/0. Render an em dash rather than a number.
  const thousands = (v: number | null) => (v === null ? '—' : `${(v / 1000).toFixed(0)}K`);
  const dollarsK = (v: number | null) =>
    v === null ? '—' : `${v < 0 ? '-' : ''}$${Math.abs(v / 1000).toFixed(0)}K`;

  const metrics = useMemo(() => {
    // Find closest threshold in data
    const point = prCurveData.reduce((closest, p) =>
      Math.abs(p.threshold - threshold) < Math.abs(closest.threshold - threshold) ? p : closest
    );

    const totalMembers = datasetStats.total_members;
    const baseChurnRate = datasetStats.churn_rate / 100;
    const totalChurners = Math.round(totalMembers * baseChurnRate);

    // How many members get contacted at this threshold is not a guess. Precision
    // and recall pin it exactly:
    //
    //   true positives     = recall * total churners
    //   predicted positive = true positives / precision
    //
    // This used to read `Math.max(0.01, 1 - threshold) * 0.5`, which is not a
    // property of the curve, the model, or the data -- it is a line that slopes
    // the right way. At threshold 0.05 it claimed 47.5% of the population would
    // be contacted; the curve says 30.2%. Every dollar figure below was built on
    // that number.
    //
    // At the top of the curve precision and recall are both zero, so nothing was
    // flagged correctly and the identity is 0/0. That is reported as unknown
    // rather than filled in.
    const derivable = point.precision > 0 && point.recall > 0;
    const capturedChurners = Math.round(totalChurners * point.recall);
    const predictedPositive = derivable
      ? Math.round(capturedChurners / point.precision)
      : null;
    const truePositives = derivable ? capturedChurners : 0;

    // Cost-benefit analysis
    // These three are assumptions, not measurements. No campaign was run, so no
    // save rate was observed. See LIMITATIONS.md section 12.
    const costPerContact = 5; // $5 to contact a customer -- assumed
    const valuePerSave = 149; // $149 subscription value -- assumed
    const saveRate = 0.3; // 30% of contacted churners stay -- assumed, unmeasured
    const totalCost = derivable ? predictedPositive * costPerContact : null;
    const totalSaved = derivable
      ? Math.round(truePositives * saveRate * valuePerSave)
      : null;
    const netROI = derivable ? totalSaved - totalCost : null;

    return {
      ...point,
      predictedPositive,
      truePositives,
      capturedChurners,
      totalChurners,
      totalCost,
      totalSaved,
      netROI
    };
  }, [threshold]);

  // Add area under curve data
  const areaData = prCurveData.map(p => ({
    ...p,
    baseline: p.recall * (datasetStats.churn_rate / 100) // Random classifier baseline
  }));

  return (
    <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
        <Zap size={10} className="mr-1" /> Precision-Recall Tradeoff
      </h3>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* PR Curve Chart */}
        <div className="xl:col-span-2">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="recall"
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  fontSize={9}
                  fontWeight={700}
                  tick={{ fill: textColor }}
                  label={{
                    value: 'Recall (% of churners identified)',
                    position: 'bottom',
                    offset: 0,
                    fontSize: 9,
                    fontWeight: 700,
                    fill: textColor
                  }}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  fontSize={9}
                  fontWeight={700}
                  tick={{ fill: textColor }}
                  label={{
                    value: 'Precision',
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 9,
                    fontWeight: 700,
                    fill: textColor
                  }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${(value * 100).toFixed(1)}%`,
                    name === 'precision' ? 'Precision' : name === 'f1' ? 'F1 Score' : name
                  ]}
                  labelFormatter={(label) => `Recall: ${(label * 100).toFixed(0)}%`}
                  contentStyle={{
                    backgroundColor: isDark ? '#18181b' : '#000',
                    border: `2px solid ${strokeColor}`,
                    borderRadius: 0,
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 9, fontWeight: 700, color: textColor }}
                />
                {/* Area under PR curve */}
                <Area
                  type="monotone"
                  dataKey="precision"
                  fill="#ff4d00"
                  fillOpacity={0.1}
                  stroke="none"
                />
                {/* PR Curve */}
                <Line
                  name="Precision"
                  type="monotone"
                  dataKey="precision"
                  stroke="#ff4d00"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#ff4d00', stroke: strokeColor, strokeWidth: 1 }}
                  activeDot={{ r: 8 }}
                />
                {/* F1 Score */}
                <Line
                  name="F1 Score"
                  type="monotone"
                  dataKey="f1"
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                {/* Current threshold marker */}
                <ReferenceLine
                  x={metrics.recall}
                  stroke="#ff4d00"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Threshold labels below chart */}
          <div className="flex justify-between mt-2 px-4">
            {prCurveData.filter(p => p.threshold <= 0.7).map((p, i) => (
              <div
                key={i}
                className={`text-[8px] font-black cursor-pointer transition-all ${
                  Math.abs(p.threshold - threshold) < 0.05 ? 'text-brand scale-110' : 'opacity-50 dark:text-white'
                }`}
                onClick={() => setThreshold(p.threshold)}
              >
                T={p.threshold}
              </div>
            ))}
          </div>
        </div>

        {/* Threshold Controls & Metrics */}
        <div className="space-y-4">
          {/* Threshold Slider */}
          <div className="p-4 bg-brand brutalist-border">
            <div className="flex items-center gap-2 mb-3">
              <Sliders size={14} />
              <span className="text-[10px] font-black uppercase">Classification Threshold</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.7}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full h-6 appearance-none bg-white brutalist-border cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:h-6
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:bg-black
                [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <p className="text-4xl font-black mt-2">{threshold.toFixed(2)}</p>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 brutalist-border bg-light dark:bg-zinc-800">
              <div className="flex items-center gap-1 mb-1">
                <Target size={10} />
                <p className="text-[8px] font-black uppercase opacity-60 dark:text-white">Precision</p>
              </div>
              <p className="text-2xl font-black dark:text-white">{(metrics.precision * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 brutalist-border bg-light dark:bg-zinc-800">
              <div className="flex items-center gap-1 mb-1">
                <Users size={10} />
                <p className="text-[8px] font-black uppercase opacity-60 dark:text-white">Recall</p>
              </div>
              <p className="text-2xl font-black dark:text-white">{(metrics.recall * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 brutalist-border bg-light dark:bg-zinc-800">
              <p className="text-[8px] font-black uppercase opacity-60 dark:text-white">F1 Score</p>
              <p className="text-2xl font-black dark:text-white">{(metrics.f1 * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 brutalist-border bg-light dark:bg-zinc-800">
              <p className="text-[8px] font-black uppercase opacity-60 dark:text-white">To Contact</p>
              <p className="text-2xl font-black dark:text-white">{thousands(metrics.predictedPositive)}</p>
            </div>
          </div>

          {/* Business Impact */}
          <div className="p-4 brutalist-border bg-black text-white">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={12} />
              <span className="text-[9px] font-black uppercase">Illustrative Scenario ($5/Contact, $149/Save, 30% Save Rate)</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[9px] opacity-70">Churners Captured</span>
                <span className="text-[9px] font-black text-brand">{metrics.capturedChurners.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] opacity-70">Contact Cost</span>
                <span className="text-[9px] font-black">{dollarsK(metrics.totalCost === null ? null : -metrics.totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] opacity-70">Revenue Saved</span>
                <span className="text-[9px] font-black text-green-400">{metrics.totalSaved === null ? '—' : `+${(metrics.totalSaved / 1000).toFixed(0)}K`}</span>
              </div>
              <div className="border-t border-white/20 pt-2 flex justify-between">
                <span className="text-[9px] font-black">Net (Assumed)</span>
                <span className={`text-[9px] font-black ${
                  metrics.netROI === null ? '' : metrics.netROI > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {metrics.netROI === null
                    ? '—'
                    : `${metrics.netROI > 0 ? '+' : ''}${dollarsK(metrics.netROI).replace('-', '')}`}
                </span>
              </div>
            </div>
          </div>

          {/* Interpretation */}
          <p className="text-[9px] font-bold opacity-60 dark:text-white">
            At the nearest stored threshold to <span className="text-brand">{threshold.toFixed(2)}</span>, recorded recall is
            <span className="text-brand"> {(metrics.recall * 100).toFixed(0)}%</span> and recorded precision is
            <span className="text-brand"> {(metrics.precision * 100).toFixed(0)}%</span>. The contact count
            ({thousands(metrics.predictedPositive)}) is derived from those two exactly —
            recall × churners ÷ precision — not estimated. The dollar figures are not:
            $5 per contact, $149 per save, and a 30% save rate are assumptions. No campaign
            was run, so no save rate was measured. See LIMITATIONS.md §12.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrecisionRecallCurve;
