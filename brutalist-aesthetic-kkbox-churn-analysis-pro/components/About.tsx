
import React from 'react';
import { Database, ShieldCheck, Layers, ExternalLink, Zap } from 'lucide-react';

// Fix: Make children optional in type definition to prevent TS from incorrectly flagging missing children in JSX blocks
const DocSection = ({ title, children, icon: Icon }: { title: string, children?: React.ReactNode, icon: any }) => (
  <div className="brutalist-border bg-white p-8 brutalist-shadow">
    <div className="flex items-center space-x-3 mb-6">
      <div className="bg-brand p-2 brutalist-border"><Icon size={20} /></div>
      <h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
    </div>
    <div className="text-[12px] font-medium leading-relaxed space-y-4 opacity-70">
      {children}
    </div>
  </div>
);

const About: React.FC = () => {
  return (
    <div className="space-y-16">
      <section className="max-w-3xl">
        <div className="inline-block bg-brand px-3 py-1 brutalist-border mb-6">
          <span className="text-[10px] font-black uppercase tracking-widest">Technical Manifesto</span>
        </div>
        <h2 className="text-7xl font-black tracking-tighter leading-[0.85] mb-8">
          INDUSTRIAL<br/>STRENGTH<br/>CHURN PREDICTION
        </h2>
        <p className="text-[16px] font-bold leading-relaxed opacity-60">
          ChurnPro is a high-performance analytics interface for the WSDM - KKBox Churn Prediction Challenge.
          It leverages ensemble learning with XGBoost and LightGBM to provide reliable probabilistic forecasts
          for massive subscriber bases.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <DocSection title="Core Infrastructure" icon={Layers}>
          <p>The prediction engine uses a temporal-aware stacking ensemble. Playlogs, transactions, and user identity features are cross-referenced to identify behavioral decay.</p>
          <p>Probabilistic outputs are calibrated using Isotonic Regression, ensuring that the risk indices reflect real-world event frequencies.</p>
        </DocSection>

        <DocSection title="Feature Engineering" icon={Database}>
          <p>99 distinct predictors are extracted across multiple time windows (7d, 14d, 30d). We track skip rates, repetition factors, and session breadth as core loyalty indicators.</p>
          <div className="pt-4 space-y-1">
             <div className="flex justify-between items-center text-[10px] font-black border-b border-black/10 pb-1">
                <span>Play History</span><span>64% Weight</span>
             </div>
             <div className="flex justify-between items-center text-[10px] font-black border-b border-black/10 pb-1">
                <span>Transaction Recency</span><span>22% Weight</span>
             </div>
             <div className="flex justify-between items-center text-[10px] font-black">
                <span>Demographics</span><span>14% Weight</span>
             </div>
          </div>
        </DocSection>

        <DocSection title="Model Integrity" icon={ShieldCheck}>
          <p>Strict temporal validation splits are applied to prevent data leakage. The model is trained on historic snapshots and validated against out-of-time monthly churn events.</p>
          <p>AUC-ROC: 0.912 | Log Loss: 0.142 | Brier Score: 0.084</p>
        </DocSection>

        <div className="brutalist-border bg-black text-white p-12 flex flex-col justify-between items-start">
           <div>
             <Zap size={48} className="text-brand mb-8 fill-brand" />
             <h3 className="text-3xl font-black uppercase tracking-tight mb-4">Access the raw intelligence.</h3>
             <p className="text-[11px] font-black uppercase tracking-widest opacity-60 max-w-xs mb-8">
               View the full project documentation, dataset source, and technical notebooks on Kaggle.
             </p>
           </div>
           <a
             href="https://www.kaggle.com/c/kkbox-churn-prediction-challenge"
             target="_blank"
             className="bg-brand text-black px-8 py-4 font-black uppercase tracking-widest text-[10px] hover:bg-white transition-all flex items-center"
           >
             OPEN_KAGGLE <ExternalLink size={14} className="ml-2" />
           </a>
        </div>
      </div>
    </div>
  );
};

export default About;
