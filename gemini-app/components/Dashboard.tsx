
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, AlertTriangle, Activity, DollarSign, ArrowUpRight, ArrowDownRight, Download, X, Search, Filter, Info, ChevronRight, Loader2 } from 'lucide-react';
import { fetchMembers } from '../services/backendService';
import { Member } from '../types';
import { useApp } from '../App';

const COLORS = ['#6366f1', '#f59e0b', '#ef4444'];

const KPI_CARDS = [
  { label: 'Total Subscribers', value: '1,245,000', icon: <Users className="text-indigo-600" />, trend: '+2.4%', isPositive: true },
  { label: 'High Risk Users', value: '42,400', icon: <AlertTriangle className="text-amber-600" />, trend: '+1.2%', isPositive: false },
  { label: 'Avg Risk Score', value: '24.5%', icon: <Activity className="text-violet-600" />, trend: '-0.5%', isPositive: true },
  { label: 'Revenue at Risk', value: '$6.32M', icon: <DollarSign className="text-emerald-600" />, trend: '+3.1%', isPositive: false },
];

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass p-4 rounded-2xl shadow-2xl border-indigo-100 dark:border-indigo-900 animate-in fade-in zoom-in duration-200">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <p className="text-sm font-black text-indigo-900 dark:text-indigo-100">
            {payload[0].value.toLocaleString()} {unit || 'Members'}
          </p>
        </div>
        <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-2 italic">Representing {((payload[0].value / 1245000) * 100).toFixed(2)}% of total base</p>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC = () => {
  const { isDark } = useApp();
  const [selectedRange, setSelectedRange] = useState<{range: string, min: number, max: number} | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalMembers, setTotalMembers] = useState(0);

  const chartTextColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  // Load members from API on mount
  useEffect(() => {
    const loadMembers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchMembers({ limit: 1000 });
        setMembers(response.members);
        setTotalMembers(response.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load members');
        console.error('Failed to load members:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, []);

  const exportToCSV = () => {
    const highRiskMembers = members.filter(m => m.risk_score > 0.70);
    const headers = ["msno", "risk_score", "risk_tier", "action_recommendation"];
    const csvContent = [
      headers.join(","),
      ...highRiskMembers.map(m => [
        m.msno,
        m.risk_score,
        m.risk_tier,
        m.action_recommendation
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `kkbox_high_risk_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      setSelectedRange({ range: payload.range, min: payload.min, max: payload.max });
    }
  };

  const handlePieClick = (data: any) => {
    if (data && data.name) {
      setSelectedTier(data.name === selectedTier ? null : data.name);
    }
  };

  const filteredRangeMembers = selectedRange
    ? members.filter(m => m.risk_score * 100 >= selectedRange.min && m.risk_score * 100 < selectedRange.max)
    : [];

  const priorityMembers = useMemo(() => {
    let filtered = members.filter(m => m.risk_score > 0.40); // Show Medium and High risk
    if (selectedTier) {
      filtered = members.filter(m => m.risk_tier === selectedTier.split(' ')[0]);
    }
    return filtered.slice(0, 50); // Limit to 50 for performance
  }, [members, selectedTier]);

  // Calculate risk distribution from real data
  const riskDistData = useMemo(() => {
    const bins = [
      { range: '0-10%', count: 0, min: 0, max: 10 },
      { range: '10-20%', count: 0, min: 10, max: 20 },
      { range: '20-30%', count: 0, min: 20, max: 30 },
      { range: '30-40%', count: 0, min: 30, max: 40 },
      { range: '40-50%', count: 0, min: 40, max: 50 },
      { range: '50-60%', count: 0, min: 50, max: 60 },
      { range: '60-70%', count: 0, min: 60, max: 70 },
      { range: '70-80%', count: 0, min: 70, max: 80 },
      { range: '80-90%', count: 0, min: 80, max: 90 },
      { range: '90-100%', count: 0, min: 90, max: 100 },
    ];

    members.forEach(m => {
      const score = m.risk_score * 100;
      const binIndex = Math.min(Math.floor(score / 10), 9);
      bins[binIndex].count++;
    });

    return bins;
  }, [members]);

  // Calculate pie data from real members
  const pieData = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0 };
    members.forEach(m => {
      counts[m.risk_tier]++;
    });
    const total = members.length || 1;
    return [
      { name: 'Low Risk', value: Math.round((counts.Low / total) * 100) },
      { name: 'Medium Risk', value: Math.round((counts.Medium / total) * 100) },
      { name: 'High Risk', value: Math.round((counts.High / total) * 100) },
    ];
  }, [members]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 size={48} className="animate-spin text-indigo-600" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass p-10 rounded-[2.5rem] shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-4">
          <AlertTriangle size={48} className="text-rose-500" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Failed to Load Data</h3>
          <p className="text-slate-500 dark:text-slate-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Executive Dashboard</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Real-time subscription health & risk distribution metrics.</p>
        </div>
        <div className="flex items-center space-x-2 bg-indigo-50 dark:bg-slate-900 p-1 rounded-xl border border-indigo-100 dark:border-slate-800">
          <button className="px-4 py-2 bg-white dark:bg-slate-800 shadow-sm rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400">30 Days</button>
          <button className="px-4 py-2 text-xs font-bold text-slate-400">Quarterly</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {KPI_CARDS.map((card, idx) => (
          <div key={idx} className="glass p-7 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-6">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                {card.icon}
              </div>
              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] font-black ${card.isPositive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                {card.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span>{card.trend}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-1">{card.label}</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none min-w-0">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Risk Distribution</h3>
              <Info size={14} className="text-slate-300 dark:text-slate-600 cursor-help" />
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Interactive Explorer</div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={riskDistData} onClick={handleBarClick}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="range" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} tick={{fill: chartTextColor}} />
                <YAxis fontSize={10} fontWeight={700} tickLine={false} axisLine={false} tick={{fill: chartTextColor}} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(99, 102, 241, 0.05)' }} />
                <Bar 
                  dataKey="count" 
                  fill="url(#barGradient)" 
                  radius={[8, 8, 0, 0]} 
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none min-w-0">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Risk Tiers</h3>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Click to Filter Table</div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  onClick={handlePieClick}
                  className="cursor-pointer"
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      opacity={selectedTier && entry.name !== selectedTier ? 0.3 : 1}
                      stroke={entry.name === selectedTier ? '#4f46e5' : 'none'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip unit="%" />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle" 
                  wrapperStyle={{paddingTop: '20px', fontSize: '12px', fontWeight: '700', color: chartTextColor}} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {selectedRange && (
        <div className="glass p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none animate-in fade-in zoom-in duration-500">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Filter size={20} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Range Explorer: <span className="text-indigo-600">{selectedRange.range}</span>
              </h3>
            </div>
            <button 
              onClick={() => setSelectedRange(null)}
              className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400"
            >
              <X size={24} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredRangeMembers.length > 0 ? filteredRangeMembers.map(m => (
              <div key={m.msno} className="p-6 bg-white/60 dark:bg-slate-800/60 rounded-[2rem] border border-white/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start mb-4">
                  <div className="font-mono text-[10px] text-slate-400 font-bold">{m.msno}</div>
                  <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${m.risk_tier === 'High' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : m.risk_tier === 'Medium' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                    {m.risk_tier}
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{(m.risk_score * 100).toFixed(1)}%</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Score</p>
                </div>
              </div>
            )) : (
              <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <Search size={40} className="text-slate-200 dark:text-slate-800 mb-4" />
                <p className="text-slate-400 dark:text-slate-600 font-bold italic text-sm">No sample members match this bucket.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        <div className="px-8 py-8 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100/50 dark:border-slate-800/50">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Intervention List</h3>
              {selectedTier && (
                <span className="flex items-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Filtered: {selectedTier}
                  <button onClick={() => setSelectedTier(null)} className="ml-2 hover:text-rose-500"><X size={12} /></button>
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Prioritized subscribers for churn prevention efforts.</p>
          </div>
          <div className="flex space-x-3 mt-4 md:mt-0">
            <button 
              onClick={exportToCSV}
              className="flex items-center space-x-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button className="px-8 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95">
              Contact CRM
            </button>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="px-8 py-5">User ID</th>
                <th className="px-8 py-5">Risk Score</th>
                <th className="px-8 py-5">Risk Tier</th>
                <th className="px-8 py-5">Recommendation</th>
                <th className="px-8 py-5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {priorityMembers.map((member) => (
                <tr key={member.msno} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                  <td className="px-8 py-6 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">{member.msno}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3">
                      <span className={`text-sm font-black ${member.risk_score > 0.70 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{(member.risk_score * 100).toFixed(1)}%</span>
                      <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${member.risk_score > 0.70 ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-amber-400 to-amber-600'}`} style={{ width: `${member.risk_score * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${member.risk_tier === 'High' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : member.risk_tier === 'Medium' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                      {member.risk_tier}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs text-slate-700 dark:text-slate-300">{member.action_recommendation.substring(0, 50)}...</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button className="text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase group-hover:translate-x-1 transition-transform flex items-center justify-end ml-auto">
                      View <ChevronRight size={12} className="ml-1" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
