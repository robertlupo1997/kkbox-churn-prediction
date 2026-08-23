#!/usr/bin/env python3
"""Rebuild the serving artifacts so the model and the feature table agree.

Why this script exists
----------------------
``models/xgb.json`` declared 131 named features while ``eval/app_features.csv``
carried only 99 predictors (a strict subset).  ``tests/test_artifact_contract.py``
makes that mismatch executable.  This script repairs it honestly:

1. It derives the missing features that ``features/features_comprehensive.sql``
   defines as *deterministic transforms of columns already present* in
   ``eval/app_features.csv``, using the exact SQL formulas (including COALESCE
   semantics). 22 of the 32 qualify: ``std_unq_prev_mo`` also qualifies in
   principle but its only operand ``std_unq_30d`` is itself absent from the
   shipped table, so it cannot be computed.
2. The remaining 9 model features are historical churn lags
   (last_1..5_is_churn, transaction_count, churn_count, churn_rate,
   months_since_last_churn) that require monthly label history which is not
   reproducible from anything in this repository (LIMITATIONS.md section 6).
   They are dropped, and the new models are trained on the 122 features that ARE
   real and present (121 columns).
3. XGBoost and LightGBM are retrained on a stratified 80/20 holdout of the
   serving sample (seed 42), using the tuned hyperparameters in
   ``models/best_hyperparameters.json``.
4. ``models/training_metrics.json`` and ``models/calibration_metrics.json`` are
   rewritten so every recorded number describes exactly the artifacts being
   served, measured on the holdout - including real reliability-diagram points,
   so the API no longer fabricates calibration curves.

Run:  python3 scripts/rebuild_serving_artifacts.py
"""

from __future__ import annotations

import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.calibration import IsotonicRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split

ROOT = Path(__file__).resolve().parent.parent
FEATURES_IN = ROOT / "eval" / "app_features.csv"
FEATURES_OUT = ROOT / "eval" / "app_features.csv"
XGB_OUT = ROOT / "models" / "xgb.json"
LGB_OUT = ROOT / "models" / "lgb.txt"
METRICS_OUT = ROOT / "models" / "training_metrics.json"
CALIB_OUT = ROOT / "models" / "calibration_metrics.json"
HPARAMS = ROOT / "models" / "best_hyperparameters.json"

META = ["msno", "is_churn", "cutoff_ts"]
SEED = 42

# The 9 historical churn-lag features that cannot be regenerated from the
# shipped sample (documented in LIMITATIONS.md section 6).
DROPPED_HISTORICAL = [
    "last_1_is_churn", "last_2_is_churn", "last_3_is_churn", "last_4_is_churn",
    "last_5_is_churn", "transaction_count", "churn_count", "churn_rate",
    "months_since_last_churn",
]


def coalesce(series: pd.Series, default: float) -> pd.Series:
    """SQL COALESCE(col, default) semantics."""
    return series.fillna(default)


def derive_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add the 23 derivable features with the exact comprehensive-SQL formulas."""
    out = df.copy()

    # tx90.* aliases (COALESCE defaults copied from the SQL)
    latest_auto_renew = coalesce(out["latest_auto_renew"], 0)
    cancel_count_90d = coalesce(out["cancel_count_90d"], 0)
    avg_discount_90d = coalesce(out["avg_discount_90d"], 0)
    avg_paid_90d = coalesce(out["avg_paid_90d"], 0)
    avg_plan_days_90d = coalesce(out["avg_plan_days_90d"], 0)
    tx_count_90d = coalesce(out["tx_count_90d"], 0)
    cancel_ratio_90d = coalesce(out["cancel_ratio_90d"], 0)
    auto_renew_ratio_90d = coalesce(out["auto_renew_ratio_90d"], 0)
    unique_payment_methods_90d = coalesce(out["unique_payment_methods_90d"], 1)
    days_since_last_tx = coalesce(out["days_since_last_tx"], 90)
    latest_plan_days = coalesce(out["latest_plan_days"], 30)
    membership_days_remaining = out["membership_days_remaining"]

    # log*.sql aliases
    total_unq_14d = coalesce(out["total_unq_14d"], 0)
    total_unq_30d = coalesce(out["total_unq_30d"], 0)
    total_secs_30d = coalesce(out["total_secs_30d"], 0)
    total_secs_60d = coalesce(out["total_secs_60d"], 0)
    total_secs_90d = coalesce(out["total_secs_90d"], 0)
    total_unq_90d = coalesce(out["total_unq_90d"], 0)
    std_secs_30d = coalesce(out["std_secs_30d"], 0)
    std_unq_30d = coalesce(out["std_unq_30d"], 0) if "std_unq_30d" in out.columns else None
    avg_secs_per_day_30d = coalesce(out["avg_secs_per_day_30d"], 0)
    active_days_90d = coalesce(out["active_days_90d"], 0)
    active_days_30d = coalesce(out["active_days_30d"], 0)
    active_days_7d = coalesce(out["active_days_7d"], 0)
    days_since_last_listen = coalesce(out["days_since_last_listen"], 90)

    # --- winner-inspired block ---
    out["autorenew_not_cancel"] = (
        (latest_auto_renew == 1) & (cancel_count_90d == 0)
    ).astype(float)

    out["discount"] = avg_discount_90d

    out["amt_per_day"] = np.where(avg_plan_days_90d > 0, avg_paid_90d / avg_plan_days_90d.replace(0, np.nan), 0.0)
    out["amt_per_day"] = out["amt_per_day"].fillna(0.0)

    out["canc_per_payment_days"] = np.where(
        avg_plan_days_90d > 0,
        cancel_count_90d * 1.0 / avg_plan_days_90d.replace(0, np.nan),
        0.0,
    )
    out["canc_per_payment_days"] = out["canc_per_payment_days"].fillna(0.0)

    out["unq_trend_14v30"] = total_unq_14d - total_unq_30d * 0.467

    denom = total_secs_60d * 0.5 + 1
    ratio = (total_secs_30d - total_secs_60d * 0.5) / denom
    out["listening_trend_ratio"] = np.where(total_secs_60d > 0, ratio, 0.0)

    out["secs_cv_30d"] = std_secs_30d / (avg_secs_per_day_30d + 1)

    out["days_since_tx_per_plan"] = np.where(
        latest_plan_days > 0,
        days_since_last_tx * 1.0 / latest_plan_days.replace(0, np.nan),
        3.0,
    )
    out["days_since_tx_per_plan"] = out["days_since_tx_per_plan"].fillna(3.0)

    out["last_trx_gt1_no_cancel"] = ((tx_count_90d > 1) & (cancel_count_90d == 0)).astype(float)

    out["ul_last2wk_vs_month_unq_ratio"] = np.where(
        total_unq_30d > 0,
        (total_unq_14d * 2.143) / total_unq_30d.replace(0, np.nan) - 1,
        0.0,
    )
    out["ul_last2wk_vs_month_unq_ratio"] = out["ul_last2wk_vs_month_unq_ratio"].fillna(0.0)

    mo_diff = total_secs_60d - total_secs_30d
    mo_ratio = total_secs_30d / (mo_diff + 1)
    out["listening_mo1_mo2_trend"] = np.where(mo_diff > 0, mo_ratio, 0.0)

    # std_unq_prev_mo needs log30.std_unq_30d, which the shipped table does not
    # carry; it stays out unless a future table provides that operand.
    if "std_unq_30d" in out.columns:
        out["std_unq_prev_mo"] = coalesce(out["std_unq_30d"], 0)

    out["activity_density_90d"] = active_days_90d / 90.0
    out["activity_density_30d"] = active_days_30d / 30.0
    out["activity_density_7d"] = active_days_7d / 7.0

    out["usually_auto_renew"] = (auto_renew_ratio_90d > 0.5).astype(float)
    out["has_cancelled"] = (cancel_ratio_90d > 0).astype(float)

    out["secs_per_unq_song"] = np.where(
        total_unq_90d > 0,
        total_secs_90d / total_unq_90d.replace(0, np.nan),
        0.0,
    )
    out["secs_per_unq_song"] = out["secs_per_unq_song"].fillna(0.0)

    out["changed_payment_method"] = (unique_payment_methods_90d > 1).astype(float)

    out["discount_ratio"] = np.where(
        avg_paid_90d > 0,
        avg_discount_90d / avg_paid_90d.replace(0, np.nan),
        0.0,
    )
    out["discount_ratio"] = out["discount_ratio"].fillna(0.0)

    # expiry_urgency buckets on latest_expire_date - cutoff_ts; the shipped
    # table stores exactly that difference as membership_days_remaining.
    out["expiry_urgency"] = np.select(
        [membership_days_remaining < 0, membership_days_remaining <= 7, membership_days_remaining <= 30],
        [-1.0, 0.0, 1.0],
        default=2.0,
    )

    out["tx_recency_vs_plan"] = np.where(
        latest_plan_days > 0,
        days_since_last_tx / latest_plan_days.replace(0, np.nan),
        3.0,
    )
    out["tx_recency_vs_plan"] = out["tx_recency_vs_plan"].fillna(3.0)

    out["last_ul_days_s"] = days_since_last_listen

    return out


def reliability_points(y_true, probs, n_bins: int = 10) -> list[dict]:
    """Real reliability-diagram points (no synthesis)."""
    y_true = np.asarray(y_true, dtype=float)
    probs = np.asarray(probs, dtype=float)
    bins = np.clip((probs * n_bins).astype(int), 0, n_bins - 1)
    points = []
    for b in range(n_bins):
        mask = bins == b
        if mask.sum() == 0:
            continue
        points.append(
            {
                "mean_predicted": float(probs[mask].mean()),
                "fraction_of_positives": float(y_true[mask].mean()),
            }
        )
    return points


def main() -> None:
    df = pd.read_csv(FEATURES_IN)
    print(f"Loaded {len(df):,} rows x {len(df.columns)} cols from {FEATURES_IN}")

    df = derive_features(df)

    y = df["is_churn"].astype(int)
    predictors = [c for c in df.columns if c not in META]
    assert all(pd.api.types.is_numeric_dtype(df[c]) for c in predictors), \
        "all predictors must be numeric for DMatrix"

    # Stratified holdout split of the serving sample.
    idx_train, idx_val = train_test_split(
        np.arange(len(df)), test_size=0.2, random_state=SEED, stratify=y
    )
    X = df[predictors].astype(float).fillna(0.0)
    Xtr, Xva = X.iloc[idx_train], X.iloc[idx_val]
    ytr, yva = y.iloc[idx_train], y.iloc[idx_val]
    print(f"Train {len(Xtr):,} / holdout {len(Xva):,}; churn "
          f"{ytr.mean():.3f} / {yva.mean():.3f}; features={len(predictors)}")

    with open(HPARAMS) as f:
        hp = json.load(f)

    # ---- XGBoost ----
    dtrain = xgb.DMatrix(Xtr, label=ytr, feature_names=predictors)
    dval = xgb.DMatrix(Xva, label=yva, feature_names=predictors)
    xp = dict(hp["xgboost"])
    params = {
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "max_depth": int(xp.pop("max_depth")),
        "learning_rate": float(xp.pop("learning_rate")),
        "min_child_weight": float(xp.pop("min_child_weight")),
        "subsample": float(xp.pop("subsample")),
        "colsample_bytree": float(xp.pop("colsample_bytree")),
        "reg_alpha": float(xp.pop("reg_alpha")),
        "reg_lambda": float(xp.pop("reg_lambda")),
        "seed": SEED,
    }
    n_est = int(xp.pop("n_estimators"))
    bst = xgb.train(params, dtrain, num_boost_round=n_est)
    bst.save_model(str(XGB_OUT))
    xgb_probs = bst.predict(dval)

    # ---- LightGBM ----
    lp = dict(hp["lightgbm"])
    lb_params = {
        "objective": "binary",
        "max_depth": int(lp.pop("max_depth")),
        "learning_rate": float(lp.pop("learning_rate")),
        "num_leaves": int(lp.pop("num_leaves")),
        "min_child_samples": int(lp.pop("min_child_samples")),
        "subsample": float(lp.pop("subsample")),
        "colsample_bytree": float(lp.pop("colsample_bytree")),
        "reg_alpha": float(lp.pop("reg_alpha")),
        "reg_lambda": float(lp.pop("reg_lambda")),
        "seed": SEED,
        "verbose": -1,
    }
    n_est_l = int(lp.pop("n_estimators"))
    lgb_model = lgb.train(
        lb_params,
        lgb.Dataset(Xtr, label=ytr, feature_name=predictors, free_raw_data=False),
        num_boost_round=n_est_l,
    )
    lgb_model.save_model(str(LGB_OUT), num_iteration=lgb_model.best_iteration or n_est_l)
    lgb_probs = lgb_model.predict(Xva, num_iteration=lgb_model.best_iteration)

    def metrics_row(probs):
        return {
            "log_loss": float(log_loss(yva, probs)),
            "auc": float(roc_auc_score(yva, probs)),
            "brier": float(brier_score_loss(yva, probs)),
        }

    xgb_m = metrics_row(xgb_probs)
    lgb_m = metrics_row(lgb_probs)
    print("xgboost holdout:", xgb_m)
    print("lightgbm holdout:", lgb_m)

    gain = bst.get_score(importance_type="gain")
    importance = {k: float(v) for k, v in sorted(gain.items(), key=lambda kv: -kv[1])}

    # ---- isotonic calibration fit on TRAIN, evaluated on holdout ----
    # Fit the calibrator on OUT-OF-FOLD training-split predictions, so the
    # holdout never evaluates the calibrator on its own fitting data and the
    # calibrator itself is not fit on in-sample overconfident scores.
    oof = np.zeros(len(Xtr))
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    for tr_idx, ho_idx in skf.split(Xtr, ytr):
        dtr = xgb.DMatrix(Xtr.iloc[tr_idx], label=ytr.iloc[tr_idx], feature_names=predictors)
        dho = xgb.DMatrix(Xtr.iloc[ho_idx], feature_names=predictors)
        fold_bst = xgb.train(params, dtr, num_boost_round=n_est)
        oof[ho_idx] = fold_bst.predict(dho)

    iso = IsotonicRegression(out_of_bounds="clip")
    iso.fit(oof, ytr)
    cal_probs = iso.predict(xgb_probs)
    cal_m = metrics_row(cal_probs)
    print("calibrated holdout:", cal_m)

    metrics = {
        "split_type": "stratified_random_holdout_of_serving_sample",
        "note": (
            "Retrained serving models on eval/app_features.csv (10,000-member "
            "Feb-2017-cutoff sample). Holdout = 20% stratified, seed 42. These "
            "are NOT comparable to the archived tuned-validation numbers "
            "(LightGBM AUC 0.9696) which came from the full-data March-2017 "
            "window described in LIMITATIONS.md section 1."
        ),
        "train_windows": ["serving sample cutoff 2017-02-28"],
        "val_window": "stratified holdout of same sample",
        "train_samples": int(len(Xtr)),
        "val_samples": int(len(Xva)),
        "train_churn_rate": float(ytr.mean()),
        "val_churn_rate": float(yva.mean()),
        "feature_count": len(predictors),
        "dropped_historical_features": DROPPED_HISTORICAL,
        "models": {"xgboost": xgb_m, "lightgbm": lgb_m},
        "xgboost": {**xgb_m, "feature_importance": importance},
    }
    with open(METRICS_OUT, "w") as f:
        json.dump(metrics, f, indent=2)

    calibration = {
        "xgboost": {
            "method": "isotonic (fit on training split, evaluated on holdout)",
            "before": {"brier": xgb_m["brier"]},
            "after": {"brier": cal_m["brier"]},
            "uncalibrated": reliability_points(yva, xgb_probs),
            "calibrated": reliability_points(yva, cal_probs),
        }
    }
    with open(CALIB_OUT, "w") as f:
        json.dump(calibration, f, indent=2)

    # ---- write serving CSV: metadata first, predictors in canonical order ----
    out_df = df[META + predictors]
    out_df.to_csv(FEATURES_OUT, index=False)
    print(f"Wrote {len(out_df):,} rows x {len(out_df.columns)} cols -> {FEATURES_OUT}")
    print(f"Wrote {XGB_OUT}, {LGB_OUT}, {METRICS_OUT}, {CALIB_OUT}")


if __name__ == "__main__":
    main()
