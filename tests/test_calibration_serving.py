"""Guard: /api/calibration must serve the committed artifact, never a synthesis.

Regression context (2026-08-23 review): get_calibration() checked for top-level
"uncalibrated"/"calibrated" keys while models/calibration_metrics.json nests them
under "xgboost". The endpoint therefore fell into its synthetic-curve fallback and
served fabricated points even though real measured curves were committed. This test
loads the ACTUAL committed artifact shape through the API router function and asserts
the served curve equals the stored points, so key-shape drift can never silently
regress.
"""

import asyncio
import json
from pathlib import Path

from api.routers.metrics import get_calibration


def call_get_calibration():
    """Invoke the async route handler synchronously."""
    return asyncio.run(get_calibration())

CALIBRATION_PATH = Path("models/calibration_metrics.json")


def test_committed_calibration_artifact_exists():
    assert CALIBRATION_PATH.exists(), "serving calibration artifact missing"
    data = json.loads(CALIBRATION_PATH.read_text())
    assert "xgboost" in data and "uncalibrated" in data["xgboost"], (
        "committed calibration artifact lost its nested xgboost curve arrays; "
        "get_calibration() would fall back to synthetic curves"
    )


def test_api_serves_the_artifacts_stored_points_not_synthetic_ones():
    """The served response must equal the points stored in the committed file.

    The synthetic fallback emits mean_predicted = i/10 with
    fraction_of_positives = 0.85 * i/10 + 0.02 for i in 1..9; any of those exact
    pairs appearing in the response means the fallback fired.
    """
    stored = json.loads(CALIBRATION_PATH.read_text())["xgboost"]
    response = call_get_calibration()

    stored_uncal = [(p["mean_predicted"], p["fraction_of_positives"]) for p in stored["uncalibrated"]]
    stored_cal = [(p["mean_predicted"], p["fraction_of_positives"]) for p in stored["calibrated"]]
    served_uncal = [(p.mean_predicted, p.fraction_of_positives) for p in response.uncalibrated]
    served_cal = [(p.mean_predicted, p.fraction_of_positives) for p in response.calibrated]

    assert served_uncal == stored_uncal, (
        "/api/calibration does not serve the committed uncalibrated points "
        "(synthetic-curve fallback likely fired on a key-shape drift)"
    )
    assert served_cal == stored_cal, (
        "/api/calibration does not serve the committed calibrated points"
    )

    synthetic = {(round(i / 10, 4), round(0.85 * i / 10 + 0.02, 4)) for i in range(1, 10)}
    served_pairs = {(round(m, 4), round(f, 4)) for m, f in served_uncal}
    assert not (served_pairs & synthetic), (
        "served curve contains literal synthetic-fallback points"
    )
