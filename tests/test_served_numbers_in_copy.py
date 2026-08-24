"""The dashboard's headline must cite the model it actually serves.

`App.tsx` read "Predicting customer churn at 0.9696 AUC ... using 131 engineered
features" in the present tense. The served model has 121 features and scores
0.9765 on its holdout; 0.9696 is an archived full-data LightGBM tuned-validation
figure that describes no served model.

These assertions bind the copy to the artifacts, not to a literal, so retraining
moves the test rather than leaving the page stale.
"""

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "brutalist-aesthetic-kkbox-churn-analysis-pro" / "App.tsx"
MODEL = ROOT / "models" / "xgb.json"
METRICS = ROOT / "models" / "training_metrics.json"

ARCHIVED_AUC = "0.9696"


@pytest.fixture(scope="module")
def header():
    """The first paragraph after the H1 -- the page's headline claim."""
    text = APP.read_text()
    start = text.index("CHURN.")
    return text[start : start + 1200]


def test_cites_the_served_feature_count(header):
    served = len(json.loads(MODEL.read_text())["learner"]["feature_names"])
    assert str(served) in header, f"the header does not name the served feature count ({served})"
    assert "131 engineered features" not in header, (
        "131 is the archived full-data feature count; the served model has "
        f"{served}"
    )


def test_cites_the_served_auc(header):
    auc = json.loads(METRICS.read_text())["models"]["xgboost"]["auc"]
    assert f"{auc:.4f}" in header, f"the header does not name the served AUC ({auc:.4f})"


def test_the_archived_figure_is_labelled_as_archived(header):
    """0.9696 may appear -- but never as a description of what is served."""
    if ARCHIVED_AUC not in header:
        return
    assert re.search(r"archived", header, re.I), (
        f"{ARCHIVED_AUC} appears in the header without being marked archived. It is a "
        f"full-data LightGBM tuned-validation figure and describes no served model."
    )


def test_the_two_numbers_are_actually_different():
    """If they ever coincide, this whole distinction is noise and should go."""
    auc = json.loads(METRICS.read_text())["models"]["xgboost"]["auc"]
    assert f"{auc:.4f}" != ARCHIVED_AUC
