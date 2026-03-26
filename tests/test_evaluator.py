"""Tests for evaluator.py — evaluator selection and integrity."""

import pytest

from agent_service_agreements.schema import Identity
from agent_service_agreements.evaluator import (
    CanaryTask,
    EvaluatorRecord,
    EvaluatorRegistry,
)


def _make_evaluator(eid, domains=None, evals=100, canary=0.95):
    return EvaluatorRecord(
        identity=Identity(scheme="api_key", value=eid),
        domains=domains or ["general"],
        total_evaluations=evals,
        canary_pass_rate=canary,
    )


class TestEvaluatorRecord:
    def test_qualified(self):
        ev = _make_evaluator("ev-1", evals=100, canary=0.95)
        assert ev.is_qualified()

    def test_not_qualified_low_evals(self):
        ev = _make_evaluator("ev-1", evals=10)
        assert not ev.is_qualified()

    def test_not_qualified_low_canary(self):
        ev = _make_evaluator("ev-1", canary=0.5)
        assert not ev.is_qualified()

    def test_roundtrip(self):
        ev = _make_evaluator("ev-1", domains=["code", "research"])
        d = ev.to_dict()
        ev2 = EvaluatorRecord.from_dict(d)
        assert ev2.identity.value == "ev-1"
        assert ev2.domains == ["code", "research"]


class TestEvaluatorRegistry:
    def _registry(self):
        reg = EvaluatorRegistry()
        for i in range(5):
            reg.register(_make_evaluator(f"ev-{i}", evals=100 + i))
        return reg

    def test_register_and_get(self):
        reg = EvaluatorRegistry()
        ev = _make_evaluator("ev-1")
        reg.register(ev)
        assert reg.get("ev-1") is not None

    def test_list_qualified(self):
        reg = self._registry()
        qualified = reg.list_qualified()
        assert len(qualified) == 5

    def test_select_random(self):
        reg = self._registry()
        selected = reg.select_random("client-1", "provider-1")
        assert selected is not None
        assert selected.identity.value != "client-1"
        assert selected.identity.value != "provider-1"

    def test_select_random_excludes_parties(self):
        reg = EvaluatorRegistry()
        reg.register(_make_evaluator("client-1"))
        reg.register(_make_evaluator("provider-1"))
        reg.register(_make_evaluator("ev-1"))
        selected = reg.select_random("client-1", "provider-1")
        assert selected.identity.value == "ev-1"

    def test_select_random_returns_none_when_empty(self):
        reg = EvaluatorRegistry()
        assert reg.select_random("c", "p") is None

    def test_select_mutual_common(self):
        reg = self._registry()
        selected = reg.select_mutual(
            ["ev-0", "ev-1"], ["ev-1", "ev-2"],
            "client-1", "provider-1",
        )
        assert selected is not None
        assert selected.identity.value == "ev-1"

    def test_select_mutual_fallback(self):
        reg = self._registry()
        selected = reg.select_mutual(
            ["ev-0"], ["ev-3"],
            "client-1", "provider-1",
        )
        assert selected is not None  # Falls back to random

    def test_select_marketplace(self):
        reg = self._registry()
        selected = reg.select_marketplace("client-1", "provider-1")
        assert selected is not None

    def test_conflict_of_interest(self):
        reg = EvaluatorRegistry()
        assert reg.check_conflict_of_interest("ev-1", "ev-1", "p") is True
        assert reg.check_conflict_of_interest("ev-1", "c", "ev-1") is True
        assert reg.check_conflict_of_interest("ev-1", "c", "p") is False


class TestCanaryTask:
    def test_check_pass(self):
        task = CanaryTask(
            deliverable="test",
            expected_scores={"accuracy": 80},
            tolerance=10,
        )
        assert task.check_result({"accuracy": 85}) is True

    def test_check_fail(self):
        task = CanaryTask(
            deliverable="test",
            expected_scores={"accuracy": 80},
            tolerance=5,
        )
        assert task.check_result({"accuracy": 90}) is False

    def test_check_missing_dim(self):
        task = CanaryTask(
            deliverable="test",
            expected_scores={"accuracy": 80},
        )
        assert task.check_result({}) is False


class TestEvaluatorStats:
    def test_update_stats(self):
        reg = EvaluatorRegistry()
        reg.register(_make_evaluator("ev-1", evals=50))
        reg.update_evaluator_stats("ev-1", canary_passed=True)
        ev = reg.get("ev-1")
        assert ev.total_evaluations == 51

    def test_canary_rate_decreases_on_fail(self):
        reg = EvaluatorRegistry()
        ev = _make_evaluator("ev-1", canary=1.0)
        reg.register(ev)
        reg.update_evaluator_stats("ev-1", canary_passed=False)
        assert reg.get("ev-1").canary_pass_rate < 1.0
