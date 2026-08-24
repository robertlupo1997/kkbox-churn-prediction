import React from 'react';
import FeatureImportanceGrouped from './FeatureImportanceGrouped';
import { featureImportance } from '../data/realData';

/**
 * Panel inventory fate (wave 3): the SHAP beeswarm that used to render here
 * was removed, not labeled. Its points were generated with Math.random() --
 * presenting random noise as per-member SHAP attribution is not fixable by a
 * disclaimer. Per-member attribution lives in Member Lookup, where it comes
 * from the model and is gated by a reconciliation check.
 */

const FeatureImportanceView: React.FC = () => {
  return (
    <div className="space-y-12 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h2 className="text-6xl font-black tracking-tighter leading-none mb-4 uppercase dark:text-white">
            VARIABLE<br/><span className="text-brand">RANKING</span>
          </h2>
          <p className="text-[12px] font-black uppercase tracking-widest opacity-60 dark:text-white">
            {featureImportance.length} engineered features ranked by XGBoost importance
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand mt-2">
            Historical figure set — recorded from the archived full-data training run
            (131-feature regime). It describes no served model. Live served-model
            importance: <code>/api/features/importance</code>.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <div className="p-4 brutalist-border bg-white dark:bg-zinc-900">
            <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Total Features</p>
            <p className="text-3xl font-black text-brand">{featureImportance.length}</p>
          </div>
          <div className="p-4 brutalist-border bg-white dark:bg-zinc-900">
            <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Categories</p>
            <p className="text-3xl font-black dark:text-white">6</p>
          </div>

        </div>
      </div>

      {/* Grouped Feature Importance */}
      <FeatureImportanceGrouped />
    </div>
  );
};

export default FeatureImportanceView;
