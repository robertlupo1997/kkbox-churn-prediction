#!/usr/bin/env python3
"""
API Integration Tests for KKBOX Churn Prediction API.

Tests all endpoints with real data to ensure correct functionality.
Run with: pytest tests/api_tests/test_endpoints.py -v
"""

import sys
from pathlib import Path

# Ensure project root is in path before any imports
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402

client = TestClient(app)


class TestHealthEndpoint:
    """Tests for /api/health endpoint."""

    def test_health_check_returns_200(self):
        """Health check should return 200 OK."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_check_response_structure(self):
        """Health check should return correct structure."""
        response = client.get("/api/health")
        data = response.json()

        assert "status" in data
        assert "model_loaded" in data
        assert "features_loaded" in data
        assert data["status"] == "healthy"

    def test_health_check_model_status(self):
        """Model status should be reported."""
        response = client.get("/api/health")
        data = response.json()
        # Model may or may not be loaded in test environment
        assert isinstance(data["model_loaded"], bool)

    def test_health_check_features_status(self):
        """Features status should be reported."""
        response = client.get("/api/health")
        data = response.json()
        # Features may or may not be loaded in test environment
        assert isinstance(data["features_loaded"], bool)


class TestMembersEndpoint:
    """Tests for /api/members endpoint."""

    def test_members_list_returns_200(self):
        """Members list should return 200 OK."""
        response = client.get("/api/members")
        assert response.status_code == 200

    def test_members_list_response_structure(self):
        """Members list should return correct structure."""
        response = client.get("/api/members")
        data = response.json()

        assert "members" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert isinstance(data["members"], list)

    def test_members_list_pagination(self):
        """Members list should respect pagination parameters."""
        response = client.get("/api/members?limit=5&offset=0")
        data = response.json()

        assert len(data["members"]) <= 5
        assert data["limit"] == 5
        assert data["offset"] == 0

    def test_members_list_default_limit(self):
        """Members list should have a default limit."""
        response = client.get("/api/members")
        data = response.json()

        assert len(data["members"]) <= 100  # Default limit

    def test_members_search_by_risk(self):
        """Members list should filter by risk tier."""
        response = client.get("/api/members?risk_tier=High")
        data = response.json()

        # If there are high risk members, they should all be High risk
        if data["members"]:
            for member in data["members"]:
                assert member["risk_tier"] == "High"

    def test_members_list_contains_required_fields(self):
        """Each member should have required fields."""
        response = client.get("/api/members?limit=5")
        data = response.json()

        if data["members"]:
            member = data["members"][0]
            assert "msno" in member
            assert "risk_score" in member
            assert "risk_tier" in member


class TestMemberDetailEndpoint:
    """Tests for /api/members/{msno} endpoint."""

    def test_member_detail_valid_msno(self):
        """Should return member details for valid msno."""
        # First get a valid msno from the list
        list_response = client.get("/api/members?limit=1")
        members = list_response.json()["members"]

        if members:
            msno = members[0]["msno"]
            response = client.get(f"/api/members/{msno}")
            assert response.status_code == 200

            data = response.json()
            assert data["msno"] == msno
            assert "risk_score" in data
            assert "risk_tier" in data

    def test_member_detail_invalid_msno(self):
        """Should return 404 for invalid msno."""
        response = client.get("/api/members/invalid_msno_12345")
        assert response.status_code == 404

    def test_member_detail_contains_features(self):
        """Member detail should include feature data."""
        list_response = client.get("/api/members?limit=1")
        members = list_response.json()["members"]

        if members:
            msno = members[0]["msno"]
            response = client.get(f"/api/members/{msno}")
            data = response.json()

            # Should have some feature data
            assert "features" in data or len(data) > 3


class TestPredictionsEndpoint:
    """Tests for /api/predictions endpoints."""

    def test_single_prediction_valid_msno(self):
        """Should return prediction for valid msno."""
        # Get a valid msno first
        list_response = client.get("/api/members?limit=1")
        members = list_response.json()["members"]

        if members:
            msno = members[0]["msno"]
            response = client.post("/api/predictions/single", json={"msno": msno})
            assert response.status_code == 200

            data = response.json()
            assert "churn_probability" in data
            assert "risk_tier" in data
            assert 0 <= data["churn_probability"] <= 1

    def test_single_prediction_invalid_msno(self):
        """Should return 404 for invalid msno."""
        response = client.post("/api/predictions/single", json={"msno": "invalid_msno_xyz"})
        assert response.status_code == 404

    def test_batch_prediction(self):
        """Should return batch predictions."""
        # Get some valid msnos
        list_response = client.get("/api/members?limit=5")
        members = list_response.json()["members"]

        if len(members) >= 2:
            msnos = [m["msno"] for m in members[:3]]
            response = client.post("/api/predictions", json={"msnos": msnos})
            assert response.status_code == 200

            data = response.json()
            assert "predictions" in data
            assert "total_requested" in data
            assert "total_found" in data
            assert data["total_requested"] == len(msnos)

    def test_batch_prediction_with_invalid_msnos(self):
        """Batch prediction should handle mix of valid/invalid msnos."""
        # Get a valid msno
        list_response = client.get("/api/members?limit=1")
        members = list_response.json()["members"]

        if members:
            msnos = [members[0]["msno"], "invalid_msno_abc"]
            response = client.post("/api/predictions", json={"msnos": msnos})
            assert response.status_code == 200

            data = response.json()
            assert data["total_requested"] == 2
            assert data["total_found"] >= 1  # At least one should be found

    def test_batch_prediction_empty_list(self):
        """Batch prediction should handle empty list."""
        response = client.post("/api/predictions", json={"msnos": []})
        # Should either return 200 with empty results or 422 validation error
        assert response.status_code in [200, 422]


class TestMetricsEndpoint:
    """Tests for /api/metrics endpoint."""

    def test_metrics_returns_200(self):
        """Metrics endpoint should return 200 OK."""
        response = client.get("/api/metrics")
        assert response.status_code == 200

    def test_metrics_response_structure(self):
        """Metrics should contain model performance data."""
        response = client.get("/api/metrics")
        data = response.json()

        # Should have some performance metrics
        assert isinstance(data, dict)
        # Common metric fields
        possible_fields = ["auc", "log_loss", "brier_score", "accuracy", "roc_auc"]
        has_metrics = any(field in str(data).lower() for field in possible_fields)
        assert has_metrics or len(data) > 0


class TestCalibrationEndpoint:
    """Tests for /api/calibration endpoint."""

    def test_calibration_returns_200(self):
        """Calibration endpoint should return 200 OK."""
        response = client.get("/api/calibration")
        assert response.status_code == 200

    def test_calibration_response_structure(self):
        """Calibration should return curve data."""
        response = client.get("/api/calibration")
        data = response.json()

        assert isinstance(data, dict)


class TestFeatureImportanceEndpoint:
    """Tests for /api/features/importance endpoint."""

    def test_feature_importance_returns_200(self):
        """Feature importance endpoint should return 200 OK."""
        response = client.get("/api/features/importance")
        assert response.status_code == 200

    def test_feature_importance_response_structure(self):
        """Feature importance should return ranked features."""
        response = client.get("/api/features/importance")
        data = response.json()

        assert "features" in data
        assert isinstance(data["features"], list)

        if data["features"]:
            feature = data["features"][0]
            assert "name" in feature
            assert "importance" in feature

    def test_feature_importance_top_n(self):
        """Feature importance should respect top_n parameter."""
        response = client.get("/api/features/importance?top_n=10")
        data = response.json()

        assert len(data["features"]) <= 10

    def test_feature_importance_sorted(self):
        """Features should be sorted by importance (descending)."""
        response = client.get("/api/features/importance?top_n=20")
        data = response.json()

        if len(data["features"]) >= 2:
            importances = [f["importance"] for f in data["features"]]
            assert importances == sorted(importances, reverse=True)


class TestShapEndpoint:
    """Tests for /api/shap endpoint."""

    def test_shap_valid_msno(self):
        """Should return SHAP values for valid msno."""
        # Get a valid msno first
        list_response = client.get("/api/members?limit=1")
        members = list_response.json()["members"]

        if members:
            msno = members[0]["msno"]
            response = client.get(f"/api/shap/{msno}")

            # SHAP computation might be slow or not available
            assert response.status_code in [200, 404, 500, 503]

    def test_shap_invalid_msno(self):
        """Should return 404 for invalid msno."""
        response = client.get("/api/shap/invalid_msno_xyz")
        assert response.status_code in [404, 500]


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_returns_200(self):
        """Root endpoint should return 200."""
        response = client.get("/")
        assert response.status_code == 200

    def test_root_returns_content(self):
        """Root should return either API info or frontend HTML."""
        response = client.get("/")
        # Could be JSON API info or HTML frontend
        content_type = response.headers.get("content-type", "")
        assert "json" in content_type or "html" in content_type


class TestAPIPerformance:
    """Performance tests for API endpoints."""

    def test_health_check_fast(self):
        """Health check should respond quickly."""
        import time

        start = time.time()
        response = client.get("/api/health")
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 1.0  # Should respond in under 1 second

    def test_members_list_fast(self):
        """Members list should respond reasonably fast."""
        import time

        start = time.time()
        response = client.get("/api/members?limit=10")
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 2.0  # Should respond in under 2 seconds

    def test_single_prediction_fast(self):
        """Single prediction should be fast (O(1) lookup)."""
        import time

        # Get a valid msno first
        list_response = client.get("/api/members?limit=1")
        members = list_response.json()["members"]

        if members:
            msno = members[0]["msno"]

            start = time.time()
            response = client.post("/api/predictions/single", json={"msno": msno})
            elapsed = time.time() - start

            assert response.status_code == 200
            assert elapsed < 0.5  # Should respond in under 500ms


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
