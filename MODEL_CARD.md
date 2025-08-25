# Model Card — KKBOX Churn

Owner
- Robert "Trey" Lupo

Intended use
- Predict churn risk one month ahead for paid subscribers.
- Support retention actions and budgeting.

Not for
- Credit decisions or legal judgments.

Data
- Source. KKBOX competition tables.
- Period. 2015–2017 focus months in the release.
- Label. 30-day rule after membership expiry. See CITES.md.
- Splits. Time-ordered. Train on an earlier month. Validate on a later month.

Features
- Transactions. renewals, plan days, list price, paid, discount, payment method, auto_renew, cancel, tenure.
- Usage. active days, total seconds, unique songs, completion ratios.
- Members. registration method, city/region, age bucket.
- As-of windows. 90-day and 30-day lookbacks. No future joins.

Target
- Binary is_churn. 1 = churn, 0 = renew.

Training
- Baselines. mean, logistic.
- Main. XGBoost with early stopping.
- Seeds and env. Saved in eval/run_env.json.

Calibration
- Method. isotonic regression on a held month.
- Goal. better probability reliability and lower log loss.

Evaluation
- Primary. log loss.
- Secondary. ROC AUC, Brier score.
- Plots. ROC, reliability, gain.
- Stability. rolling backtests across three month windows.
- Uncertainty. bootstrap CIs for log loss and AUC.

Interpretability
- SHAP global bar. SHAP local waterfall per member.
- Top factors saved with each score.

Risk and bias
- No sensitive fields.
- Drift checks. PSI by feature and score each month.
- Failure modes. long gaps in logs, promo spikes, data shifts.

Limits
- Public benchmark only. No real-time serving or PII.
- Generalization outside data period is not guaranteed.

Versioning
- Model. models/xgb.json
- Calibrator. models/calibrator_isotonic.pkl
- Dataset hash. eval/run_env.json

Contacts
- Issues in the repo. Email listed in the repo profile.