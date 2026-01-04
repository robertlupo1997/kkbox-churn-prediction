
import React from 'react';
import { Database, ShieldCheck, Clock, Layers, BookOpen, ExternalLink, Download, FileCode } from 'lucide-react';

const DocumentationCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; color: string }> = ({ icon, title, children, color }) => (
  <div className="glass p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${color}`}>
      {icon}
    </div>
    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">{title}</h3>
    <div className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed space-y-4">
      {children}
    </div>
  </div>
);

const About: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-16 pb-20">
      <section className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
          <BookOpen size={14} />
          <span>Technical Whitepaper</span>
        </div>
        <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">The Science Behind ChurnPro</h2>
        <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
          Deep-dive into the machine learning architecture and feature engineering strategies developed for the KKBox Churn Challenge.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <DocumentationCard
          icon={<Layers size={24} />}
          title="Architecture & Modeling"
          color="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300"
        >
          <p>
            The core engine utilizes a weighted ensemble of <strong>XGBoost</strong> and <strong>LightGBM</strong>. We found that XGBoost excelled at capturing complex interactions in playlogs, while LightGBM offered better generalization for sparse transactional data.
          </p>
          <p>
            Raw probabilities are transformed via <strong>Isotonic Regression</strong> to map model scores to real-world churn frequencies, ensuring the "Risk Score" shown in the UI is a statistically sound probability.
          </p>
        </DocumentationCard>

        <DocumentationCard
          icon={<Database size={24} />}
          title="Engineered Feature Space"
          color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300"
        >
          <p>
            Our pipeline extracts 99 predictors categorized by:
          </p>
          <ul className="space-y-2 list-none">
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span><strong>User Logs:</strong> 30-day play history, breadth, skip rates.</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span><strong>Transactions:</strong> Auto-renew toggles, payment methods.</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span><strong>Identity:</strong> City, age, registration source tenure.</span>
            </li>
          </ul>
        </DocumentationCard>

        <DocumentationCard
          icon={<Clock size={24} />}
          title="Temporal Windows"
          color="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300"
        >
          <p>
            Churn is rarely a static event; it's a behavioral trend. We calculate features over <strong>1, 3, 7, 14, and 30-day</strong> rolling windows.
          </p>
          <p>
            This multi-scale approach allows the model to distinguish between a <em>"slow decay"</em> in interest versus a <em>"sudden shock"</em> due to payment failure, enabling more nuanced intervention strategies.
          </p>
        </DocumentationCard>

        <DocumentationCard
          icon={<ShieldCheck size={24} />}
          title="Data Integrity & Safety"
          color="bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300"
        >
          <p>
            To avoid <strong>Data Leakage</strong>, we implemented a strict temporal split. Features are calculated strictly from activity before the prediction date (Day T).
          </p>
          <p>
            Labels (Churn/No Churn) are then derived from activity in the following month (T+1). This ensures that the high performance metrics reported are realistic and deployable in production environments.
          </p>
        </DocumentationCard>
      </div>

      <div className="glass p-10 md:p-16 rounded-[3rem] border border-slate-200 dark:border-slate-800 relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
          <FileCode size={200} className="text-indigo-600" />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-3 space-y-6">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Project Context</h3>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              This dashboard is a visualization suite for the <strong>WSDM - KKBox's Churn Prediction Challenge</strong>. KKBox, Asia's leading music provider, faces massive churn pressure. By predicting churn 30 days in advance, the business can shift from reactive retention to proactive engagement.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <a
                href="https://www.kaggle.com/c/kkbox-churn-prediction-challenge"
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-2 px-8 py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                <span>View on Kaggle</span>
                <ExternalLink size={14} />
              </a>
              <button className="flex items-center space-x-2 px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                <Download size={14} />
                <span>Full Tech PDF</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
             <div className="p-6 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Training Metrics</p>
                <div className="space-y-4">
                  {[
                    { label: 'Train Samples', val: '2.8M' },
                    { label: 'Validation ROC-AUC', val: '0.912' },
                    { label: 'Feature Count', val: '99' }
                  ].map((stat, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/50 pb-2 last:border-0">
                      <span className="text-xs font-bold text-slate-500">{stat.label}</span>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{stat.val}</span>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
