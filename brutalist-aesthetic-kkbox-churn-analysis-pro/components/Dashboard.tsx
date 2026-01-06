
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, AlertTriangle, Activity, DollarSign, Download, Zap, CheckSquare, Square, Trash2, Mail, Tag, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardKPIs, riskDistribution, pieData, sampleMembers } from '../data/realData';

const COLORS = ['#000000', '#ff4d00', '#999999'];
const AVAILABLE_TAGS = ['High Value', 'At Risk', 'Needs Outreach', 'Priority', 'Churned'];

const KPI_CARDS = [
  { label: 'Total Subscribers', value: dashboardKPIs.totalSubscribers, icon: <Users size={16} /> },
  { label: 'High Risk Users', value: dashboardKPIs.highRiskUsers, icon: <AlertTriangle size={16} /> },
  { label: 'Churn Rate', value: dashboardKPIs.churnRate, icon: <Activity size={16} /> },
  { label: 'Revenue at Risk', value: dashboardKPIs.revenueAtRisk, icon: <DollarSign size={16} /> },
];

// Transform risk distribution for chart display (scale down for visibility)
const riskDistData = riskDistribution.map(r => ({
  ...r,
  count: Math.round(r.count / 1000), // Scale to thousands for chart
  displayCount: r.count.toLocaleString(),
}));

const BrutalistCard = ({ children, title, className = "" }: { children?: React.ReactNode, title?: string, className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4 }}
    className={`brutalist-border p-6 bg-white dark:bg-zinc-900 hover:bg-light dark:hover:bg-zinc-800 transition-colors ${className}`}
  >
    {title && <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 border-b-2 border-black dark:border-white/20 pb-2 flex items-center dark:text-white">
      <Zap size={10} className="mr-1 fill-black dark:fill-brand" /> {title}
    </h3>}
    {children}
  </motion.div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-black text-white p-3 brutalist-border border-white text-[10px] font-black uppercase tracking-widest">
        <p className="mb-2 border-b border-white/20 pb-1">{label}</p>
        <p className="text-brand">Members: {data.displayCount || payload[0].value.toLocaleString()}</p>
        <p className="text-zinc-400">Tier: {data.tier}</p>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(() => localStorage.getItem('activeFilter'));
  const [memberTags, setMemberTags] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('memberTags');
    return saved ? JSON.parse(saved) : {};
  });
  const [showTagMenu, setShowTagMenu] = useState(false);

  useEffect(() => {
    localStorage.setItem('memberTags', JSON.stringify(memberTags));
  }, [memberTags]);

  useEffect(() => {
    if (activeFilter) localStorage.setItem('activeFilter', activeFilter);
    else localStorage.removeItem('activeFilter');
  }, [activeFilter]);

  const toggleSelect = (msno: string) => {
    setSelectedIds(prev => prev.includes(msno) ? prev.filter(id => id !== msno) : [...prev, msno]);
  };

  const toggleAll = () => {
    const filtered = filteredMembers.map(m => m.msno);
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered);
  };

  const filteredMembers = useMemo(() => {
    if (!activeFilter) return sampleMembers;
    return sampleMembers.filter(m => m.risk_tier.toLowerCase() === activeFilter.toLowerCase());
  }, [activeFilter]);

  const addTagToMember = (msno: string, tag: string) => {
    setMemberTags(prev => ({
      ...prev,
      [msno]: Array.from(new Set([...(prev[msno] || []), tag]))
    }));
  };

  const removeTagFromMember = (msno: string, tag: string) => {
    setMemberTags(prev => ({
      ...prev,
      [msno]: (prev[msno] || []).filter(t => t !== tag)
    }));
  };

  const bulkTag = (tag: string) => {
    const newTags = { ...memberTags };
    selectedIds.forEach(id => {
      newTags[id] = Array.from(new Set([...(newTags[id] || []), tag]));
    });
    setMemberTags(newTags);
    setShowTagMenu(false);
  };

  const exportToCSV = () => {
    const headers = ['msno', 'risk_score', 'risk_tier', 'is_auto_renew', 'is_churn', 'tags'];
    const rows = filteredMembers.map(m => [
      m.msno_full || m.msno,
      m.risk_score,
      m.risk_tier,
      m.is_auto_renew,
      m.is_churn,
      (memberTags[m.msno] || []).join('|')
    ]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `churn_priority_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleChartClick = (data: any) => {
    const tier = data.tier || (data.payload && data.payload.tier);
    if (tier === activeFilter) setActiveFilter(null);
    else setActiveFilter(tier);
  };

  return (
    <div className="space-y-8" onClick={() => setShowTagMenu(false)}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-zinc-900 brutalist-border dark:border-white p-6 flex flex-col justify-between brutalist-shadow"
          >
            <div className="flex justify-between items-start mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-white">{card.label}</span>
              <div className="bg-black dark:bg-brand text-white p-1">{card.icon}</div>
            </div>
            <p className="text-4xl font-black tracking-tighter dark:text-white">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <BrutalistCard title="Risk Distribution (Click bars to filter table)">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistData}>
                <XAxis dataKey="range" fontSize={8} fontWeight={900} axisLine={false} tickLine={false} tick={{fill: 'currentColor'}} className="dark:text-zinc-500" />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f4f4f4'}} />
                <Bar
                  dataKey="count"
                  fill="#ff4d00"
                  stroke="#000"
                  strokeWidth={1}
                  onClick={handleChartClick}
                  cursor="pointer"
                >
                  {riskDistData.map((entry, index) => (
                    <Cell key={index} fill={activeFilter === entry.tier ? '#000' : '#ff4d00'} className={activeFilter === entry.tier ? 'dark:fill-white' : ''} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BrutalistCard>

        <BrutalistCard title="Client Tier Segregation (Click slices to filter)">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="#000"
                  onClick={handleChartClick}
                  cursor="pointer"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={activeFilter === entry.tier ? '#ff4d00' : COLORS[index]} className="dark:fill-brand" />
                  ))}
                </Pie>
                <Legend iconType="rect" verticalAlign="bottom" wrapperStyle={{fontSize: '9px', fontWeight: '900', textTransform: 'uppercase'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </BrutalistCard>
      </div>

      <div className="brutalist-border dark:border-white overflow-hidden bg-white dark:bg-zinc-950 brutalist-shadow">
        <div className="bg-black dark:bg-zinc-900 text-white p-4 flex justify-between items-center border-b-2 dark:border-white">
          <div className="flex items-center gap-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              Monitoring {activeFilter && <span className="bg-brand text-black px-2 py-0.5">{activeFilter}</span>}
              {activeFilter && <X size={14} className="cursor-pointer hover:text-brand" onClick={() => setActiveFilter(null)} />}
            </h3>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 border-l-2 border-white/20 pl-4 relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowTagMenu(!showTagMenu); }}
                  className="text-[9px] font-black bg-brand px-2 py-1 text-black flex items-center gap-1 hover:bg-white transition-all"
                >
                  <Tag size={12} /> TAG_SELECTED ({selectedIds.length})
                </button>
                <button className="text-[9px] font-black bg-white/10 hover:bg-white/20 px-2 py-1 flex items-center gap-1">
                  <Mail size={12} /> OUTREACH
                </button>

                <AnimatePresence>
                  {showTagMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-2 bg-white text-black brutalist-border z-20 w-48"
                      onClick={e => e.stopPropagation()}
                    >
                      {AVAILABLE_TAGS.map(tag => (
                        <div
                          key={tag}
                          className="px-4 py-2 text-[10px] font-black uppercase cursor-pointer hover:bg-brand"
                          onClick={() => bulkTag(tag)}
                        >
                          {tag}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
          <button
            onClick={exportToCSV}
            className="text-[9px] font-black border-2 border-white px-3 py-1 hover:bg-brand hover:border-brand transition-all flex items-center gap-2"
          >
            <Download size={14} /> EXPORT DATA
          </button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-light dark:bg-zinc-800 border-b-2 border-black dark:border-white text-[9px] font-black uppercase tracking-widest dark:text-white">
            <tr>
              <th className="px-6 py-4 w-10">
                <button onClick={toggleAll} className="hover:text-brand">
                  {selectedIds.length === filteredMembers.length ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              </th>
              <th className="px-6 py-4">Member_ID</th>
              <th className="px-6 py-4">Risk Score</th>
              <th className="px-6 py-4">Tier</th>
              <th className="px-6 py-4">Churned</th>
              <th className="px-6 py-4">Tags</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black/10 dark:divide-white/10 dark:text-white">
            {filteredMembers.slice(0, 50).map((m) => (
              <tr key={m.msno} className={`hover:bg-brand/5 dark:hover:bg-brand/10 text-[11px] font-bold ${selectedIds.includes(m.msno) ? 'bg-brand/10 dark:bg-brand/20' : ''}`}>
                <td className="px-6 py-4">
                  <button onClick={() => toggleSelect(m.msno)} className="hover:text-brand">
                    {selectedIds.includes(m.msno) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </td>
                <td className="px-6 py-4 font-mono">{m.msno}</td>
                <td className="px-6 py-4">
                  <span className={m.risk_score > 60 ? 'text-brand font-black' : ''}>{m.risk_score}%</span>
                </td>
                <td className="px-6 py-4 uppercase text-[9px]">
                  <span className={`px-2 py-0.5 ${m.risk_tier === 'High' ? 'bg-brand text-black' : m.risk_tier === 'Medium' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                    {m.risk_tier}
                  </span>
                </td>
                <td className="px-6 py-4 uppercase text-[9px]">{m.is_churn ? 'Yes' : 'No'}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(memberTags[m.msno] || []).map(tag => (
                      <span key={tag} className="bg-black text-white text-[8px] px-1 py-0.5 uppercase flex items-center gap-1">
                        {tag}
                        <X size={8} className="cursor-pointer hover:text-brand" onClick={() => removeTagFromMember(m.msno, tag)} />
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-[9px] font-black border-2 border-black dark:border-white px-4 py-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                    OPEN
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
