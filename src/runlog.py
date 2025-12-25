from __future__ import annotations

import json
import os
import pathlib
import subprocess
import time


def _git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


def save_run_log(seed: int, params: dict, metrics: dict, path: str = "run.json") -> None:
    run = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "seed": seed,
        "git": _git_commit(),
        "data_snapshot": os.getenv("DATA_SNAPSHOT", "unknown"),
        "params": params,
        "metrics": metrics,
    }
    pathlib.Path(path).write_text(json.dumps(run, indent=2))
