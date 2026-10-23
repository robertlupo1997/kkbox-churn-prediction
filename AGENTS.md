# KKBOX Churn Prediction — agent notes

Project guide: [`CLAUDE.md`](CLAUDE.md). Before quoting any metric, read [`LIMITATIONS.md`](LIMITATIONS.md); where they conflict, `LIMITATIONS.md` is correct.

## Code Review Rules

- Flag a quoted or published performance figure (AUC, log loss, Brier, lift in docs, README, the dashboard, or API responses) that does not name the metrics file it comes from, or that calls a tuned-validation figure "held-out" or "test". Code that computes metrics, synthetic test expectations, and the metrics files themselves are exempt.
- Flag a change to feature SQL or Python that can read events after the observation cutoff unless some test runs that changed feature code against fabricated post-cutoff events and asserts they are excluded (for example `tests/test_temporal_safety.py` or `tests/test_feature_windows.py`).
- Flag a change to the served model or the API metrics path that silently swaps which metrics file is served.
