
import React, { useState } from 'react';
import { Search, Loader2, AlertCircle, TrendingUp, TrendingDown, UserSearch, Sparkles, BrainCircuit } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchMember } from '../services/backendService';
import { getRiskExplanation } from '../services/geminiService';
import { MemberDetail } from '../types';
import { useApp } from '../App';

const MemberLookup: React.FC = () => {
  const { setLoading: setGlobalLoading } = useApp();
  const [searchId, setSearchId] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberDetail | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLocalLoading(true);
      setGlobalLoading(true);
      setError(null);

      // Fetch member details from API
      const memberData = await fetchMember(searchId.trim());
      setSelectedMember(memberData);

      // Get Gemini AI explanation
      const riskText = await getRiskExplanation({
        msno: memberData.msno,
        risk_score: memberData.risk_score,
        risk_tier: memberData.risk_tier,
        is_churn: memberData.is_churn,
        top_risk_factors: [],
        action_recommendation: memberData.action.recommendation
      });
      setExplanation(riskText || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch member');
      setSelectedMember(null);
      setExplanation(null);
    } finally {
      setLocalLoading(false);
      setGlobalLoading(false);
    }
  };

  const getGaugeColor = (score: number) => {
    if (score < 40) return '#10b981';
    if (score < 70) return '#f59e0b';
    return '#ef4444';
  };

  const gaugeData = selectedMember ? [
    { name: 'Risk', value: selectedMember.risk_score * 100 },
    { name: 'Stability', value: 100 - (selectedMember.risk_score * 100) }
  ] : [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Member Profiler</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Deep-dive into individual subscriber risk drivers.</p>
        </div>
      </div>

      <div className="glass p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none">
        <form onSubmit={handleSearch} className="relative group max-w-2xl mx-auto md:mx-0">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="text-indigo-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
          </div>
          <input
            type="text"
            placeholder="Search User ID (e.g., u12345)..."
            className="w-full pl-14 pr-32 py-5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 dark:text-slate-200 shadow-inner"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button
            type="submit"
            disabled={!searchId || localLoading}
            className="absolute right-3 top-3 bottom-3 px-8 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            {localLoading ? <Loader2 size={16} className="animate-spin" /> : 'Analyze'}
          </button>
        </form>
        {error && (
          <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center space-x-3">
            <AlertCircle className="text-rose-600 dark:text-rose-400" size={20} />
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
          </div>
        )}
      </div>

      {selectedMember ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <div className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col items-center text-center">
              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6">Risk Probability</div>
              <div className="w-full h-48 relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={gaugeData}
                      cx="50%"
                      cy="80%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius={85}
                      outerRadius={105}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill={getGaugeColor(selectedMember.risk_score)} />
                      <Cell fill="rgba(148, 163, 184, 0.1)" />
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="glass px-3 py-2 rounded-xl text-[10px] font-black uppercase text-indigo-900 dark:text-indigo-100">
                              {payload[0].name}: {payload[0].value}%
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-x-0 bottom-4 flex flex-col items-center">
                  <span className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white">{(selectedMember.risk_score * 100).toFixed(1)}%</span>
                  <span className={`text-[10px] font-black mt-1 px-3 py-1 rounded-full ${selectedMember.risk_tier === 'High' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : selectedMember.risk_tier === 'Medium' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                    {selectedMember.risk_tier.toUpperCase()} INTENSITY
                  </span>
                </div>
              </div>
            </div>

            <div className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center space-x-2">
                 <BrainCircuit size={18} className="text-indigo-600" />
                 <span>User Parameters</span>
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'User ID', value: selectedMember.msno, mono: true },
                  { label: 'Risk Score', value: `${(selectedMember.risk_score * 100).toFixed(1)}%` },
                  { label: 'Risk Tier', value: selectedMember.risk_tier, highlight: true, pos: selectedMember.risk_tier === 'Low' },
                  { label: 'Churn Status', value: selectedMember.is_churn ? 'Churned' : 'Active', highlight: true, pos: !selectedMember.is_churn }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100/50 dark:border-slate-800/50 last:border-0">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{item.label}</span>
                    <span className={`text-xs font-black ${item.mono ? 'font-mono' : ''} ${item.highlight ? (item.pos ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-700 dark:text-slate-300'}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <div className="glass p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none min-h-[500px] relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                  <Sparkles size={120} />
               </div>
              <h3 className="font-black text-xl mb-8 flex items-center space-x-3 text-indigo-900 dark:text-indigo-100">
                <Sparkles className="text-indigo-600 animate-pulse" size={24} />
                <span>Gemini Analysis & Strategy</span>
              </h3>
              {localLoading ? (
                <div className="flex flex-col items-center justify-center h-80 space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 rounded-full animate-spin" />
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={20} />
                  </div>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500 animate-pulse uppercase tracking-[0.2em]">Synthesizing Risk Insights...</p>
                </div>
              ) : (
                <div className="prose prose-indigo dark:prose-invert max-w-none">
                  {explanation ? (
                    <div className="space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-white/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-white/60 dark:border-slate-800/60">
                      {explanation}
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-slate-300 dark:text-slate-700 italic font-bold">
                       Awaiting selection...
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="glass p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none">
              <h3 className="font-black text-xl mb-6 dark:text-white">Interpretability Markers</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { icon: <TrendingDown className="text-rose-500" />, label: 'is_auto_renew', impact: 'Negative', detail: 'Critical churn signal' },
                  { icon: <TrendingUp className="text-emerald-500" />, label: 'num_100', impact: 'Positive', detail: 'High loyalty marker' },
                  { icon: <TrendingDown className="text-rose-500" />, label: 'last_payment', impact: 'Negative', detail: 'Imminent expiry risk' }
                ].map((item, i) => (
                  <div key={i} className="bg-white/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-white/60 dark:border-slate-800/60 hover:shadow-lg transition-all duration-300">
                    <div className="mb-4">{item.icon}</div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1">{item.label}</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white mb-1">{item.impact} Impact</p>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass p-20 rounded-[3rem] flex flex-col items-center text-center shadow-xl shadow-slate-200/50 dark:shadow-none">
          <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-900 rounded-[2rem] flex items-center justify-center text-indigo-300 dark:text-indigo-800 mb-8 shadow-inner border border-white dark:border-slate-800">
            <UserSearch size={48} />
          </div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Select User to Profiler</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium leading-relaxed">
            Generate an individual risk strategy powered by XGBoost ensemble and Gemini AI synthesis.
          </p>
        </div>
      )}
    </div>
  );
};

export default MemberLookup;
