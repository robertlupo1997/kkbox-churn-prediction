
import React, { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, UserSearch, Sparkles, BrainCircuit } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useMember, useShapExplanation } from '../hooks/useApi';
import { getRiskExplanation } from '../services/geminiService';
import { useApp } from '../App';
import ShapWaterfall from './ShapWaterfall';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';

const MemberLookup: React.FC = () => {
  const { setLoading: setGlobalLoading } = useApp();
  const [searchId, setSearchId] = useState('');
  const [searchedMsno, setSearchedMsno] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  // Use TanStack Query hooks for data fetching
  const {
    data: selectedMember,
    isLoading: memberLoading,
    error: memberError,
    isFetching: memberFetching
  } = useMember(searchedMsno);

  const {
    data: shapData,
    isLoading: shapLoading
  } = useShapExplanation(searchedMsno);

  const localLoading = memberLoading || memberFetching || shapLoading || isLoadingExplanation;
  const error = memberError?.message || null;

  // Update global loading state
  useEffect(() => {
    setGlobalLoading(localLoading);
  }, [localLoading, setGlobalLoading]);

  // Fetch Gemini explanation when member data is loaded
  useEffect(() => {
    if (selectedMember && !explanation) {
      const fetchExplanation = async () => {
        setIsLoadingExplanation(true);
        try {
          const riskText = await getRiskExplanation({
            msno: selectedMember.msno,
            risk_score: selectedMember.risk_score,
            risk_tier: selectedMember.risk_tier,
            is_churn: selectedMember.is_churn,
            top_risk_factors: [],
            action_recommendation: selectedMember.action.recommendation
          });
          setExplanation(riskText || null);
        } catch (err) {
          console.warn('Failed to get AI explanation:', err);
          setExplanation(null);
        } finally {
          setIsLoadingExplanation(false);
        }
      };
      fetchExplanation();
    }
  }, [selectedMember, explanation]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = searchId.trim();
    if (trimmedId) {
      setExplanation(null); // Reset explanation for new search
      setSearchedMsno(trimmedId);
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

      <Card className="glass p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
        <form onSubmit={handleSearch} className="relative group max-w-2xl mx-auto md:mx-0">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none z-10">
            <Search className="text-indigo-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
          </div>
          <Input
            type="text"
            placeholder="Search User ID (e.g., u12345)..."
            className="w-full pl-14 pr-32 py-5 h-auto bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-500 font-bold text-slate-700 dark:text-slate-200 shadow-inner"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <Button
            type="submit"
            disabled={!searchId || localLoading}
            className="absolute right-3 top-3 bottom-3 px-8 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            {localLoading ? <Loader2 size={16} className="animate-spin" /> : 'Analyze'}
          </Button>
        </form>
        {error && (
          <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center space-x-3">
            <AlertCircle className="text-rose-600 dark:text-rose-400" size={20} />
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
          </div>
        )}
      </Card>

      {selectedMember ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <Card className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
              <CardContent className="p-0 flex flex-col items-center text-center">
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
                    <Badge variant={selectedMember.risk_tier.toLowerCase() as 'low' | 'medium' | 'high'} className="mt-1 text-[10px] font-black uppercase">
                      {selectedMember.risk_tier} INTENSITY
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
              <CardHeader className="p-0 pb-6">
                <CardTitle className="text-lg flex items-center space-x-2">
                   <BrainCircuit size={18} className="text-indigo-600" />
                   <span>User Parameters</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
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
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <Card className="glass p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none min-h-[500px] relative overflow-hidden border-0">
               <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                  <Sparkles size={120} />
               </div>
              <CardHeader className="p-0 pb-8">
                <CardTitle className="text-xl flex items-center space-x-3 text-indigo-900 dark:text-indigo-100">
                  <Sparkles className="text-indigo-600 animate-pulse" size={24} />
                  <span>Gemini Analysis & Strategy</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {localLoading ? (
                  <div className="flex flex-col items-center justify-center h-80 space-y-4">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <Skeleton className="h-4 w-48" />
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
              </CardContent>
            </Card>

            <Card className="glass p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
              <CardHeader className="p-0 pb-6">
                <CardTitle className="text-xl flex items-center space-x-2">
                  <BrainCircuit size={20} className="text-indigo-600" />
                  <span>SHAP Feature Impact</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {shapData ? (
                  <ShapWaterfall
                    riskFactors={shapData.explanation.top_risk_factors}
                    protectiveFactors={shapData.explanation.top_protective_factors}
                    baseValue={shapData.explanation.base_value}
                    prediction={selectedMember.risk_score}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <Skeleton className="h-48 w-full" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="glass p-20 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-0">
          <CardContent className="p-0 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-900 rounded-[2rem] flex items-center justify-center text-indigo-300 dark:text-indigo-800 mb-8 shadow-inner border border-white dark:border-slate-800">
              <UserSearch size={48} />
            </div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Select User to Profile</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium leading-relaxed">
              Generate an individual risk strategy powered by XGBoost ensemble and Gemini AI synthesis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MemberLookup;
