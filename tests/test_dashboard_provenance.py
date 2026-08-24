"""The Historical page must describe one run, and admit what it cannot show.

Two defects, both found by a framing-free external review:

1. `datasetStats.json` spliced `total_members` (916,814) and `churn_rate` (4.72%)
   from `eval/dataset_summary.json` -- a different cohort Mar->Apr split with
   893,768 validation rows at 3.30% positive -- onto `train_samples`,
   `val_samples`, and `feature_count` from the archived full-data March-2017 run.
   The page above it claimed every figure came from one run. 916,814 was neither
   the sum of the sample counts beside it (2,900,085) nor either of them.

2. Five exported chart files are built from `eval/stacked_ensemble_predictions.csv`,
   which is not committed and cannot be regenerated here. The export silently
   returns an empty result when it is missing, so the committed JSON is the only
   copy and nothing in the repository derives it.
"""

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "brutalist-aesthetic-kkbox-churn-analysis-pro" / "data"
COMPONENTS = ROOT / "brutalist-aesthetic-kkbox-churn-analysis-pro" / "components"
ARCHIVE = ROOT / "models" / "archive" / "full-data-training_metrics.json"
EXPORT_SCRIPT = ROOT / "scripts" / "export_dashboard_data.py"

UNCOMMITTED_SOURCE = "eval/stacked_ensemble_predictions.csv"
DERIVED_FROM_UNCOMMITTED = [
    "calibrationCurves.json",
    "riskDistribution.json",
    "sampleMembers.json",
    "liftGainsData.json",
    "prCurveData.json",
]


@pytest.fixture(scope="module")
def dataset_stats():
    return json.loads((DATA / "datasetStats.json").read_text())


@pytest.fixture(scope="module")
def archived():
    return json.loads(ARCHIVE.read_text())


def test_dataset_stats_matches_the_archived_run(dataset_stats, archived):
    """Every count must come from the one run the page names."""
    assert dataset_stats["train_samples"] == archived["train_samples"]
    assert dataset_stats["val_samples"] == archived["val_samples"]
    assert dataset_stats["feature_count"] == archived["feature_count"]
    assert dataset_stats["churn_rate"] == pytest.approx(
        archived["val_churn_rate"] * 100, abs=0.01
    )


def test_dataset_stats_population_is_one_of_its_own_splits(dataset_stats):
    """916,814 was neither the sum of the splits beside it nor either of them."""
    assert dataset_stats["total_members"] == dataset_stats["val_samples"]


def test_dataset_stats_does_not_reuse_the_other_split(dataset_stats):
    other = json.loads((ROOT / "eval" / "dataset_summary.json").read_text())
    assert dataset_stats["total_members"] != other["total_rows"], (
        "total_members is back to the cohort Mar->Apr summary, which is a "
        "different split from the run this page describes"
    )


@pytest.mark.parametrize("name", DERIVED_FROM_UNCOMMITTED)
def test_unreproducible_chart_data_says_so(name):
    d = json.loads((DATA / name).read_text())
    assert isinstance(d, dict), f"{name} must carry a _provenance key"
    note = d.get("_provenance", "")
    assert UNCOMMITTED_SOURCE in note, (
        f"{name} is exported from {UNCOMMITTED_SOURCE}, which is not committed. "
        f"Its _provenance must name that file."
    )


def test_the_uncommitted_source_is_still_uncommitted():
    """If someone commits the CSV, these notes become false and must be removed."""
    if (ROOT / UNCOMMITTED_SOURCE).exists():
        pytest.fail(
            f"{UNCOMMITTED_SOURCE} is now committed. Regenerate the exports and "
            f"drop the _provenance notes from {DERIVED_FROM_UNCOMMITTED}."
        )


def test_the_annotated_files_are_exactly_the_ones_that_need_it():
    """Guard against a sixth export quietly starting to read the same CSV."""
    src = EXPORT_SCRIPT.read_text()
    reading = {
        block.split("(")[0].strip()
        for block in src.split("\ndef ")
        if block.split("(")[0].strip().startswith("export_")
        and "stacked_ensemble_predictions" in block
    }
    assert len(reading) == len(DERIVED_FROM_UNCOMMITTED), (
        f"{len(reading)} export functions read the uncommitted CSV "
        f"({sorted(reading)}), but {len(DERIVED_FROM_UNCOMMITTED)} data files are "
        f"annotated. They must match."
    )


def test_contact_volume_is_not_invented():
    """`max(0.01, 1 - threshold) * 0.5` is not a property of the model or the data."""
    src = (COMPONENTS / "PrecisionRecallCurve.tsx").read_text()
    invented = re.search(r"Math\.max\(\s*0\.01\s*,\s*1\s*-\s*point\.threshold\s*\)\s*\*\s*0\.5", src)
    assert invented is None, (
        "The contact count is back to a fabricated flag rate. It is pinned exactly "
        "by the curve: predicted positive = recall * churners / precision."
    )
    assert "capturedChurners / point.precision" in src, (
        "The contact count must be derived from precision and recall."
    )
