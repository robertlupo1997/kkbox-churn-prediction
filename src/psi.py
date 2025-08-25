#!/usr/bin/env python3
"""
Population Stability Index across windows.
- Compares feature distributions of each window to a reference window
- Also computes PSI on model score if eval/scores_<window>.csv exists with [msno,score]
Output: eval/psi.csv
"""
from __future__ import annotations
import argparse
from pathlib import Path
import numpy as np, pandas as pd

def psi_expected(actual: np.ndarray, expected: np.ndarray, bins=10) -> float:
    bins = np.linspace(0,1,bins+1)
    a = np.histogram(actual, bins=bins)[0] / max(1,len(actual))
    e = np.histogram(expected, bins=bins)[0] / max(1,len(expected))
    a = np.clip(a, 1e-6, None); e = np.clip(e, 1e-6, None)
    return float(np.sum((a-e)*np.log(a/e)))

def psi_numeric(a: np.ndarray, e: np.ndarray, bins=10) -> float:
    qs = np.linspace(0,1,bins+1)
    edges = np.quantile(e, qs)
    a = np.histogram(a, bins=edges, density=False)[0] / max(1,len(a))
    e = np.histogram(e, bins=edges, density=False)[0] / max(1,len(e))
    a = np.clip(a, 1e-6, None); e = np.clip(e, 1e-6, None)
    return float(np.sum((a-e)*np.log(a/e)))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", required=True, help="CSV of features for each window concatenated with a 'window' column, or a glob like eval/features_*.csv")
    ap.add_argument("--ref", default=None, help="Reference window name (defaults to first alphabetically)")
    ap.add_argument("--out", default="eval/psi.csv")
    args = ap.parse_args()

    # Load and concat
    paths = sorted([p for p in Path(".").glob(args.features)]) if "*" in args.features else [Path(args.features)]
    print(f"📊 Loading features from {len(paths)} files: {[p.name for p in paths]}")
    
    df = pd.concat([pd.read_csv(p) for p in paths], ignore_index=True)
    assert "window" in df.columns, "features CSV must include a 'window' column"
    
    windows = sorted(df["window"].unique())
    ref_window = args.ref or windows[0]
    print(f"📏 PSI analysis: {len(windows)} windows, reference: {ref_window}")

    feat_cols = [c for c in df.columns if c not in {"window","msno","is_churn","cutoff_ts"}]
    print(f"🔍 Analyzing {len(feat_cols)} features: {feat_cols[:5]}{'...' if len(feat_cols) > 5 else ''}")
    
    rows = []
    ref_df = df[df["window"]==ref_window]
    
    for w in windows:
        if w == ref_window: continue
        cur = df[df["window"]==w]
        print(f"  {w} vs {ref_window}: {len(cur)} vs {len(ref_df)} samples")
        
        for c in feat_cols:
            a = cur[c].to_numpy()
            e = ref_df[c].to_numpy()
            
            # Skip if either array is empty
            if len(a) == 0 or len(e) == 0:
                continue
                
            if np.issubdtype(a.dtype, np.number) and np.issubdtype(e.dtype, np.number):
                # Remove NaN values
                a = a[~np.isnan(a)]
                e = e[~np.isnan(e)]
                if len(a) == 0 or len(e) == 0:
                    continue
                val = psi_numeric(a, e, bins=10)
            else:
                # Convert to frequency vectors
                va, ea = pd.value_counts(pd.Series(a)), pd.value_counts(pd.Series(e))
                cats = sorted(set(va.index).union(ea.index))
                a = (va.reindex(cats).fillna(0).to_numpy())/max(1,len(cur))
                e = (ea.reindex(cats).fillna(0).to_numpy())/max(1,len(ref_df))
                a = np.clip(a,1e-6,None); e = np.clip(e,1e-6,None)
                val = float(np.sum((a-e)*np.log(a/e)))
            
            rows.append(dict(window=w, ref=ref_window, feature=c, psi=val))

    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    result_df = pd.DataFrame(rows)
    result_df.to_csv(out, index=False)
    
    # Print summary
    if not result_df.empty:
        high_drift = result_df[result_df['psi'] > 0.2]
        print(f"\n📈 PSI Summary:")
        print(f"  Total comparisons: {len(result_df)}")
        print(f"  High drift (PSI > 0.2): {len(high_drift)} features")
        if len(high_drift) > 0:
            print(f"  Top drifted features:")
            for _, row in high_drift.nlargest(5, 'psi').iterrows():
                print(f"    {row['feature']}: {row['psi']:.3f} ({row['window']} vs {row['ref']})")
    
    print(f"✅ Wrote {out}")

if __name__ == "__main__":
    main()