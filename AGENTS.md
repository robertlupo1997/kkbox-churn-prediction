# KKBOX Churn Prediction — agent notes

Project guide: [`CLAUDE.md`](CLAUDE.md). Before quoting any metric, read [`LIMITATIONS.md`](LIMITATIONS.md); where they conflict, `LIMITATIONS.md` is correct.

## Code Review Rules

- Flag any metric a diff adds or changes (AUC, log loss, Brier, lift) that does not name the file it comes from, or that calls a tuned-validation figure "held-out" or "test".
- Flag feature SQL or Python that can read events after the observation cutoff without a test in `tests/test_temporal_safety.py` that proves they are excluded.
- Flag a change to the served model or the API metrics path that silently swaps which metrics file is served.
