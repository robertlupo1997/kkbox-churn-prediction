# Probe transcript — body/query transports for base64 msnos (wave-3 WIP verification)
Date: 2026-08-23T23:57:42Z. Server: uvicorn api.main:app booted from the worktree at the pre-commit WIP, port 8977.

Served population: "total":10000
Slash msno: 7yNW7DjZm54Syzx/Rc5sjG8oESwPNMV4xqevwK6/MWw=
Plus  msno: MmhjM8/EK5/M8v0+9i+IDam7Xr8vOBH5t4O2Uf7j5lM=

## Path transport is broken for slashed ids (confirms inbox finding)
- `GET /api/members/abc` -> `{"detail":"Member abc not found"}` (handler reached)
- `GET /api/members/<slash msno>` raw -> {"detail":"Not Found"}
- `GET /api/members/<slash msno %2F-encoded>` -> {"detail":"Not Found"}

## Body transport works
- `POST /api/members/lookup` slash msno: HTTP 200, "risk_score":0.9790422320365906
- `POST /api/members/lookup` plus msno: HTTP 200
- `POST /api/shap` slash msno: HTTP 200, explanation keys=['base_value', 'is_approximate', 'note', 'shap_values', 'top_protective_factors', 'top_risk_factors']

## Search runs on the server over the served population
- `GET /api/members?q=MmhjM8%2FEK5&limit=3` -> {"members":[{"msno":"MmhjM8/EK5/M8v0+9i+IDam7Xr8vOBH5t4O2Uf7j5lM=","risk_score":0.8077981472015381,"risk_tier":"High","is_churn":true,"top_risk_factors":["autorenew_not_cancel","last_trx_gt1_no_cancel","membership_days_r

## POST /api/predictions/single contract unchanged
{"msno":"7yNW7DjZm54Syzx/Rc5sjG8oESwPNMV4xqevwK6/MWw=","churn_probability":0.9790422320365906,"risk_tier":"High","action":"🚨 High-touch customer success intervention"}
(response keys msno/churn_probability/risk_tier/action — the WIP diff touches no prediction schema or router)
