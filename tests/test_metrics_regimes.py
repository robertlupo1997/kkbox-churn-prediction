"""/api/metrics must say which scoring regime each number came from.

The endpoint returned raw-model AUC and log loss beside a Brier score measured
after calibration, under one flat set of keys. The API serves calibrated scores,
so none of the three described the scores a visitor receives, and nothing in the
payload disclosed the mix.

The three scalars are deliberately unchanged -- docs/repair/space-redeploy-plan.md
pins them and clients read them. The fix is labelling plus a coherent set of each
regime, not a reshape.
"""

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CALIBRATION = ROOT / "models" / "calibration_metrics.json"
TRAINING = ROOT / "models" / "training_metrics.json"


@pytest.fixture(scope="module")
def payload():
    from fastapi.testclient import TestClient

    from api.main import app

    response = TestClient(app).get("/api/metrics")
    assert response.status_code == 200
    return response.json()


def test_top_level_scalars_are_unchanged(payload):
    """The redeploy plan's probe contract pins these three."""
    training = json.loads(TRAINING.read_text())["models"]["xgboost"]
    calibration = json.loads(CALIBRATION.read_text())["xgboost"]
    assert payload["auc"] == training["auc"]
    assert payload["log_loss"] == training["log_loss"]
    assert payload["brier_score"] == calibration["after"]["brier"]


def test_each_scalar_declares_its_regime(payload):
    regimes = payload["metric_regimes"]
    assert regimes["auc"] == "uncalibrated"
    assert regimes["log_loss"] == "uncalibrated"
    assert regimes["brier_score"] == "calibrated"


def test_both_regimes_are_reported_in_full(payload):
    for regime in ("uncalibrated", "calibrated"):
        block = payload[regime]
        for metric in ("auc", "log_loss", "brier"):
            assert block[metric] is not None, f"{regime}.{metric} is missing"


def test_the_regimes_actually_differ(payload):
    """If calibration changed nothing, the labelling would be pointless -- and wrong."""
    assert payload["uncalibrated"]["brier"] != payload["calibrated"]["brier"]
    assert payload["uncalibrated"]["log_loss"] != payload["calibrated"]["log_loss"]


def test_calibration_cannot_improve_ranking(payload):
    """Isotonic regression is monotone non-decreasing.

    It can tie scores that were distinct, so AUC can fall. It can never rise.
    A calibrated AUC above the uncalibrated one means the two rows describe
    different populations.
    """
    assert payload["calibrated"]["auc"] <= payload["uncalibrated"]["auc"]


def test_serving_applies_the_calibrator(payload):
    """The label is only meaningful if the calibrator is really in the path."""
    assert payload["calibration_applied_at_serving"] is True
