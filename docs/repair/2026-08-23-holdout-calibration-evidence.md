# Evidence — deterministic holdout split, holdout-only surface, applied calibrator
Date: 2026-08-23 (wave 3). HEAD at run: a446e10. All commands executed from the worktree venv.

## 1. Split membership is reproducible from committed inputs

Recomputed `int(sha256(msno)[:8],16)/2**32 < 0.2` over the committed
`eval/app_features.csv` (10,000 rows) and compared to `eval/serving_split.json`:

```
1. split deterministic: 1995 holdout msnos match artifact exactly
```

The previous seed-42 stratified split could not be re-derived from any committed input.

## 2. Served scores are calibrated: independent recomputation

For holdout members sampled across the population, the raw booster probability was computed
directly from `models/xgb.json` + the CSV row (same preprocessing as `model_service.predict`),
then mapped through the persisted knots (`np.interp`, == isotonic predict under
`out_of_bounds="clip"`), and compared against what the running API returned:

```
2. +18dgxQAG4... raw=0.988908 calibrated=0.989323843 served=0.989323843 OK
2. 8BuL41SSQ+... raw=0.000820 calibrated=0.000000000 served=0.000000000 OK
2. HNXj397ol+... raw=0.047376 calibrated=0.046357616 served=0.046357616 OK
2. RJCRI5i6lI... raw=0.001270 calibrated=0.000000000 served=0.000000000 OK
2. bGZf93q9gx... raw=0.012826 calibrated=0.019607843 served=0.019607843 OK
2. kgKQzS/+c3... raw=0.001022 calibrated=0.000000000 served=0.000000000 OK
2. unlopEPZdl... raw=0.003386 calibrated=0.002617801 served=0.002617801 OK
```

Served number == advertised calibration quantity. Note the calibrator slightly WORSENS
holdout Brier here (uncalibrated 0.04275 -> calibrated 0.04303); it is applied for semantic
consistency with the calibration claims, fit out-of-fold on the training split only, and both
numbers are recorded in the artifacts rather than hidden.

## 3. Holdout-only surface is enforced

```
3. population total=1995; training-only msno: search hits=0, predictions/single HTTP 404
```

A training-split msno is not listable, not searchable, and not predictable through the demo
surface. `POST /api/predictions/single` request/response contract is unchanged; its reachable
population narrows to the same serving surface by design (brief decision 2).

## 4. Suite at this state

```
8 failed, 74 passed
```
The 8 failures are exactly the pre-existing LIMITATIONS §8 label-boundary set
(tests/test_labels.py x6, tests/test_feature_windows.py x2). No test weakened, skipped,
or deleted.
