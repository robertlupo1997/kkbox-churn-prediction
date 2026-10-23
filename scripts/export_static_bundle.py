#!/usr/bin/env python3
"""Export everything the member-lookup demo needs as static JSON files.

Why this script exists
----------------------
The demo only ever browses the persisted holdout (``eval/serving_split.json``,
1,995 members), so every answer the API can give the dashboard is fixed once
the model, calibrator, and feature table are fixed. Precomputing those answers
lets the dashboard run from plain files on any static host, with no Python
process behind it (issue #18).

The bundle is produced by calling the API itself, in process, through
FastAPI's test client. Each file is the exact JSON body the matching route
returns, so the bundle and the API cannot disagree: there is no second
implementation of scoring, calibration, or SHAP to drift.

Layout (under ``--out``, default ``static-bundle/``)::

    manifest.json           what produced the bundle (artifact sha256s, counts)
    members.json            GET /api/members, every member, in API order
    metrics.json            GET /api/metrics
    importance.json         GET /api/features/importance
    calibration.json        GET /api/calibration
    m/<key>.json            {"detail": POST /api/members/lookup,
                             "shap": POST /api/shap} for one member

``<key>`` is ``member_key(msno)``. Member ids are base64 and about half contain
``/`` or ``+``, which cannot appear safely in a file name or URL path, so files
are named by a hash of the id instead.

Run:  python3 scripts/export_static_bundle.py [--out DIR] [--limit N]
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

BUNDLE_VERSION = 1
PAGE_SIZE = 1000  # the members route caps `limit` at 1000

# The files whose contents determine every number in the bundle.
SOURCE_ARTIFACTS = [
    "models/xgb.json",
    "models/isotonic_calibrator.json",
    "models/training_metrics.json",
    "models/calibration_metrics.json",
    "eval/app_features.csv",
    "eval/serving_split.json",
    "rules.yaml",
]


def member_key(msno: str) -> str:
    """File-safe, URL-safe key for one member id."""
    return hashlib.sha256(msno.encode("utf-8")).hexdigest()[:16]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _get(client, path: str, **params) -> dict:
    response = client.get(path, params=params)
    response.raise_for_status()
    return response.json()


def _post(client, path: str, body: dict) -> dict:
    response = client.post(path, json=body)
    response.raise_for_status()
    return response.json()


def _all_members(client) -> dict:
    first = _get(client, "/api/members", limit=PAGE_SIZE, offset=0)
    members = list(first["members"])
    while len(members) < first["total"]:
        page = _get(client, "/api/members", limit=PAGE_SIZE, offset=len(members))
        if not page["members"]:
            break
        members.extend(page["members"])
    if len(members) != first["total"]:
        raise RuntimeError(f"API reported {first['total']} members but paged {len(members)}")
    return {"members": members, "total": len(members)}


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False))


def export_bundle(out: Path, limit: int | None = None) -> dict:
    """Write the bundle to ``out`` and return its manifest.

    ``limit`` exports only the first N members' per-member files (members.json
    still lists everyone); it exists so tests can exercise the real path fast.
    """
    from fastapi.testclient import TestClient

    from api.main import app

    out = out.resolve()
    # The API resolves its artifact paths (models/, eval/, rules.yaml) against
    # the working directory, so run it from the repository root.
    with contextlib.chdir(ROOT), TestClient(app) as client:
        health = _get(client, "/api/health")
        if not (health.get("model_loaded") and health.get("features_loaded")):
            raise RuntimeError(f"API is not ready to score: {health}")

        listing = _all_members(client)
        if listing["total"] == 0:
            raise RuntimeError("API serves no members; refusing to export an empty bundle")

        _write(out / "members.json", listing)
        _write(out / "metrics.json", _get(client, "/api/metrics"))
        _write(out / "importance.json", _get(client, "/api/features/importance"))
        _write(out / "calibration.json", _get(client, "/api/calibration"))

        selected = listing["members"] if limit is None else listing["members"][:limit]
        keys: dict[str, str] = {}
        approximate = 0
        for member in selected:
            msno = member["msno"]
            key = member_key(msno)
            if key in keys:
                raise RuntimeError(f"member_key collision: {keys[key]!r} and {msno!r}")
            keys[key] = msno
            shap = _post(client, "/api/shap", {"msno": msno})
            approximate += bool(shap["explanation"].get("is_approximate"))
            _write(
                out / "m" / f"{key}.json",
                {"detail": _post(client, "/api/members/lookup", {"msno": msno}), "shap": shap},
            )

    manifest = {
        "bundle_version": BUNDLE_VERSION,
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "population": listing["total"],
        "members_exported": len(keys),
        "approximate_explanations": approximate,
        "member_key": "sha256(msno utf-8) hex, first 16 chars",
        "source_artifacts": {name: _sha256(ROOT / name) for name in SOURCE_ARTIFACTS},
    }
    _write(out / "manifest.json", manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, default=ROOT / "static-bundle")
    parser.add_argument("--limit", type=int, default=None, help="export only N members' files")
    args = parser.parse_args()
    manifest = export_bundle(args.out, args.limit)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
