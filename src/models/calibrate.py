#!/usr/bin/env python3
import argparse, json, os, numpy as np, pandas as pd, pyarrow.parquet as pq
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import log_loss, roc_auc_score

def prep(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["bd"] = df["bd"].clip(10, 80).fillna(30)
    for c in ["logs_30d","secs_30d","unq_30d","tx_count_total","cancels_total"]:
        df[c] = np.log1p(df[c].fillna(0))
    return df

def main():
    import xgboost as xgb
    ap = argparse.ArgumentParser()
    ap.add_argument("--val", default="data/val.parquet")
    ap.add_argument("--model", default="models/xgb.json")
    ap.add_argument("--out", default="models/calibrator_isotonic.npz")
    ap.add_argument("--metrics", default="eval/calibration_metrics.json")
    args = ap.parse_args()

    val = pq.read_table(args.val).to_pandas()
    y = val["is_churn"].astype(int).to_numpy()
    val = prep(val)
    feats = ["plan_days_latest","auto_renew_latest","cancels_total","tx_count_total","logs_30d","secs_30d","unq_30d","bd"]

    bst = xgb.Booster(model_file=args.model)
    dva = xgb.DMatrix(val[feats].fillna(0), feature_names=feats)
    p = bst.predict(dva)

    iso = IsotonicRegression(out_of_bounds="clip").fit(p, y)
    p_cal = iso.transform(p)

    os.makedirs("models", exist_ok=True)
    np.savez(args.out, x=iso.X_thresholds_, y=iso.y_thresholds_)

    os.makedirs("eval", exist_ok=True)
    m = {
        "pre_logloss": float(log_loss(y, p)),
        "pre_auc": float(roc_auc_score(y, p)),
        "post_logloss": float(log_loss(y, p_cal)),
        "post_auc": float(roc_auc_score(y, p_cal)),
        "val_base_rate": float(y.mean()),
        "mean_prob_pre": float(np.mean(p)),
        "mean_prob_post": float(np.mean(p_cal)),
    }
    open(args.metrics, "w").write(json.dumps(m, indent=2))
    print("Calibration metrics:", m)

if __name__ == "__main__":
    main()