import React from 'react';
import { Link } from 'react-router-dom';
import { MoveRight } from 'lucide-react';
import { IS_STATIC } from '../services/apiService';

/**
 * A plain-language tour of the project for a first-time visitor.
 *
 * Every figure here names the file it comes from, and the tuned-validation
 * figure is called that, never "held-out" (AGENTS.md, Code Review Rules).
 */

const REPO = 'https://github.com/robertlupo1997/kkbox-churn-prediction';

const Step = ({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) => (
  <div className="brutalist-border dark:border-white bg-white dark:bg-zinc-900 p-6 brutalist-shadow">
    <div className="flex items-center gap-3 mb-4">
      <span className="bg-brand text-black w-8 h-8 flex items-center justify-center font-black brutalist-border">
        {n}
      </span>
      <h3 className="text-lg font-black uppercase tracking-tight dark:text-white">{title}</h3>
    </div>
    <div className="text-[13px] font-medium leading-relaxed space-y-3 text-zinc-700 dark:text-zinc-300">
      {children}
    </div>
  </div>
);

const Source = ({ path }: { path: string }) => (
  <a
    href={`${REPO}/blob/main/${path}`}
    target="_blank"
    rel="noopener noreferrer"
    className="font-mono text-[11px] underline decoration-brand"
  >
    {path}
  </a>
);

const HowItWorks: React.FC = () => (
  <div className="space-y-12">
    <section className="max-w-3xl">
      <div className="inline-block bg-brand px-3 py-1 brutalist-border mb-6">
        <span className="text-[10px] font-black uppercase tracking-widest text-black">
          How this works
        </span>
      </div>
      <h2 className="text-4xl sm:text-6xl font-black tracking-tighter leading-[0.9] mb-6 dark:text-white">
        Which subscribers are about to leave, and why?
      </h2>
      <p className="text-[16px] font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
        KKBOX is a music streaming service. This project predicts which subscribers will not renew
        within 30 days of their membership ending, gives each one a probability, and shows which of
        their habits pushed that probability up or down. It uses the public{' '}
        <a
          href="https://www.kaggle.com/c/kkbox-churn-prediction-challenge"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-brand"
        >
          WSDM KKBOX churn dataset
        </a>
        .
      </p>
      <Link
        to="/lookup"
        className="mt-8 inline-flex items-center gap-3 bg-black text-white dark:bg-white dark:text-black px-6 py-4 font-black uppercase tracking-widest text-[11px] brutalist-border hover:bg-brand hover:text-black transition-colors"
      >
        Try it on a real member <MoveRight size={16} />
      </Link>
    </section>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Step n={1} title="Features that cannot see the future">
        <p>
          SQL in DuckDB turns transactions and listening logs into 121 numbers per member: how often
          they paid, cancelled, auto-renewed, and listened over the last 7 to 90 days.
        </p>
        <p>
          Every window stops at the prediction date. Tests plant fake events on both sides of that
          date and check that only the earlier ones are counted (
          <Source path="tests/test_temporal_safety.py" />).
        </p>
      </Step>

      <Step n={2} title="A model that ranks well">
        <p>
          A gradient-boosted tree model (XGBoost) scores each member. On 1,995 members it never
          trained on, it puts a leaver above a stayer 97.65% of the time (AUC 0.9765,{' '}
          <Source path="models/training_metrics.json" />
          ).
        </p>
        <p>
          Those members come from the same 10,000-member sample and the same month as its training
          data, so this is not a test on a later, untouched period. The repository has no such
          test.
        </p>
      </Step>

      <Step n={3} title="Probabilities you can take literally">
        <p>
          A raw model score of 0.3 does not have to mean a 30% chance. An isotonic calibrator maps
          raw scores closer to how often members actually left. It was fitted on out-of-fold
          predictions for the training members and checked on the 1,995 holdout members (
          <Source path="models/calibration_metrics.json" />
          ). Every score shown here is the calibrated one.
        </p>
      </Step>

      <Step n={4} title="An explanation for every member">
        <p>
          SHAP splits each member&apos;s score into one contribution per feature. The
          contributions add up exactly to the model&apos;s output, and the page checks that sum
          before drawing anything. If it does not add up, the page shows nothing rather than a
          guess.
        </p>
      </Step>
    </div>

    <section className="max-w-3xl brutalist-border dark:border-white bg-light dark:bg-zinc-800 p-6 space-y-3">
      <h3 className="text-lg font-black uppercase tracking-tight dark:text-white">
        What this does not show
      </h3>
      <ul className="list-disc pl-5 text-[13px] font-medium leading-relaxed space-y-2 text-zinc-700 dark:text-zinc-300">
        <li>
          {IS_STATIC
            ? 'This page has no server. Every score and explanation was calculated once by the served model and saved; nothing is computed while you browse.'
            : 'Scores come from the running API.'}
        </li>
        <li>
          The often-quoted AUC 0.9696 is an older full-data LightGBM result measured on the same
          month used to tune it, a tuned-validation figure (
          <Source path="models/archive/full-data-training_metrics.json" />
          ). It describes no model on this page.
        </li>
        <li>
          The suggested retention actions come from fixed rules and have never been tested on real
          customers.
        </li>
        <li>
          Everything the project does not do is listed in <Source path="LIMITATIONS.md" />.
        </li>
      </ul>
    </section>
  </div>
);

export default HowItWorks;
