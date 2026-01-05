import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, AlertTriangle, Activity, DollarSign, ArrowUpRight, ArrowDownRight, Download, X, Search, Filter, Info, ChevronRight, Loader2 } from 'lucide-react';
import { useMembers } from '../hooks/useApi';
import type { Member } from '../types';
import { useApp } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Progress } from './ui/progress';
import { QueryErrorFallback } from './ui/ErrorBoundary';

const COLORS = ['#6366f1', '#f59e0b', '#ef4444'];

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

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend: string;
  isPositive: boolean;
  loading?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, icon, trend, isPositive, loading }) => {
  if (loading) {
    return (
      <Card className="glass p-7 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-8 w-32" />
      </Card>
    );
  }

  return (
    <Card className="glass p-7 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none hover:-translate-y-1 transition-all duration-300 group border-0">
      <div className="flex items-center justify-between mb-6">
        <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-500">
          {icon}
        </div>
        <Badge variant={isPositive ? "low" : "high"} className="text-[10px] font-black flex items-center gap-1">
          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend}
        </Badge>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const { isDark } = useApp();
  const [selectedRange, setSelectedRange] = useState<{range: string, min: number, max: number} | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const chartTextColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  // Load members from API using TanStack Query
  const { data: membersResponse, isLoading: loading, error, refetch } = useMembers({ limit: 1000 });
  const members = membersResponse?.members ?? [];
  const totalMembers = membersResponse?.total ?? 0;

  // Calculate KPI values from real data
  const kpiData = useMemo(() => {
    if (!members.length) return null;

    const highRiskCount = members.filter(m => m.risk_tier === 'High').length;
    const avgRiskScore = members.reduce((sum, m) => sum + m.risk_score, 0) / members.length;
    const revenueAtRisk = highRiskCount * 149; // ARPU = 149 NTD

    return {
      total: totalMembers.toLocaleString(),
      highRisk: highRiskCount.toLocaleString(),
      avgRisk: `${(avgRiskScore * 100).toFixed(1)}%`,
      revenueAtRisk: `$${revenueAtRisk.toLocaleString()}`
    };
  }, [members, totalMembers]);

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

  if (error) {
    return (
      <QueryErrorFallback
        error={error}
        onRetry={() => refetch()}
        title="Failed to Load Dashboard Data"
      />
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
          <Button variant="secondary" size="sm" className="shadow-sm">30 Days</Button>
          <Button variant="ghost" size="sm" className="text-slate-400">Quarterly</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          label="Total Subscribers"
          value={kpiData?.total || '—'}
          icon={<Users className="text-indigo-600" />}
          trend="+2.4%"
          isPositive={true}
          loading={loading}
        />
        <KPICard
          label="High Risk Users"
          value={kpiData?.highRisk || '—'}
          icon={<AlertTriangle className="text-amber-600" />}
          trend="+1.2%"
          isPositive={false}
          loading={loading}
        />
        <KPICard
          label="Avg Risk Score"
          value={kpiData?.avgRisk || '—'}
          icon={<Activity className="text-violet-600" />}
          trend="-0.5%"
          isPositive={true}
          loading={loading}
        />
        <KPICard
          label="Revenue at Risk"
          value={kpiData?.revenueAtRisk || '—'}
          icon={<DollarSign className="text-emerald-600" />}
          trend="+3.1%"
          isPositive={false}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none min-w-0 border-0">
          <CardHeader className="p-0 pb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-xl font-extrabold">Risk Distribution</CardTitle>
                <Info size={14} className="text-slate-300 dark:text-slate-600 cursor-help" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Interactive Explorer</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="h-72 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        <Card className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none min-w-0 border-0">
          <CardHeader className="p-0 pb-8">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-extrabold">Risk Tiers</CardTitle>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Click to Filter Table</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="h-72 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>

      {selectedRange && (
        <Card className="glass p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none animate-in fade-in zoom-in duration-500 border-0">
          <CardHeader className="p-0 pb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Filter size={20} />
                </div>
                <CardTitle className="text-2xl">
                  Range Explorer: <span className="text-indigo-600">{selectedRange.range}</span>
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedRange(null)}
                className="rounded-2xl"
              >
                <X size={24} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredRangeMembers.length > 0 ? filteredRangeMembers.slice(0, 8).map(m => (
                <div key={m.msno} className="p-6 bg-white/60 dark:bg-slate-800/60 rounded-[2rem] border border-white/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="font-mono text-[10px] text-slate-400 font-bold">{m.msno}</div>
                    <Badge variant={m.risk_tier.toLowerCase() as 'low' | 'medium' | 'high'} className="text-[9px] uppercase">
                      {m.risk_tier}
                    </Badge>
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
          </CardContent>
        </Card>
      )}

      <Card className="glass rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden border-0">
        <CardHeader className="px-8 py-8 border-b border-slate-100/50 dark:border-slate-800/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <CardTitle className="text-2xl">Intervention List</CardTitle>
                {selectedTier && (
                  <Badge variant="secondary" className="flex items-center gap-2 text-[10px] uppercase">
                    Filtered: {selectedTier}
                    <button onClick={() => setSelectedTier(null)} className="hover:text-rose-500"><X size={12} /></button>
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1">Prioritized subscribers for churn prevention efforts.</CardDescription>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={exportToCSV} className="gap-2">
                <Download size={14} />
                Export CSV
              </Button>
              <Button className="shadow-lg shadow-indigo-200 dark:shadow-none">
                Contact CRM
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableHead className="text-[10px] uppercase tracking-widest">User ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest">Risk Score</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest">Risk Tier</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest">Recommendation</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorityMembers.map((member) => (
                  <TableRow key={member.msno} className="group">
                    <TableCell className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">{member.msno}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <span className={`text-sm font-black ${member.risk_score > 0.70 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {(member.risk_score * 100).toFixed(1)}%
                        </span>
                        <Progress
                          value={member.risk_score * 100}
                          className="w-24 h-2"
                          indicatorClassName={member.risk_score > 0.70 ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-amber-400 to-amber-600'}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.risk_tier.toLowerCase() as 'low' | 'medium' | 'high'}>
                        {member.risk_tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-700 dark:text-slate-300">{member.action_recommendation.substring(0, 50)}...</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase group-hover:translate-x-1 transition-transform">
                        View <ChevronRight size={12} className="ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
