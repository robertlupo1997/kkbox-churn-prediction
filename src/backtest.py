#!/usr/bin/env python3
"""
Rolling backtests for KKBOX churn.
- Uses your leak-safe SQL to build features as-of a cutoff date
- Rebuilds labels via the same 30-day rule semantics used in src/labels.py (validation optional)
- Evaluates saved models across windows and writes eval/backtests.csv

Windows are defined as pairs:
    cutoff_date: features as-of this date (inclusive)
    expire_month: YYYY-MM (the month of membership_expire_date to label on)

Example default windows:
    Jan→Feb : cutoff 2017-01-31, expire_month 2017-02
    Feb→Mar : cutoff 2017-02-28, expire_month 2017-03
    Mar→Apr : cutoff 2017-03-31, expire_month 2017-04
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
from datetime import date, datetime
import numpy as np
import pandas as pd
import duckdb
from sklearn.metrics import log_loss, roc_auc_score, brier_score_loss

# ---- Small helpers
def parse_month(s: str) -> tuple[int,int]:
    y,m = s.split("-"); return int(y), int(m)

def month_bounds(ym: str) -> tuple[date,date]:
    y,m = parse_month(ym)
    first = date(y,m,1)
    if m == 12: last = date(y+1,1,1) - pd.Timedelta(days=1)
    else: last = date(y,m+1,1) - pd.Timedelta(days=1)
    return first, last

def end_of_prev_month(d: date) -> date:
    return (pd.Timestamp(d.replace(day=1)) - pd.Timedelta(days=1)).date()

def expected_calibration_error(y, p, n_bins=15):
    bins = np.linspace(0,1,n_bins+1)
    idx = np.digitize(p, bins) - 1
    ece, N = 0.0, len(y)
    for b in range(n_bins):
        mask = idx==b
        if not mask.any(): continue
        conf = p[mask].mean()
        acc  = y[mask].mean()
        ece += (mask.sum()/N) * abs(acc-conf)
    return float(ece)

# ---- Feature build
def build_features(con: duckdb.DuckDBPyConnection, sql_path: Path, cutoff: date,
                   train_path: Path, transactions_path: Path, user_logs_path: Path, members_path: Path) -> pd.DataFrame:
    sql = Path(sql_path).read_text()
    sql = (sql
        .replace("${train_path}", str(train_path))
        .replace("${transactions_path}", str(transactions_path))
        .replace("${user_logs_path}", str(user_logs_path))
        .replace("${members_path}", str(members_path))
        .replace("DATE '2017-02-28'", f"DATE '{cutoff.isoformat()}'")
    )
    return con.execute(sql).fetchdf()

# ---- Label build (Scala semantics)
def labels_for_expire_month(con, transactions_csv: Path, expire_month: str, window_days: int=30) -> pd.DataFrame:
    first, last = month_bounds(expire_month)
    q = f"""
    WITH tx AS (
      SELECT
        msno,
        TRY_CAST(STRPTIME(CAST(transaction_date AS VARCHAR), '%Y%m%d') AS DATE) AS txn_dt,
        TRY_CAST(STRPTIME(CAST(membership_expire_date AS VARCHAR), '%Y%m%d') AS DATE) AS exp_dt,
        CAST(is_cancel AS INTEGER) AS is_cancel
      FROM read_csv_auto('{transactions_csv}', IGNORE_ERRORS=TRUE)
      WHERE msno IS NOT NULL AND transaction_date IS NOT NULL AND membership_expire_date IS NOT NULL
    ),
    last_exp AS (
      SELECT msno, MAX(exp_dt) AS last_exp_dt
      FROM tx
      WHERE exp_dt BETWEEN DATE '{first}' AND DATE '{last}'
      GROUP BY msno
    ),
    next_tx AS (
      SELECT
        le.msno,
        le.last_exp_dt,
        MIN(t2.txn_dt) AS next_txn_dt
      FROM last_exp le
      LEFT JOIN tx t2 ON t2.msno = le.msno
        AND t2.txn_dt > le.last_exp_dt
        AND t2.is_cancel = 0
        AND t2.exp_dt > le.last_exp_dt  -- must extend membership
      GROUP BY le.msno, le.last_exp_dt
    )
    SELECT
      n.msno,
      CASE
        WHEN n.next_txn_dt IS NULL THEN 1
        WHEN DATE_DIFF('day', n.last_exp_dt, n.next_txn_dt) <= {window_days} THEN 0
        ELSE 1
      END AS is_churn
    FROM next_tx n
    """
    return con.execute(q).fetchdf()

def evaluate_window(models_dir: Path, feats: pd.DataFrame, labels: pd.DataFrame, out_rows: list[dict], tag: str):
    # Keep only IDs with labels, align frames
    df = feats.merge(labels, on="msno", how="inner", suffixes=("","_label"))
    y = df["is_churn"].to_numpy().astype(int)

    # Basic feature selection: drop id, cutoffs, target
    drop_cols = {"msno","is_churn","cutoff_ts"}
    X = df[[c for c in df.columns if c not in drop_cols]].to_numpy()

    # Load models if present; otherwise skip gracefully
    metrics = {}
    for name, file in [("logreg","models/logistic_regression.pkl"), ("rf","models/random_forest.pkl"), ("xgb","models/xgboost.pkl")]:
        path = models_dir / file
        if not path.exists(): continue
        if name == "xgb":
            try:
                import xgboost as xgb
                clf = xgb.XGBClassifier()
                clf.load_model(str(path))
            except:
                import pickle
                with open(path, 'rb') as f:
                    clf = pickle.load(f)
        else:
            import pickle
            with open(path, 'rb') as f:
                clf = pickle.load(f)

        p = clf.predict_proba(X)[:,1]
        metrics[name] = dict(
            logloss = float(log_loss(y, p, labels=[0,1])),
            auc     = float(roc_auc_score(y, p)) if len(np.unique(y))>1 else float("nan"),
            brier   = float(brier_score_loss(y, p)),
            ece     = expected_calibration_error(y, p, n_bins=15),
            n       = int(len(y))
        )

    # flatten to rows
    for mname, vals in metrics.items():
        out_rows.append(dict(window=tag, model=mname, **vals))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--transactions", required=True)
    ap.add_argument("--user-logs", required=True)
    ap.add_argument("--members", required=True)
    ap.add_argument("--train-placeholder", required=True,
                    help="CSV with at least [msno,is_churn]; used only to drive SQL inputs. It may be a copy of train_v2 or a synthetic file containing the msno universe for this run.")
    ap.add_argument("--features-sql", default="features/features_simple.sql")
    ap.add_argument("--windows", default="2017-02:2017-03,2017-03:2017-04,2017-01:2017-02",
                    help="Comma-separated pairs 'cutoff_YYYY-MM:expire_YYYY-MM'")
    ap.add_argument("--out", default="eval/backtests.csv")
    args = ap.parse_args()

    Path("eval").mkdir(exist_ok=True, parents=True)
    con = duckdb.connect()

    rows = []
    for pair in args.windows.split(","):
        cutoff_ym, expire_ym = pair.split(":")
        # cutoff = end of given month
        _, cutoff_last = month_bounds(cutoff_ym)
        print(f"🔄 Processing window {cutoff_ym}→{expire_ym} (cutoff: {cutoff_last})")
        
        feats = build_features(
            con,
            sql_path=Path(args.features_sql),
            cutoff=cutoff_last,
            train_path=Path(args.train_placeholder),
            transactions_path=Path(args.transactions),
            user_logs_path=Path(args.user_logs),
            members_path=Path(args.members),
        )
        
        # Save features per window for PSI analysis
        window_tag = f"{cutoff_ym}-{expire_ym}"
        feats_with_window = feats.assign(window=window_tag)
        feats_with_window.to_csv(f"eval/features_{window_tag}.csv", index=False)
        print(f"  Features: {len(feats)} rows saved to eval/features_{window_tag}.csv")
        
        labels = labels_for_expire_month(con, Path(args.transactions), expire_ym)
        print(f"  Labels: {len(labels)} rows, churn rate: {labels['is_churn'].mean():.3f}")
        
        evaluate_window(Path("."), feats, labels, rows, tag=f"{cutoff_ym}→{expire_ym}")
        
        # --- NEW: persist features and scores per window
        win_slug = f"{cutoff_ym}-{expire_ym}".replace(":", "-").replace("→","-")
        feats.assign(window=f"{cutoff_ym}→{expire_ym}").to_csv(
            Path("eval")/f"features_{win_slug}.csv", index=False
        )
        
        for mname, file in [("logreg","models/logistic_regression.pkl"), ("rf","models/random_forest.pkl"), ("xgb","models/xgboost.pkl")]:
            path = Path(".")/file
            if not path.exists(): continue
            if mname == "xgb":
                try:
                    import xgboost as xgb
                    clf = xgb.XGBClassifier(); clf.load_model(str(path))
                except:
                    import pickle
                    with open(path, 'rb') as f:
                        clf = pickle.load(f)
            else:
                import pickle
                with open(path, 'rb') as f:
                    clf = pickle.load(f)
            drop_cols = {"msno","is_churn","cutoff_ts"}
            X = feats[[c for c in feats.columns if c not in drop_cols]].fillna(0).to_numpy()
            p = clf.predict_proba(X)[:,1]
            pd.DataFrame({"msno": feats["msno"], "score": p}).to_csv(
                Path("eval")/f"scores_{win_slug}_{mname}.csv", index=False
            )

    pd.DataFrame(rows).to_csv(args.out, index=False)
    print(f"✅ Wrote {args.out}")

if __name__ == "__main__":
    main()