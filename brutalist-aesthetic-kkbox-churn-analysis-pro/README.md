# KKBOX Churn Analysis Dashboard

Brutalist-aesthetic React dashboard for visualizing churn predictions and model performance. It
renders exported JSON artifacts from the ML pipeline; see [../LIMITATIONS.md](../LIMITATIONS.md).

## Pages

- **Dashboard**: KPI cards computed from exported aggregates, risk distribution charts, member table
- **Member Lookup**: Search the 200 checked-in sample members. The factor waterfall is an
  illustrative placeholder generated from the risk score, not model SHAP output. Several displayed
  member statistics (city, tenure, active days, auto-renew) are exporter placeholders rather than
  real member data.
- **Model Performance**: AUC comparison, calibration curves, lift/gains charts from exported JSON
- **Feature Importance**: Grouped XGBoost importance, plus a beeswarm whose points are generated
  synthetically from global importance values — it does not show sample-level SHAP values
- **Retention Savings Projection**: Gross revenue retained under user-supplied assumptions. It does
  not model campaign cost, treatment reach, or incremental uplift, so it is not an ROI calculation.

## Quick Start

```bash
npm install
npm run dev    # http://localhost:3000
```

## Tech Stack

- React 19 + TypeScript 5.8
- Vite 6 (build tool)
- Tailwind CSS (styling)
- Recharts (visualizations)
- Framer Motion (animations)

## API Integration

The dashboard currently runs from checked-in sample data.

- **Standalone (current behaviour)**: Uses 200 sample members from `data/sampleMembers.json`
- **With API**: not working as written. The health check requests `/health` while the backend
  exposes `/api/health`, and member prediction requests `GET /api/predict/{id}` while the backend
  exposes `POST /api/predictions/single`. When these calls fail the UI silently falls back to the
  bundled samples and placeholder explanation factors.

`VITE_API_URL` configures the backend URL, but Vite substitutes it at build time; setting it only as
a runtime environment variable (as `docker-compose.yml` does) has no effect on the compiled client.

## Build

```bash
npm run build    # Output to dist/
npm run preview  # Preview production build
```
