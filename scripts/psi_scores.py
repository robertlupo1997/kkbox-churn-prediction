#!/usr/bin/env python3
"""
Calculate PSI on model scores across windows.
"""
import glob, re, pandas as pd, numpy as np

def psi(a,e,bins=10):
    qs=np.linspace(0,1,bins+1); edges=np.quantile(e,qs)
    c1=np.histogram(a,bins=edges)[0]/len(a); c2=np.histogram(e,bins=edges)[0]/len(e)
    c1=np.clip(c1,1e-6,None); c2=np.clip(c2,1e-6,None)
    return float(np.sum((c1-c2)*np.log(c1/c2)))

def main():
    scores = sorted(glob.glob("eval/scores_*_*.csv"))
    if not scores:
        print("No score files found in eval/")
        return
    
    # pick the earliest window as reference
    ref = min(scores, key=lambda p: re.findall(r"scores_(\d{4}-\d{2}-\d{4}-\d{2})", p) or ["zz"])
    print(f"Using reference: {ref}")
    
    # group by model
    rows=[]
    models = set(re.findall(r"_(xgb|rf|logreg)\.csv", " ".join(scores)))
    
    for m in models:
        model_scores = [s for s in scores if s.endswith(f"_{m}.csv")]
        if not model_scores:
            continue
            
        # Use first chronologically as reference for this model
        refp = min(model_scores, key=lambda p: re.findall(r"scores_(\d{4}-\d{2}-\d{4}-\d{2})", p) or ["zz"])
        refv = pd.read_csv(refp)["score"].values
        
        for s in [s for s in model_scores if s != refp]:
            window_match = re.search(r"scores_(\d{4}-\d{2}-\d{4}-\d{2})_", s)
            window = window_match.group(1) if window_match else "unknown"
            
            current_scores = pd.read_csv(s)["score"].values
            psi_val = psi(current_scores, refv)
            
            rows.append({
                "model": m, 
                "window": window.replace("-", "→", 1), 
                "psi": psi_val,
                "reference": refp.split("scores_")[1].split(f"_{m}.csv")[0].replace("-", "→", 1)
            })
    
    if rows:
        result_df = pd.DataFrame(rows)
        result_df.to_csv("eval/psi_scores.csv", index=False)
        print(f"✅ eval/psi_scores.csv written with {len(rows)} comparisons")
        
        # Show high drift
        high_drift = result_df[result_df['psi'] > 0.2]
        if len(high_drift) > 0:
            print(f"⚠️  High PSI drift (>0.2) detected:")
            for _, row in high_drift.iterrows():
                print(f"  {row['model']} {row['window']}: PSI = {row['psi']:.3f}")
    else:
        print("No PSI comparisons could be made")

if __name__ == "__main__":
    main()