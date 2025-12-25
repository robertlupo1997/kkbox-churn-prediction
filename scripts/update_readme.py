#!/usr/bin/env python3
"""
Auto-fill README metrics from actual results.
"""

import json
import re
from pathlib import Path

import pandas as pd


def load_data():
    """Load backtests and calibration results."""
    backtests = None
    if Path("eval/backtests.csv").exists():
        backtests = pd.read_csv("eval/backtests.csv")

    calib = {}
    if Path("models/calibration_metrics.json").exists():
        calib = json.loads(Path("models/calibration_metrics.json").read_text())

    return backtests, calib


def table_perf(calib):
    """Generate performance metrics table."""
    if not calib:
        return "*Pending real-data run*"

    # Choose a primary model (prefer xgb, else rf, else logreg)
    order = ["xgboost", "random_forest", "logistic_regression", "logreg"]
    k = next((m for m in order if m in calib), None)
    if not k:
        return "*No calibration results found*"

    pre = calib[k]["uncalibrated"]
    post = calib[k]["calibrated"]

    return f"""| Metric | Pre-Calibration | Post-Calibration | Improvement |
|--------|-----------------|------------------|-------------|
| **Log Loss** | {pre['log_loss']:.4f} | {post['log_loss']:.4f} | {pre['log_loss']-post['log_loss']:+.4f} |
| **ROC AUC** | {pre['auc']:.4f} | {post['auc']:.4f} | {post['auc']-pre['auc']:+.4f} |
| **Brier Score** | {pre['brier_score']:.4f} | {post['brier_score']:.4f} | {pre['brier_score']-post['brier_score']:+.4f} |
| **ECE** | {pre['ece']:.4f} | {post['ece']:.4f} | {pre['ece']-post['ece']:+.4f} |"""


def table_windows(backtests):
    """Generate rolling backtest windows table."""
    if backtests is None or backtests.empty:
        return """| Window | Log Loss | AUC | Brier | ECE | PSI Drift |
|--------|----------|-----|-------|-----|-----------|
| Jan→Feb | TBD | TBD | TBD | TBD | TBD |
| Feb→Mar | TBD | TBD | TBD | TBD | TBD |
| Mar→Apr | TBD | TBD | TBD | TBD | TBD |"""

    # Pick best model per window (by logloss)
    rows = []
    for window, group in backtests.groupby("window"):
        group = group.sort_values("logloss")
        best = group.iloc[0]

        # Format window name
        window_formatted = window.replace("→", "→") if "→" in window else window

        rows.append(
            f"| {window_formatted} | {best.logloss:.4f} | "
            f"{best.auc:.4f} | {best.brier:.4f} | {best.ece:.4f} | — |"
        )

    header = "| Window | Log Loss | AUC | Brier | ECE | PSI Drift |"
    separator = "|--------|----------|-----|-------|-----|-----------|"

    return "\n".join([header, separator] + rows)


def update_readme():
    """Update README.md with actual metrics."""
    readme_path = Path("README.md")
    if not readme_path.exists():
        print("❌ README.md not found")
        return False

    backtests, calib = load_data()

    # Generate tables
    perf_table = table_perf(calib)
    windows_table = table_windows(backtests)

    # Read current README
    content = readme_path.read_text()

    # Update performance metrics section
    perf_pattern = r"## Performance Metrics.*?(?=###|\n## |\Z)"
    perf_replacement = f"""## Performance Metrics *[Updated: {pd.Timestamp.now().strftime('%Y-%m-%d')}]*

{perf_table}

"""

    content = re.sub(perf_pattern, perf_replacement, content, flags=re.DOTALL)

    # Update rolling backtest section
    windows_pattern = r"### Rolling Backtest Windows.*?(?=\n## |\Z)"
    windows_replacement = f"""### Rolling Backtest Windows *[Updated: {pd.Timestamp.now().strftime('%Y-%m-%d')}]*
{windows_table}

> **PSI Drift**: Population Stability Index >0.2 indicates significant feature drift

"""

    content = re.sub(windows_pattern, windows_replacement, content, flags=re.DOTALL)

    # Write updated README
    readme_path.write_text(content)

    print("✅ README.md updated with latest metrics")
    if calib:
        print(f"  📊 Calibration: {len(calib)} models")
    if backtests is not None:
        print(f"  📈 Backtests: {len(backtests)} results")

    return True


if __name__ == "__main__":
    update_readme()
