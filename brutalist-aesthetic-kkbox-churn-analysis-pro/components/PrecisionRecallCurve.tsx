import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Area, ComposedChart } from 'recharts';
import { Zap, Sliders, Target, Users, TrendingUp } from 'lucide-react';
import { prCurveData, datasetStats } from '../data/realData';

const PrecisionRecallCurve: React.FC = () => {
  const [threshold, setThreshold] = useState(0.5);

  const metrics = useMemo(() => {
    // Find closest threshold in data
    const point = prCurveData.reduce((closest, p) =>
      Math.abs(p.threshold - threshold) < Math.abs(closest.threshold - threshold) ? p : closest
    );

    const totalMembers = datasetStats.total_members;
    const baseChurnRate = datasetStats.churn_rate / 100;
    const totalChurners = Math.round(totalMembers * baseChurnRate);

    // Estimate members flagged at this threshold
    // Higher threshold = fewer flagged
    const flagRate = Math.max(0.01, 1 - point.threshold) * 0.5;
    const predictedPositive = Math.round(totalMembers * flagRate);
    const truePositives = Math.round(predictedPositive * point.precision);
    const capturedChurners = Math.round(totalChurners * point.recall);

    // Cost-benefit analysis
    const costPerContact = 5; // $5 to contact a customer
    const valuePerSave = 149; // $149 subscription value
    const saveRate = 0.3; // 30% of contacted churners stay
    const totalCost = predictedPositive * costPerContact;
    const totalSaved = Math.round(truePositives * saveRate * valuePerSave);
    const netROI = totalSaved - totalCost;

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
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis
                  dataKey="recall"
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  fontSize={9}
                  fontWeight={700}
                  label={{
                    value: 'Recall (% of churners identified)',
                    position: 'bottom',
                    offset: 0,
                    fontSize: 9,
                    fontWeight: 700
                  }}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  fontSize={9}
                  fontWeight={700}
                  label={{
                    value: 'Precision',
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 9,
                    fontWeight: 700
                  }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${(value * 100).toFixed(1)}%`,
                    name === 'precision' ? 'Precision' : name === 'f1' ? 'F1 Score' : name
                  ]}
                  labelFormatter={(label) => `Recall: ${(label * 100).toFixed(0)}%`}
                  contentStyle={{
                    backgroundColor: '#000',
                    border: '2px solid #000',
                    borderRadius: 0,
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 9, fontWeight: 700 }}
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
                  dot={{ r: 5, fill: '#ff4d00', stroke: '#000', strokeWidth: 1 }}
                  activeDot={{ r: 8 }}
                />
                {/* F1 Score */}
                <Line
                  name="F1 Score"
                  type="monotone"
                  dataKey="f1"
                  stroke="#000"
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
              <p className="text-2xl font-black dark:text-white">{(metrics.predictedPositive / 1000).toFixed(0)}K</p>
            </div>
          </div>

          {/* Business Impact */}
          <div className="p-4 brutalist-border bg-black text-white">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={12} />
              <span className="text-[9px] font-black uppercase">Business Impact</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[9px] opacity-70">Churners Captured</span>
                <span className="text-[9px] font-black text-brand">{metrics.capturedChurners.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] opacity-70">Contact Cost</span>
                <span className="text-[9px] font-black">-${(metrics.totalCost / 1000).toFixed(0)}K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] opacity-70">Revenue Saved</span>
                <span className="text-[9px] font-black text-green-400">+${(metrics.totalSaved / 1000).toFixed(0)}K</span>
              </div>
              <div className="border-t border-white/20 pt-2 flex justify-between">
                <span className="text-[9px] font-black">Net ROI</span>
                <span className={`text-[9px] font-black ${metrics.netROI > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {metrics.netROI > 0 ? '+' : ''}${(metrics.netROI / 1000).toFixed(0)}K
                </span>
              </div>
            </div>
          </div>

          {/* Interpretation */}
          <p className="text-[9px] font-bold opacity-60 dark:text-white">
            At threshold <span className="text-brand">{threshold.toFixed(2)}</span>, contacting {(metrics.predictedPositive / 1000).toFixed(0)}K members
            captures <span className="text-brand">{(metrics.recall * 100).toFixed(0)}%</span> of churners
            with <span className="text-brand">{(metrics.precision * 100).toFixed(0)}%</span> accuracy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrecisionRecallCurve;
