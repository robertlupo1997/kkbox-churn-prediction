#!/usr/bin/env python3
import argparse
import json
import os

import numpy as np
import pandas as pd
import pyarrow.parquet as pq


def prep(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["bd"] = df["bd"].clip(10, 80).fillna(30)
    for c in ["logs_30d", "secs_30d", "unq_30d", "tx_count_total", "cancels_total"]:
        df[c] = np.log1p(df[c].fillna(0))
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", default="data/train.parquet")
    ap.add_argument("--val", default="data/val.parquet")
    ap.add_argument("--out", default="eval/xgb_metrics.json")
    ap.add_argument("--rounds", type=int, default=600)
    ap.add_argument("--early-stopping", type=int, default=50)
    args = ap.parse_args()

    train = pq.read_table(args.train).to_pandas()
    val = pq.read_table(args.val).to_pandas()
    print(f"Train: {len(train):,} | Val: {len(val):,}")
    print(f"Train churn: {train['is_churn'].mean():.3f} | Val churn: {val['is_churn'].mean():.3f}")

    train = prep(train)
    val = prep(val)

    feats = [
        "plan_days_latest",
        "auto_renew_latest",
        "cancels_total",
        "tx_count_total",
        "logs_30d",
        "secs_30d",
        "unq_30d",
        "bd",
    ]
    X_tr = train[feats].fillna(0)
    y_tr = train["is_churn"].astype(int).to_numpy()
    X_va = val[feats].fillna(0)
    y_va = val["is_churn"].astype(int).to_numpy()

    # Lazy import/install to keep this file self-contained
    try:
        import xgboost as xgb
        from sklearn.metrics import log_loss, roc_auc_score
    except Exception:
        os.system("python3 -m pip install --break-system-packages xgboost scikit-learn")
        import xgboost as xgb
        from sklearn.metrics import log_loss, roc_auc_score

    dtr = xgb.DMatrix(X_tr, label=y_tr, feature_names=feats)
    dva = xgb.DMatrix(X_va, label=y_va, feature_names=feats)

    params = {
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "eta": 0.08,
        "max_depth": 5,
        "min_child_weight": 5,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "lambda": 1.0,
        "gamma": 0.0,
        "seed": int(os.getenv("RUN_SEED", "42")),
        "tree_method": "hist",
    }
    evals = [(dtr, "train"), (dva, "val")]
    bst = xgb.train(
        params,
        dtr,
        args.rounds,
        evals=evals,
        early_stopping_rounds=args.early_stopping,
        verbose_eval=50,
    )

    p_va = bst.predict(dva)
    from sklearn.metrics import log_loss, roc_auc_score

    metrics = {
        "best_iteration": int(bst.best_iteration or 0),
        "logloss": float(log_loss(y_va, p_va)),
        "auc": float(roc_auc_score(y_va, p_va)),
        "mean_prob": float(np.mean(p_va)),
        "pos_rate_val": float(np.mean(y_va)),
        "n_train": int(len(y_tr)),
        "n_val": int(len(y_va)),
    }
    print("XGB metrics:", metrics)

    os.makedirs("eval", exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(metrics, f, indent=2)

    os.makedirs("models", exist_ok=True)
    bst.save_model("models/xgb.json")


if __name__ == "__main__":
    main()
