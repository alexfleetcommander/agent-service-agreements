"""Evaluator selection protocol for Agent Service Agreements.

Implements Section 3.6.1 of the whitepaper:
- Random assignment from curated qualified pool (default)
- Mutual agreement with random fallback
- Marketplace selection by criteria

Plus evaluator integrity mechanisms:
- Rotation (no single evaluator for N consecutive deliveries)
- Canary tasks (known-answer quality checks)
- Conflict-of-interest checks
"""

import hashlib
import random
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set

from .schema import Identity, _now_iso, _uuid


@dataclass
class EvaluatorRecord:
    """An evaluator in the registry."""
    identity: Identity
    domains: List[str] = field(default_factory=list)
    total_evaluations: int = 0
    canary_pass_rate: float = 1.0
    calibration_deviation: float = 0.0
    available: bool = True
    cost_per_eval_usd: float = 0.0

    def is_qualified(
        self,
        min_evaluations: int = 50,
        min_canary_rate: float = 0.9,
        max_calibration_deviation: float = 0.15,
    ) -> bool:
        """Check if evaluator meets qualification thresholds."""
        return (
            self.total_evaluations >= min_evaluations
            and self.canary_pass_rate >= min_canary_rate
            and self.calibration_deviation <= max_calibration_deviation
            and self.available
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "identity": self.identity.to_dict(),
            "domains": self.domains,
            "total_evaluations": self.total_evaluations,
            "canary_pass_rate": self.canary_pass_rate,
            "calibration_deviation": self.calibration_deviation,
            "available": self.available,
            "cost_per_eval_usd": self.cost_per_eval_usd,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "EvaluatorRecord":
        return cls(
            identity=Identity.from_dict(d["identity"]),
            domains=d.get("domains", []),
            total_evaluations=d.get("total_evaluations", 0),
            canary_pass_rate=d.get("canary_pass_rate", 1.0),
            calibration_deviation=d.get("calibration_deviation", 0.0),
            available=d.get("available", True),
            cost_per_eval_usd=d.get("cost_per_eval_usd", 0.0),
        )


@dataclass
class CanaryTask:
    """A known-answer task for evaluator quality monitoring."""
    task_id: str = ""
    deliverable: str = ""
    expected_scores: Dict[str, float] = field(default_factory=dict)
    tolerance: float = 10.0

    def __post_init__(self) -> None:
        if not self.task_id:
            self.task_id = f"canary-{_uuid()[:8]}"

    def check_result(self, actual_scores: Dict[str, float]) -> bool:
        """Check if evaluator scores are within tolerance of expected."""
        for dim_name, expected in self.expected_scores.items():
            actual = actual_scores.get(dim_name)
            if actual is None:
                return False
            if abs(actual - expected) > self.tolerance:
                return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "expected_scores": self.expected_scores,
            "tolerance": self.tolerance,
        }


class EvaluatorRegistry:
    """Curated registry of qualified evaluators.

    Supports three selection modes:
    1. random_from_pool (default): random assignment from qualified subset
    2. mutual_agreement: both parties propose, fallback to random
    3. marketplace: best match by criteria
    """

    def __init__(self) -> None:
        self._evaluators: Dict[str, EvaluatorRecord] = {}
        self._assignment_history: Dict[str, List[str]] = {}  # provider_id -> [evaluator_ids]
        self._canary_tasks: List[CanaryTask] = []

    def register(self, evaluator: EvaluatorRecord) -> None:
        """Add or update an evaluator in the registry."""
        key = evaluator.identity.value
        self._evaluators[key] = evaluator

    def remove(self, evaluator_id: str) -> None:
        """Remove an evaluator from the registry."""
        self._evaluators.pop(evaluator_id, None)

    def get(self, evaluator_id: str) -> Optional[EvaluatorRecord]:
        return self._evaluators.get(evaluator_id)

    def list_qualified(
        self,
        domain: Optional[str] = None,
        min_evaluations: int = 50,
        min_canary_rate: float = 0.9,
    ) -> List[EvaluatorRecord]:
        """List evaluators that meet qualification thresholds."""
        qualified = []
        for ev in self._evaluators.values():
            if not ev.is_qualified(min_evaluations, min_canary_rate):
                continue
            if domain and domain not in ev.domains:
                continue
            qualified.append(ev)
        return qualified

    def select_random(
        self,
        client_id: str,
        provider_id: str,
        domain: Optional[str] = None,
        excluded_ids: Optional[Set[str]] = None,
    ) -> Optional[EvaluatorRecord]:
        """Random assignment from qualified pool (default mode).

        Enforces independence: evaluator cannot share identity with
        either party.
        """
        excluded = excluded_ids or set()
        excluded.add(client_id)
        excluded.add(provider_id)

        # Enforce rotation: check recent assignments for this provider
        recent = self._assignment_history.get(provider_id, [])[-5:]
        excluded.update(recent)

        qualified = [
            ev for ev in self.list_qualified(domain)
            if ev.identity.value not in excluded
        ]

        if not qualified:
            return None

        selected = random.choice(qualified)

        # Track assignment
        if provider_id not in self._assignment_history:
            self._assignment_history[provider_id] = []
        self._assignment_history[provider_id].append(selected.identity.value)

        return selected

    def select_mutual(
        self,
        client_proposals: List[str],
        provider_proposals: List[str],
        client_id: str,
        provider_id: str,
        domain: Optional[str] = None,
        max_rounds: int = 3,
    ) -> Optional[EvaluatorRecord]:
        """Mutual agreement with random fallback.

        If both parties agree on a common evaluator, use it.
        Otherwise fall back to random after max_rounds.
        """
        excluded = {client_id, provider_id}

        # Find common proposals
        common = set(client_proposals) & set(provider_proposals) - excluded
        for eid in common:
            ev = self._evaluators.get(eid)
            if ev and ev.is_qualified():
                if provider_id not in self._assignment_history:
                    self._assignment_history[provider_id] = []
                self._assignment_history[provider_id].append(eid)
                return ev

        # Fallback to random
        return self.select_random(client_id, provider_id, domain)

    def select_marketplace(
        self,
        client_id: str,
        provider_id: str,
        domain: Optional[str] = None,
        max_cost_usd: Optional[float] = None,
        min_evaluations: int = 50,
    ) -> Optional[EvaluatorRecord]:
        """Marketplace selection: best match by track record and cost."""
        excluded = {client_id, provider_id}

        candidates = [
            ev for ev in self.list_qualified(domain, min_evaluations)
            if ev.identity.value not in excluded
        ]

        if max_cost_usd is not None:
            candidates = [c for c in candidates if c.cost_per_eval_usd <= max_cost_usd]

        if not candidates:
            return None

        # Sort by: canary pass rate (desc), evaluations (desc), cost (asc)
        candidates.sort(
            key=lambda e: (-e.canary_pass_rate, -e.total_evaluations, e.cost_per_eval_usd)
        )

        selected = candidates[0]
        if provider_id not in self._assignment_history:
            self._assignment_history[provider_id] = []
        self._assignment_history[provider_id].append(selected.identity.value)
        return selected

    def check_conflict_of_interest(
        self,
        evaluator_id: str,
        client_id: str,
        provider_id: str,
    ) -> bool:
        """Check if evaluator has a conflict of interest.

        Returns True if conflict detected.
        """
        # COI: evaluator matches either party
        if evaluator_id == client_id or evaluator_id == provider_id:
            return True
        return False

    def add_canary_task(self, task: CanaryTask) -> None:
        """Register a canary task for evaluator monitoring."""
        self._canary_tasks.append(task)

    def get_canary_task(self) -> Optional[CanaryTask]:
        """Get a random canary task for evaluator testing."""
        if not self._canary_tasks:
            return None
        return random.choice(self._canary_tasks)

    def update_evaluator_stats(
        self,
        evaluator_id: str,
        canary_passed: Optional[bool] = None,
    ) -> None:
        """Update evaluator statistics after an evaluation."""
        ev = self._evaluators.get(evaluator_id)
        if not ev:
            return

        ev.total_evaluations += 1

        if canary_passed is not None:
            # Update canary pass rate with exponential moving average
            alpha = 0.1
            new_val = 1.0 if canary_passed else 0.0
            ev.canary_pass_rate = (1 - alpha) * ev.canary_pass_rate + alpha * new_val

    def to_dict(self) -> Dict[str, Any]:
        return {
            "evaluators": {k: v.to_dict() for k, v in self._evaluators.items()},
            "assignment_history": self._assignment_history,
            "canary_tasks_count": len(self._canary_tasks),
        }
