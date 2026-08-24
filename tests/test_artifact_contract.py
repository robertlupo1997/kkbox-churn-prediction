"""Artifact contract test: serving model vs. serving features.

Contract (LIMITATIONS.md, "What would make this repository defensible" item 1):
the configured model (`models/xgb.json`) and the checked-in app feature table
(`eval/app_features.csv`) must agree on an exact, ordered list of feature names,
and the model must score ten real rows to finite probabilities.

HISTORY (2026-08-23): this test was added deliberately FAILING - the model then
declared 131 named features while `eval/app_features.csv` carried 99 predictors.
The mismatch was repaired by rebuilding the serving artifacts (see
scripts/rebuild_serving_artifacts.py): the CSV now carries the 121 predictors the
serving model was retrained on, in exact order. One harness line below
(`drop(columns=...)`) originally used `set & Index`, which raised under pandas
before any assertion could run once parity held; that line was repaired without
touching any assertion. Do not skip or xfail this test.
"""

import numpy as np
import pandas as pd
import pytest
import xgboost as xgb

MODEL_PATH = "models/xgb.json"
FEATURES_PATH = "eval/app_features.csv"
METADATA_COLUMNS = {"msno", "is_churn", "cutoff_ts"}
N_ROWS_TO_SCORE = 10


@pytest.fixture(scope="module")
def booster():
    return xgb.Booster()


@pytest.fixture(scope="module")
def loaded_booster(booster):
    booster.load_model(MODEL_PATH)
    return booster


@pytest.fixture(scope="module")
def app_frame():
    return pd.read_csv(FEATURES_PATH)


def test_model_and_feature_file_exist():
    import os

    assert os.path.exists(MODEL_PATH), f"serving model missing: {MODEL_PATH}"
    assert os.path.exists(FEATURES_PATH), f"serving features missing: {FEATURES_PATH}"


def test_exact_ordered_feature_name_parity(loaded_booster, app_frame):
    model_features = list(loaded_booster.feature_names or [])
    predictors = [c for c in app_frame.columns if c not in METADATA_COLUMNS]

    missing = [f for f in model_features if f not in predictors]
    extra = [c for c in predictors if c not in model_features]

    assert list(predictors) == model_features, (
        "Serving contract violated: models/xgb.json and eval/app_features.csv "
        f"disagree on ordered feature names. "
        f"model={len(model_features)} features, csv={len(predictors)} predictors; "
        f"{len(missing)} in model but not CSV (first 10: {missing[:10]}); "
        f"{len(extra)} in CSV but not model (first 10: {extra[:10]})."
    )


def test_scores_ten_rows_to_finite_probabilities(loaded_booster, app_frame):
    model_features = list(loaded_booster.feature_names or [])
    predictors = [c for c in app_frame.columns if c not in METADATA_COLUMNS]
    if list(predictors) != model_features:
        pytest.fail(
            "Cannot score: feature parity contract violated (see "
            "test_exact_ordered_feature_name_parity)."
        )

    sample = app_frame.drop(columns=[c for c in app_frame.columns if c in METADATA_COLUMNS]).head(
        N_ROWS_TO_SCORE
    )
    dmatrix = xgb.DMatrix(sample, feature_names=model_features)
    probabilities = loaded_booster.predict(dmatrix)

    assert len(probabilities) == N_ROWS_TO_SCORE
    assert np.all(np.isfinite(probabilities)), "non-finite probabilities from serving model"
