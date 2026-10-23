"""The static demo bundle must be the API's own answers, byte for byte in value.

scripts/export_static_bundle.py writes the JSON the dashboard will read when no
server is running. These tests export a few members through the real path and
compare every file against a fresh call to the matching API route.
"""

import hashlib
import json
import re
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from export_static_bundle import SOURCE_ARTIFACTS, export_bundle, member_key  # noqa: E402

from api.main import app  # noqa: E402

SAMPLE = 5


@pytest.fixture(scope="module")
def bundle(tmp_path_factory, monkeypatch_module):
    out = tmp_path_factory.mktemp("bundle")
    manifest = export_bundle(out, limit=SAMPLE)
    return out, manifest


@pytest.fixture(scope="module")
def monkeypatch_module():
    mp = pytest.MonkeyPatch()
    mp.chdir(ROOT)
    yield mp
    mp.undo()


@pytest.fixture(scope="module")
def api(monkeypatch_module):
    with TestClient(app) as client:
        yield client


def _load(path: Path) -> dict:
    return json.loads(path.read_text())


def test_member_files_equal_api_responses(bundle, api):
    out, _ = bundle
    members = _load(out / "members.json")["members"]
    for member in members[:SAMPLE]:
        msno = member["msno"]
        stored = _load(out / "m" / f"{member_key(msno)}.json")
        assert stored["detail"] == api.post("/api/members/lookup", json={"msno": msno}).json()
        assert stored["shap"] == api.post("/api/shap", json={"msno": msno}).json()


def test_member_list_is_the_whole_served_population(bundle, api):
    out, manifest = bundle
    listing = _load(out / "members.json")
    assert listing["total"] == api.get("/api/members", params={"limit": 1}).json()["total"]
    assert len(listing["members"]) == listing["total"] == manifest["population"]
    first_page = api.get("/api/members", params={"limit": 1000}).json()["members"]
    assert listing["members"][: len(first_page)] == first_page


@pytest.mark.parametrize(
    "name,route",
    [
        ("metrics.json", "/api/metrics"),
        ("importance.json", "/api/features/importance"),
        ("calibration.json", "/api/calibration"),
    ],
)
def test_page_level_files_equal_api_responses(bundle, api, name, route):
    out, _ = bundle
    assert _load(out / name) == api.get(route).json()


def test_manifest_records_the_artifacts_that_produced_it(bundle):
    _, manifest = bundle
    assert manifest["members_exported"] == SAMPLE
    assert manifest["approximate_explanations"] == 0
    for name in SOURCE_ARTIFACTS:
        expected = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
        assert manifest["source_artifacts"][name] == expected


def test_member_keys_are_file_safe_and_unique_over_the_population(bundle):
    out, _ = bundle
    ids = [m["msno"] for m in _load(out / "members.json")["members"]]
    keys = {member_key(msno) for msno in ids}
    assert len(keys) == len(ids)
    assert all(re.fullmatch(r"[0-9a-f]{16}", k) for k in keys)
    # The reason keys exist: raw ids are not safe as path segments.
    assert any("/" in msno for msno in ids)
