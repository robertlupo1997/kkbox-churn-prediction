
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';
import { TrendingUp, Zap, Target } from 'lucide-react';
import { liftGainsData } from '../data/realData';
import { useApp } from '../App';

const LiftGainsCurve: React.FC = () => {
  const { isDark } = useApp();
  const { lift: liftData, gains: gainsData } = liftGainsData;

  // Theme-aware colors
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textColor = isDark ? '#a1a1aa' : '#000000';
  const strokeColor = isDark ? '#ffffff' : '#000000';
  const secondaryColor = isDark ? '#71717a' : '#666666';
  const tertiaryColor = isDark ? '#52525b' : '#cccccc';
  const tooltipBg = isDark ? '#18181b' : '#ffffff';

  // Add random baseline for gains chart
  const gainsWithBaseline = gainsData.map(d => ({
    ...d,
    random: d.percentContacted,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Cumulative Gains Chart */}
      <div className="brutalist-border p-8 bg-white dark:bg-zinc-900 brutalist-shadow">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b-2 border-black dark:border-white/20 pb-2 flex items-center dark:text-white">
          <Target size={12} className="mr-2" /> Cumulative Gains Curve
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={gainsWithBaseline} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="percentContacted"
                label={{ value: '% POPULATION CONTACTED', position: 'bottom', offset: 10, fontSize: 9, fontWeight: 900, fill: textColor }}
                fontSize={9}
                fontWeight={900}
                tick={{ fill: textColor }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                domain={[0, 100]}
                label={{ value: '% CHURNERS CAPTURED', angle: -90, position: 'insideLeft', fontSize: 9, fontWeight: 900, fill: textColor }}
                fontSize={9}
                fontWeight={900}
                tick={{ fill: textColor }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '0',
                  backgroundColor: tooltipBg,
                  border: `2px solid ${strokeColor}`,
                  fontSize: '10px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  color: textColor
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  name === 'percentCaptured' ? 'Model' : 'Random'
                ]}
                labelFormatter={(label) => `Top ${label}% Contacted`}
              />
              {/* Random baseline */}
              <Area
                type="linear"
                dataKey="random"
                stroke={tertiaryColor}
                strokeDasharray="4 4"
                fill="none"
                name="Random"
              />
              {/* Model performance */}
              <Area
                type="monotone"
                dataKey="percentCaptured"
                stroke="#ff4d00"
                strokeWidth={3}
                fill="#ff4d00"
                fillOpacity={0.1}
                name="Model"
                dot={{ r: 4, fill: '#ff4d00', stroke: strokeColor, strokeWidth: 1 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 p-4 bg-brand/10 brutalist-border">
          <p className="text-[10px] font-black uppercase dark:text-white">
            <span className="text-brand">Top 20%</span> of risky customers captures <span className="text-brand">95%</span> of actual churners — <span className="text-brand">4.75x</span> better than random.
          </p>
        </div>
      </div>

      {/* Lift Chart */}
      <div className="brutalist-border p-8 bg-white dark:bg-zinc-900 brutalist-shadow">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b-2 border-black dark:border-white/20 pb-2 flex items-center dark:text-white">
          <TrendingUp size={12} className="mr-2" /> Lift Chart
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={liftData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="percentile"
                label={{ value: 'DECILE (TOP %)', position: 'bottom', offset: 10, fontSize: 9, fontWeight: 900, fill: textColor }}
                fontSize={9}
                fontWeight={900}
                tick={{ fill: textColor }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                domain={[0, 10]}
                label={{ value: 'LIFT FACTOR', angle: -90, position: 'insideLeft', fontSize: 9, fontWeight: 900, fill: textColor }}
                fontSize={9}
                fontWeight={900}
                tick={{ fill: textColor }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '0',
                  backgroundColor: tooltipBg,
                  border: `2px solid ${strokeColor}`,
                  fontSize: '10px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  color: textColor
                }}
                formatter={(value: number) => [`${value.toFixed(2)}x`, 'Lift']}
                labelFormatter={(label) => `Top ${label}%`}
              />
              <ReferenceLine y={1} stroke={secondaryColor} strokeDasharray="4 4" label={{ value: 'Random', fontSize: 9, fill: secondaryColor }} />
              <Line
                type="monotone"
                dataKey="lift"
                stroke={strokeColor}
                strokeWidth={3}
                dot={{ r: 5, fill: '#ff4d00', stroke: strokeColor, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 p-4 bg-black text-white brutalist-border">
          <p className="text-[10px] font-black uppercase">
            Top decile has <span className="text-brand">7.46x</span> higher churn concentration than random selection.
          </p>
        </div>
      </div>

      {/* Business Impact Summary */}
      <div className="lg:col-span-2 brutalist-border p-8 bg-black text-white brutalist-shadow">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center">
          <Zap size={12} className="mr-2 text-brand" /> Business Impact Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border-2 border-white/20">
            <p className="text-[9px] font-black uppercase opacity-50">Contact Top 10%</p>
            <p className="text-2xl font-black text-brand">74.6%</p>
            <p className="text-[8px] font-black uppercase opacity-30">Churners Captured</p>
          </div>
          <div className="p-4 border-2 border-white/20">
            <p className="text-[9px] font-black uppercase opacity-50">Contact Top 20%</p>
            <p className="text-2xl font-black text-brand">95.0%</p>
            <p className="text-[8px] font-black uppercase opacity-30">Churners Captured</p>
          </div>
          <div className="p-4 border-2 border-white/20">
            <p className="text-[9px] font-black uppercase opacity-50">Top Decile Lift</p>
            <p className="text-2xl font-black text-brand">7.46x</p>
            <p className="text-[8px] font-black uppercase opacity-30">vs Random</p>
          </div>
          <div className="p-4 border-2 border-white/20">
            <p className="text-[9px] font-black uppercase opacity-50">Contacts Avoided</p>
            <p className="text-2xl font-black text-brand">20%</p>
            <p className="text-[8px] font-black uppercase opacity-30">100% Capture At Top 80%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiftGainsCurve;
