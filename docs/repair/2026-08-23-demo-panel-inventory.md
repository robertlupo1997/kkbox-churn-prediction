# Panel inventory — every visible panel in the demo client, wave 3

Rule (brief): each panel gets exactly one fate — regenerate from identified evidence, label
explicitly as illustrative ON the panel, or remove. "Live" below means served by the running API.

| # | Surface / panel | Data source before | Fate applied | Where |
|---|---|---|---|---|
| 1 | Member Lookup: search box + results | bundled `sampleMembers.json` | **Regenerated** — server-side `q=` search over the served holdout population (`GET /api/members?q=`) | `MemberLookup.tsx` |
| 2 | Member Lookup: risk score ticket | bundled static score rendered even on API success | **Regenerated** — served calibrated `risk_score` only | `MemberLookup.tsx` |
| 3 | Member Lookup: SHAP waterfall | `generateMockSHAPFactors()` on failure | **Regenerated** — `POST /api/shap`; on failure says "explanation unavailable"; `checkShapReconciles` rejects any explanation not additive to the score (also rejects the API's `is_approximate` fallback) and draws nothing | `MemberLookup.tsx`, `ShapWaterfall.tsx`, `apiService.ts` |
| 4 | Dashboard KPI cards (rows/churners/churn rate/exposure) | bundled `dashboardKPIs` (static export) | **Labeled** — page banner: illustrative static export, not the served model; live scoring points to Member Lookup | `Dashboard.tsx` |
| 5 | Dashboard risk-distribution chart + member table + CSV export | bundled `riskDistribution.json` / `sampleMembers.json` | **Labeled** — same banner | `Dashboard.tsx` |
| 6 | Model Performance: AUC comparison, calibration impact, reliability curves, metric cards, statistical insight | bundled `modelMetrics.json` / `calibrationCurves.json` (dead 131-feature full-data regime) | **Labeled** — page banner: historical archived tuned-validation figures, describe no served model; live numbers at `/api/metrics` | `ModelPerformance.tsx` |
| 7 | Ensemble Weights panel | bundled `ensembleWeights.json` (archived stacked ensemble) | **Labeled** — covered by the page banner (#6) | `ModelPerformance.tsx` |
| 8 | Lift / Gains curve | bundled synthetic export | **Labeled** — page banner (#6) | `ModelPerformance.tsx` |
| 9 | Precision-recall curve with threshold slider | bundled synthetic export | **Labeled** — page banner (#6) | `ModelPerformance.tsx` |
| 10 | Feature ranking header + grouped importance bars | bundled `featureImportance.json` (131-feature regime) | **Labeled** — on-panel line: "Historical figure set … describes no served model", pointing at `/api/features/importance` for live values | `FeatureImportanceView.tsx` |
| 11 | "Training samples" quick stat | stale `datasetStats.train_samples` | **Removed** — dead-regime number with no honest meaning next to live panels | `FeatureImportanceView.tsx` |
| 12 | SHAP beeswarm | `Math.random()` point cloud presented as SHAP | **Removed** from render — random noise is not made honest by a disclaimer. Per-member attribution lives in Member Lookup behind the reconciliation gate (#3) | `FeatureImportanceView.tsx` (component file kept, unrendered) |
| 13 | ROI calculator | user-supplied assumptions, outputs labeled "Assumed …" | **No change** — already honest: every output derives from visible user inputs | `ROICalculator.tsx` |
| 14 | Soundwave header animation | decorative canvas animation | **No change** — decoration, presents no data | `Soundwave.tsx` |
| 15 | About page copy | prose | **Corrected** — "serves raw XGBoost scores" replaced with the applied-calibrator truth | `About.tsx` |

## Not panels but load-bearing for honesty

- `apiService.ts` base URL: same-origin by default (`VITE_API_URL ?? ''`) — matches the Dockerfile,
  which builds this app into the API's `./static`.
- Health probe: `/api/health` JSON plus a population probe; an empty member table reads as
  unavailable, which is how the old demo looked connected while serving nothing.
- Member ids never travel in a path segment (4,927 of 10,000 contain `/`): lookup and SHAP use
  request bodies; search uses a query parameter.
