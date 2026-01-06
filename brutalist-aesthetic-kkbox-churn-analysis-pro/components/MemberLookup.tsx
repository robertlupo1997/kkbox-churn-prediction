
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Loader2, Sparkles, BrainCircuit, Zap, ArrowRight, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { sampleMembers } from '../data/realData';
import { getRiskExplanation } from '../services/geminiService';
import { getMemberPrediction, generateMockSHAPFactors, checkAPIStatus, type PredictionResponse, type SHAPFactor } from '../services/apiService';
import { SampleMember } from '../types';
import ShapWaterfall from './ShapWaterfall';

const TicketSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-pulse">
    <div className="brutalist-border border-zinc-200 bg-white dark:bg-zinc-900 p-0 flex flex-col">
      <div className="bg-zinc-100 dark:bg-zinc-800 p-4 h-12 border-b border-zinc-200 dark:border-zinc-700"></div>
      <div className="aspect-[4/5] bg-zinc-50 dark:bg-zinc-800 flex flex-col items-center justify-center p-8">
        <div className="w-24 h-24 bg-zinc-200 dark:bg-zinc-700 rounded-full mb-4"></div>
        <div className="w-32 h-4 bg-zinc-200 dark:bg-zinc-700"></div>
      </div>
      <div className="bg-zinc-100 dark:bg-zinc-800 p-4 h-16 border-t border-zinc-200 dark:border-zinc-700"></div>
    </div>
    <div className="lg:col-span-2 space-y-8">
      <div className="brutalist-border border-zinc-200 bg-white dark:bg-zinc-900 p-8 h-[400px]">
        <div className="w-48 h-6 bg-zinc-100 dark:bg-zinc-800 mb-8"></div>
        <div className="space-y-4">
          <div className="w-full h-4 bg-zinc-100 dark:bg-zinc-800"></div>
          <div className="w-5/6 h-4 bg-zinc-100 dark:bg-zinc-800"></div>
          <div className="w-4/6 h-4 bg-zinc-100 dark:bg-zinc-800"></div>
        </div>
      </div>
    </div>
  </div>
);

const MemberLookup: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialId = queryParams.get('id') || '';

  const [searchId, setSearchId] = useState(initialId);
  const [selectedMember, setSelectedMember] = useState<SampleMember | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [riskFactors, setRiskFactors] = useState<SHAPFactor[]>([]);
  const [protectiveFactors, setProtectiveFactors] = useState<SHAPFactor[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Check API availability on mount
  useEffect(() => {
    checkAPIStatus().then(status => setApiAvailable(status.available));
  }, []);

  useEffect(() => {
    if (initialId) {
      performSearch(initialId);
    }
  }, [initialId]);

  const performSearch = async (id: string) => {
    setLoading(true);
    setSearchError(null);
    setRiskFactors([]);
    setProtectiveFactors([]);

    // First, try to find in sample members (works offline)
    const found = sampleMembers.find(m =>
      m.msno.toLowerCase().includes(id.toLowerCase()) ||
      m.msno_full.toLowerCase().includes(id.toLowerCase())
    );

    if (found) {
      setSelectedMember(found);

      // Try to get SHAP factors from API if available
      if (apiAvailable) {
        try {
          const prediction = await getMemberPrediction(found.msno_full);
          if (prediction) {
            setRiskFactors(prediction.top_risk_factors);
            setProtectiveFactors(prediction.top_protective_factors);
          }
        } catch (error) {
          // API call failed, use mock SHAP factors
          const mockFactors = generateMockSHAPFactors(found.risk_score);
          setRiskFactors(mockFactors.riskFactors);
          setProtectiveFactors(mockFactors.protectiveFactors);
        }
      } else {
        // No API, use mock SHAP factors
        const mockFactors = generateMockSHAPFactors(found.risk_score);
        setRiskFactors(mockFactors.riskFactors);
        setProtectiveFactors(mockFactors.protectiveFactors);
      }

      // Get AI explanation
      const memberForExplanation = {
        msno: found.msno,
        risk_score: found.risk_score,
        risk_tier: found.risk_tier,
        is_churn: found.is_churn,
        city: found.city,
        bd: found.age,
        gender: 'unknown',
        registered_via: 0,
        registration_init_time: '',
        payment_method_id: 0,
        payment_plan_days: 30,
        plan_list_price: 149,
        actual_amount_paid: 149,
        is_auto_renew: found.is_auto_renew ? 1 : 0,
        last_transaction_date: 'N/A',
        num_25: 0,
        num_50: 0,
        num_75: 0,
        num_985: 0,
        num_100: 0,
        num_unq: 0,
        total_secs: found.total_secs_30d,
      };
      const riskText = await getRiskExplanation(memberForExplanation);
      setExplanation(riskText || null);
    } else {
      setSelectedMember(null);
      setSearchError(`Member "${id}" not found. Try searching for a partial ID from the sample data.`);
    }

    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchId);
  };

  return (
    <div className="space-y-12">
      {/* API Status Indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 px-3 py-1 brutalist-border text-[9px] font-black uppercase ${
          apiAvailable === null ? 'bg-zinc-100 dark:bg-zinc-800' :
          apiAvailable ? 'bg-green-100 dark:bg-green-900/30' : 'bg-zinc-100 dark:bg-zinc-800'
        }`}>
          {apiAvailable === null ? (
            <>
              <Loader2 size={12} className="animate-spin dark:text-white" />
              <span className="dark:text-white">Checking API...</span>
            </>
          ) : apiAvailable ? (
            <>
              <Wifi size={12} className="text-green-600" />
              <span className="text-green-700 dark:text-green-400">API Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-zinc-500 dark:text-zinc-400" />
              <span className="text-zinc-600 dark:text-zinc-400">Demo Mode (200 Sample Members)</span>
            </>
          )}
        </div>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSearch} className="flex brutalist-border dark:border-white">
          <div className="bg-black dark:bg-zinc-900 p-4 text-white flex items-center">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="INPUT_MEMBER_ID... (try: fV6, Z3d, NM0)"
            className="flex-1 px-6 py-4 font-mono font-bold text-sm bg-white dark:bg-zinc-950 dark:text-white outline-none"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button
            type="submit"
            className="bg-brand text-black px-8 font-black uppercase tracking-widest text-[10px] border-l border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
          >
            EXECUTE
          </button>
        </form>
      </div>

      {/* Error Message */}
      {searchError && (
        <div className="max-w-2xl p-4 bg-red-50 dark:bg-red-900/20 brutalist-border border-red-300 dark:border-red-800 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-red-700 dark:text-red-400">{searchError}</p>
        </div>
      )}

      {loading ? (
        <TicketSkeleton />
      ) : selectedMember ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Ticket Card Style */}
            <div className="brutalist-border dark:border-white bg-white dark:bg-zinc-900 p-0 flex flex-col brutalist-shadow">
              <div className="bg-brand p-4 flex justify-between items-center border-b border-black dark:border-white">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black">{selectedMember.msno}</span>
                <div className="flex items-center gap-2">
                  {selectedMember.is_churn && (
                    <span className="text-[8px] font-black uppercase bg-black text-white px-2 py-0.5">CHURNED</span>
                  )}
                  <div className="w-12 h-4 barcode-bg"></div>
                </div>
              </div>
              <div className="aspect-[4/5] bg-light dark:bg-zinc-800 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="text-[100px] font-black text-black/5 dark:text-white/5 absolute inset-0 flex items-center justify-center pointer-events-none">
                  {selectedMember.risk_score}
                </div>
                <div className="z-10 text-center space-y-2">
                  <p className="text-8xl font-black tracking-tighter leading-none dark:text-white">{selectedMember.risk_score}%</p>
                  <p className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 inline-block ${
                    selectedMember.risk_tier === 'High' ? 'bg-red-600 text-white' :
                    selectedMember.risk_tier === 'Medium' ? 'bg-yellow-500 text-black' :
                    'bg-green-600 text-white'
                  }`}>
                    {selectedMember.risk_tier}_RISK
                  </p>
                </div>
              </div>
              <div className="bg-brand p-4 border-t border-black dark:border-white flex justify-between items-end">
                <div className="text-[9px] font-black leading-tight uppercase text-black">
                  ACTUAL CHURN: {selectedMember.is_churn ? 'YES' : 'NO'}<br/>
                  TIER: {selectedMember.risk_tier}
                </div>
                <div className="w-12 h-12 brutalist-border bg-white flex items-center justify-center">
                  <div className="w-8 h-8 border-[3px] border-black border-dashed rounded-full animate-spin"></div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <div className="brutalist-border dark:border-white bg-white dark:bg-zinc-900 p-8 brutalist-shadow min-h-[300px]">
                <div className="flex items-center space-x-2 mb-8">
                  <div className="bg-brand p-1 brutalist-border dark:border-white"><Sparkles size={16} /></div>
                  <h3 className="text-xl font-black uppercase tracking-tight dark:text-white">AI Strategic Synthesis</h3>
                </div>

                <div className="prose prose-sm max-w-none text-black dark:text-white font-medium leading-relaxed">
                  {explanation ? (
                    <div className="whitespace-pre-wrap">{explanation}</div>
                  ) : (
                    <p className="italic opacity-30">Awaiting data fetch...</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'City_ID', val: selectedMember.city },
                  { label: 'Auto_Renew', val: selectedMember.is_auto_renew ? 'YES' : 'NO' },
                  { label: 'Tenure_Days', val: selectedMember.tenure_days },
                  { label: 'Active_Days_30d', val: selectedMember.active_days_30d },
                ].map((stat, i) => (
                  <div key={i} className="brutalist-border dark:border-white bg-light dark:bg-zinc-800 p-4">
                    <p className="text-[9px] font-black text-black/40 dark:text-white/40 uppercase mb-1">{stat.label}</p>
                    <p className="text-xl font-black dark:text-white">{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SHAP Waterfall Chart */}
          {(riskFactors.length > 0 || protectiveFactors.length > 0) && (
            <ShapWaterfall
              riskFactors={riskFactors}
              protectiveFactors={protectiveFactors}
              finalRisk={selectedMember.risk_score}
            />
          )}
        </motion.div>
      ) : (
        <div className="py-32 flex flex-col items-center text-center">
           <Zap size={64} className="mb-8 opacity-10 dark:text-white" />
           <h3 className="text-2xl font-black uppercase mb-2 dark:text-white">Initialize Profile Access</h3>
           <p className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">Search for a unique subscriber ID to begin analysis.</p>
        </div>
      )}
    </div>
  );
};

export default MemberLookup;
