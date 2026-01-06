import React from 'react';
import FeatureImportanceGrouped from './FeatureImportanceGrouped';
import ShapBeeswarm from './ShapBeeswarm';
import { featureImportance, datasetStats } from '../data/realData';

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
          <div className="p-4 brutalist-border bg-white dark:bg-zinc-900">
            <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">Training Samples</p>
            <p className="text-3xl font-black dark:text-white">{(datasetStats.train_samples / 1000).toFixed(0)}K</p>
          </div>
        </div>
      </div>

      {/* SHAP Beeswarm Summary */}
      <ShapBeeswarm />

      {/* Grouped Feature Importance */}
      <FeatureImportanceGrouped />
    </div>
  );
};

export default FeatureImportanceView;
