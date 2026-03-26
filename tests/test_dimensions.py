"""Tests for dimensions.py — quality dimensions and composite scoring."""

import pytest

from agent_service_agreements.dimensions import (
    DIMENSION_REGISTRY,
    QualityDimension,
    compute_composite,
    compute_geometric_mean,
    compute_harmonic_mean,
    compute_weighted_average,
    get_dimension,
    list_dimensions,
)


class TestDimensionRegistry:
    def test_has_core_dimensions(self):
        for name in ["correctness", "completeness", "coherence", "accuracy"]:
            assert name in DIMENSION_REGISTRY

    def test_get_dimension(self):
        d = get_dimension("accuracy")
        assert d is not None
        assert d.name == "accuracy"

    def test_get_unknown(self):
        assert get_dimension("nonexistent") is None

    def test_list_all(self):
        dims = list_dimensions()
        assert len(dims) > 20

    def test_list_by_category(self):
        code_dims = list_dimensions(category="code")
        assert all(d.category == "code" for d in code_dims)
        assert len(code_dims) >= 3


class TestQualityDimension:
    def test_validate_score(self):
        d = QualityDimension(name="test", description="test")
        assert d.validate_score(50) is True
        assert d.validate_score(-1) is False
        assert d.validate_score(101) is False

    def test_roundtrip(self):
        d = QualityDimension(name="test", description="desc", default_weight=0.3)
        dd = d.to_dict()
        d2 = QualityDimension.from_dict(dd)
        assert d2.name == "test"
        assert d2.default_weight == 0.3


class TestCompositeScoring:
    def test_weighted_average(self):
        scores = {"a": 80, "b": 90}
        weights = {"a": 0.5, "b": 0.5}
        assert compute_weighted_average(scores, weights) == 85.0

    def test_weighted_average_unequal(self):
        scores = {"a": 80, "b": 100}
        weights = {"a": 0.75, "b": 0.25}
        result = compute_weighted_average(scores, weights)
        assert abs(result - 85.0) < 0.01

    def test_weighted_average_empty(self):
        assert compute_weighted_average({}, {}) == 0.0

    def test_geometric_mean(self):
        scores = {"a": 100, "b": 100}
        weights = {"a": 0.5, "b": 0.5}
        result = compute_geometric_mean(scores, weights)
        assert abs(result - 100.0) < 0.01

    def test_geometric_mean_zero(self):
        scores = {"a": 0, "b": 90}
        weights = {"a": 0.5, "b": 0.5}
        assert compute_geometric_mean(scores, weights) == 0.0

    def test_harmonic_mean(self):
        scores = {"a": 80, "b": 80}
        weights = {"a": 0.5, "b": 0.5}
        result = compute_harmonic_mean(scores, weights)
        assert abs(result - 80.0) < 0.01

    def test_harmonic_mean_zero(self):
        scores = {"a": 0, "b": 90}
        weights = {"a": 0.5, "b": 0.5}
        assert compute_harmonic_mean(scores, weights) == 0.0

    def test_compute_composite_default(self):
        scores = {"a": 80, "b": 90}
        weights = {"a": 0.5, "b": 0.5}
        result = compute_composite(scores, weights)
        assert result == 85.0

    def test_compute_composite_geometric(self):
        scores = {"a": 80, "b": 90}
        weights = {"a": 0.5, "b": 0.5}
        result = compute_composite(scores, weights, "geometric_mean")
        assert result > 0
