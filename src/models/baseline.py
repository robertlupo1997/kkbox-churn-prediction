#!/usr/bin/env python3
import argparse, json, os
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score

ap = argparse.ArgumentParser()
ap.add_argument("--train", default="data/train.parquet")
ap.add_argument("--val", default="data/val.parquet")
ap.add_argument("--out", default="eval/baseline_metrics.json")
args = ap.parse_args()

train = pq.read_table(args.train).to_pandas()
val = pq.read_table(args.val).to_pandas()

print(f"Train: {len(train):,} rows, churn rate: {train['is_churn'].mean():.3f}")
print(f"Val: {len(val):,} rows, churn rate: {val['is_churn'].mean():.3f}")

# Feature preprocessing: clip bd, log-transform heavy-tailed counts  
train["bd"] = train["bd"].clip(10, 80).fillna(30)
val["bd"] = val["bd"].clip(10, 80).fillna(30)

for c in ["logs_30d","secs_30d","unq_30d","tx_count_total","cancels_total"]:
    train[c] = np.log1p(train[c].fillna(0))
    val[c] = np.log1p(val[c].fillna(0))

y_tr = train["is_churn"].astype(int).to_numpy()
y_va = val["is_churn"].astype(int).to_numpy()

feats = [
  "plan_days_latest","auto_renew_latest","cancels_total","tx_count_total",
  "logs_30d","secs_30d","unq_30d","bd"   # note: city removed (categorical)
]
X_tr = train[feats].fillna(0).to_numpy()
X_va = val[feats].fillna(0).to_numpy()

model = Pipeline([
  ("scaler", StandardScaler()),
  ("clf", LogisticRegression(max_iter=1000, class_weight="balanced", n_jobs=1)),
])
model.fit(X_tr, y_tr)
p_va = model.predict_proba(X_va)[:, 1]

os.makedirs("eval", exist_ok=True)

# Single feature AUC probe to confirm signal
auto_renew_auc = roc_auc_score(y_va, val["auto_renew_latest"].fillna(0))
print(f"AUC(auto_renew_latest only): {auto_renew_auc:.4f}")

metrics = {
  "logloss": float(log_loss(y_va, p_va)),
  "auc": float(roc_auc_score(y_va, p_va)),
  "mean_prob": float(np.mean(p_va)),
  "pos_rate_val": float(np.mean(y_va)),
  "n_train": int(len(y_tr)),
  "n_val": int(len(y_va)),
  "auto_renew_auc": float(auto_renew_auc)
}
print("Final metrics:", metrics)
open(args.out, "w").write(json.dumps(metrics, indent=2))