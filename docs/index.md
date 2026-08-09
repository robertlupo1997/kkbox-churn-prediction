# KKBOX Churn

* Churn modelling on the WSDM KKBOX Churn Prediction Challenge: DuckDB point-in-time feature SQL,
  gradient-boosted models evaluated on a later time window, isotonic calibration, a FastAPI service,
  and a React dashboard.
* The dashboard runs from checked-in exported JSON and 200 sample members. Its explanation factors
  are illustrative placeholders, not model SHAP values, and its live-API request paths do not match
  the FastAPI routes.
* Metric JSON is checked in. The plot files in `eval/` are Git LFS pointers in this checkout, and
  `eval/backtests.csv` is empty because the backtest driver never calls its evaluation step.
* Read [LIMITATIONS.md](../LIMITATIONS.md) before quoting any number from this project.

Links

* App
* Video
* Repo
* Citations
