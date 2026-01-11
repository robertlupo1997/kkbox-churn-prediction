# KKBOX Churn Analysis Dashboard

Brutalist-aesthetic React dashboard for visualizing churn predictions and model performance.

## Features

- **Dashboard**: KPI cards, risk distribution charts, member monitoring table
- **Member Lookup**: Search members, view SHAP explanations for predictions
- **Model Performance**: AUC comparison, calibration curves, lift/gains charts
- **Feature Importance**: SHAP beeswarm plots, grouped feature analysis
- **ROI Calculator**: Interactive business impact projections

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

The dashboard can run standalone with sample data or connect to the FastAPI backend:

- **Standalone**: Uses 200 sample members from `data/sampleMembers.json`
- **With API**: Connects to `http://localhost:8000` for live predictions

Set `VITE_API_URL` environment variable to configure the backend URL.

## Build

```bash
npm run build    # Output to dist/
npm run preview  # Preview production build
```
