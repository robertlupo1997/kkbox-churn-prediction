import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Loader2, Sparkles, Zap, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  checkApiStatus,
  checkShapReconciles,
  fetchMemberDetail,
  fetchPopulationSize,
  fetchShap,
  searchMembers,
  type ApiMember,
  type ApiMemberDetail,
  type ApiShapExplanation,
} from '../services/apiService';
import ShapWaterfall from './ShapWaterfall';

/**
 * Member lookup, served entirely by the API.
 *
 * Everything on this screen comes from the running model. There is no bundled
 * member list and no generated explanation: search hits the served population,
 * the score is the served score, and when an explanation is unavailable the
 * screen says so rather than substituting anything.
 */

/** Feature keys worth showing beside the score, if the member record has them. */
const HIGHLIGHT_FEATURES: { key: string; label: string }[] = [
  { key: 'tx_count_90d', label: 'Transactions 90d' },
  { key: 'auto_renew_ratio_90d', label: 'Auto-renew ratio 90d' },
  { key: 'cancel_count_90d', label: 'Cancellations 90d' },
  { key: 'membership_days_remaining', label: 'Membership days left' },
];

const formatFeature = (value: number | string | null): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return value;
};

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
  const initialId = new URLSearchParams(location.search).get('id') || '';

  const [searchId, setSearchId] = useState(initialId);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [population, setPopulation] = useState<number | null>(null);
  const [results, setResults] = useState<ApiMember[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [detail, setDetail] = useState<ApiMemberDetail | null>(null);
  const [shap, setShap] = useState<ApiShapExplanation | null>(null);
  const [shapUnavailable, setShapUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkApiStatus().then(async status => {
      if (cancelled) return;
      setApiAvailable(status.available);
      if (status.available) {
        try {
          setPopulation(await fetchPopulationSize());
        } catch {
          setPopulation(null);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Load one member: detail first, then its explanation. */
  const selectMember = useCallback(async (msno: string) => {
    setLoading(true);
    setSearchError(null);
    setShap(null);
    setShapUnavailable(null);

    try {
      const record = await fetchMemberDetail(msno);
      if (!record) {
        setDetail(null);
        setSearchError(`The API has no member with id "${msno}".`);
        return;
      }
      setDetail(record);

      try {
        const explanation = await fetchShap(msno);
        if (!explanation) {
          setShapUnavailable('The API has no explanation for this member.');
        } else {
          // Never draw an explanation that does not explain the probability it
          // names. SHAP is additive in the model's raw margin; the API ships
          // that pre-calibration probability in the payload because the served
          // risk_score is isotonic-calibrated. The fallback path returns
          // numbers that are not attributions at all.
          const check = checkShapReconciles(explanation);
          if (check.ok) {
            setShap(explanation);
          } else {
            setShapUnavailable(
              `The explanation the API returned was rejected because ${check.reason}. ` +
                'Nothing has been drawn in its place.',
            );
          }
        }
      } catch (error) {
        setShapUnavailable(
          `The explanation request failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }.`,
        );
      }
    } catch (error) {
      setDetail(null);
      setSearchError(
        `Lookup failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const performSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      setLoading(true);
      setSearchError(null);
      setResults([]);
      setDetail(null);
      setShap(null);
      setShapUnavailable(null);

      try {
        const page = await searchMembers(trimmed);
        setMatchCount(page.total);

        if (page.total === 0) {
          setSearchError(
            `No member id in the served population contains "${trimmed}".`,
          );
          setLoading(false);
          return;
        }

        if (page.total === 1) {
          await selectMember(page.members[0].msno);
          return;
        }

        setResults(page.members);
        setLoading(false);
      } catch (error) {
        setSearchError(
          `Search failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
        );
        setLoading(false);
      }
    },
    [selectMember],
  );

  useEffect(() => {
    if (initialId) {
      performSearch(initialId);
    }
  }, [initialId, performSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchId);
  };

  const riskPercent = detail ? detail.risk_score * 100 : 0;

  return (
    <div className="space-y-12">
      {/* API status. "Healthy" is not enough -- the API reported healthy for
          months while serving an empty member table, so this reflects whether
          members are actually being served. */}
      <div className="flex items-center gap-4">
        <div
          className={`flex items-center gap-2 px-3 py-1 brutalist-border text-[9px] font-black uppercase ${
            apiAvailable === null
              ? 'bg-zinc-100 dark:bg-zinc-800'
              : apiAvailable
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-50 dark:bg-red-900/20'
          }`}
        >
          {apiAvailable === null ? (
            <>
              <Loader2 size={12} className="animate-spin dark:text-white" />
              <span className="dark:text-white">Checking API...</span>
            </>
          ) : apiAvailable ? (
            <>
              <Wifi size={12} className="text-green-600" />
              <span className="text-green-700 dark:text-green-400">
                API connected
                {population !== null ? ` — ${population.toLocaleString()} members served` : ''}
              </span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-red-500" />
              <span className="text-red-700 dark:text-red-400">
                API unavailable — this page cannot show a prediction
              </span>
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
            placeholder="SEARCH_MEMBER_ID... (any part of the id)"
            className="flex-1 px-6 py-4 font-mono font-bold text-sm bg-white dark:bg-zinc-950 dark:text-white outline-none"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            disabled={apiAvailable === false}
          />
          <button
            type="submit"
            disabled={apiAvailable === false}
            className="bg-brand text-black px-8 font-black uppercase tracking-widest text-[10px] border-l border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all disabled:opacity-40"
          >
            EXECUTE
          </button>
        </form>
      </div>

      {searchError && (
        <div className="max-w-2xl p-4 bg-red-50 dark:bg-red-900/20 brutalist-border border-red-300 dark:border-red-800 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-red-700 dark:text-red-400">{searchError}</p>
        </div>
      )}

      {results.length > 0 && !detail && (
        <div className="max-w-3xl space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest opacity-50 dark:text-white">
            {matchCount.toLocaleString()} matches — showing {results.length}
          </p>
          {results.map((m) => (
            <button
              key={m.msno}
              onClick={() => selectMember(m.msno)}
              className="w-full text-left brutalist-border dark:border-white bg-white dark:bg-zinc-900 px-4 py-3 flex justify-between items-center gap-4 hover:bg-brand/20 transition-colors"
            >
              <span className="font-mono text-[11px] break-all dark:text-white">{m.msno}</span>
              <span
                className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 ${
                  m.risk_tier === 'High'
                    ? 'bg-red-600 text-white'
                    : m.risk_tier === 'Medium'
                      ? 'bg-yellow-500 text-black'
                      : 'bg-green-600 text-white'
                }`}
              >
                {(m.risk_score * 100).toFixed(1)}% {m.risk_tier}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <TicketSkeleton />
      ) : detail ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="brutalist-border dark:border-white bg-white dark:bg-zinc-900 p-0 flex flex-col brutalist-shadow">
              <div className="bg-brand p-4 flex justify-between items-center border-b border-black dark:border-white gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-black break-all">
                  {detail.msno}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {detail.is_churn === true && (
                    <span className="text-[8px] font-black uppercase bg-black text-white px-2 py-0.5">
                      CHURNED
                    </span>
                  )}
                  <div className="w-12 h-4 barcode-bg"></div>
                </div>
              </div>
              <div className="aspect-[4/5] bg-light dark:bg-zinc-800 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="text-[100px] font-black text-black/5 dark:text-white/5 absolute inset-0 flex items-center justify-center pointer-events-none">
                  {riskPercent.toFixed(0)}
                </div>
                <div className="z-10 text-center space-y-2">
                  <p className="text-7xl font-black tracking-tighter leading-none dark:text-white">
                    {riskPercent.toFixed(1)}%
                  </p>
                  <p
                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 inline-block ${
                      detail.risk_tier === 'High'
                        ? 'bg-red-600 text-white'
                        : detail.risk_tier === 'Medium'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-green-600 text-white'
                    }`}
                  >
                    {detail.risk_tier}_RISK
                  </p>
                </div>
              </div>
              <div className="bg-brand p-4 border-t border-black dark:border-white">
                <div className="text-[9px] font-black leading-tight uppercase text-black">
                  ACTUAL CHURN:{' '}
                  {detail.is_churn === null ? 'UNLABELLED' : detail.is_churn ? 'YES' : 'NO'}
                  <br />
                  URGENCY: {detail.action.urgency}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
              <div className="brutalist-border dark:border-white bg-white dark:bg-zinc-900 p-8 brutalist-shadow min-h-[300px]">
                <div className="flex items-center space-x-2 mb-8">
                  <div className="bg-brand p-1 brutalist-border dark:border-white">
                    <Sparkles size={16} />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight dark:text-white">
                    Risk analysis
                  </h3>
                </div>

                <div className="prose prose-sm max-w-none text-black dark:text-white font-medium leading-relaxed">
                  <p className="mb-4">
                    The model scores this member at{' '}
                    <strong>{riskPercent.toFixed(2)}%</strong> churn probability, which places
                    them in the <strong>{detail.risk_tier} risk</strong> tier.
                  </p>
                  <p className="mb-4">
                    <span className="font-bold">Rule-selected action:</span>{' '}
                    {detail.action.recommendation}. Its effectiveness has not been evaluated.
                  </p>

                  {shap ? (
                    <>
                      <div className="mb-4">
                        <p className="font-bold text-red-600 dark:text-red-400 mb-2">
                          Strongest contributors to this member's score:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          {shap.top_risk_factors.slice(0, 3).map((f) => (
                            <li key={f.feature}>
                              <strong>{f.feature}</strong>: +{f.impact.toFixed(3)} log-odds
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold text-green-600 dark:text-green-400 mb-2">
                          Strongest protective contributors:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          {shap.top_protective_factors.slice(0, 3).map((f) => (
                            <li key={f.feature}>
                              <strong>{f.feature}</strong>: {f.impact.toFixed(3)} log-odds
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 brutalist-border border-zinc-300 dark:border-zinc-700">
                      <p className="text-[11px] font-bold">
                        No explanation available for this member.{' '}
                        {shapUnavailable ?? ''} The score above is still the model's output;
                        nothing has been substituted for the missing attribution.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {HIGHLIGHT_FEATURES.filter((f) => f.key in detail.features).map((f) => (
                  <div
                    key={f.key}
                    className="brutalist-border dark:border-white bg-light dark:bg-zinc-800 p-4"
                  >
                    <p className="text-[9px] font-black text-black/40 dark:text-white/40 uppercase mb-1">
                      {f.label}
                    </p>
                    <p className="text-xl font-black dark:text-white">
                      {formatFeature(detail.features[f.key])}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[9px] font-bold opacity-50 dark:text-white">
                Served feature values, straight from the model's input row.{' '}
                {Object.keys(detail.features).length} features in total.
              </p>
            </div>
          </div>

          {shap && shap.probability_explained !== undefined && (
            <>
              {Math.abs(shap.probability_explained - detail.risk_score) > 1e-6 && (
                <p className="text-[10px] font-bold uppercase tracking-wide text-brand mb-2">
                  Note: this attribution explains the model&apos;s uncalibrated output (
                  {(shap.probability_explained * 100).toFixed(2)}%). The score above is the
                  isotonic-calibrated probability ({(detail.risk_score * 100).toFixed(2)}%).
                </p>
              )}
              <ShapWaterfall explanation={shap} finalScore={shap.probability_explained} />
            </>
          )}
        </motion.div>
      ) : results.length === 0 ? (
        <div className="py-32 flex flex-col items-center text-center">
          <Zap size={64} className="mb-8 opacity-10 dark:text-white" />
          <h3 className="text-2xl font-black uppercase mb-2 dark:text-white">
            Initialize profile access
          </h3>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">
            {apiAvailable === false
              ? 'The API is not serving members right now.'
              : 'Search any part of a subscriber id to begin analysis.'}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default MemberLookup;
