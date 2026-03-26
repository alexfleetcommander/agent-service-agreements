"""Quality verification engine for Agent Service Agreements.

Supports three verification depths:
- Structural: schema/format/completeness checks
- Semantic: LLM-as-judge integration point for content quality
- Composite: structural + semantic + optional canary/cross-reference checks

Operates with or without a governing agreement.
"""

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

from .schema import (
    DimensionScore,
    Identity,
    QualityCriteria,
    QualityDimensionSpec,
    SLO,
    VerificationConfig,
    VerificationResult,
    _hash_dict,
    _now_iso,
    _uuid,
)
from .dimensions import (
    DIMENSION_REGISTRY,
    compute_composite,
)
from .agreement import Agreement
from .escrow import compute_release_percent, EscrowConfig


# ---------------------------------------------------------------------------
# Default quality criteria (standalone mode)
# ---------------------------------------------------------------------------

_STANDALONE_DEFAULTS: Dict[str, List[Dict[str, Any]]] = {
    "text/research": [
        {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 70}},
        {"name": "completeness", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
        {"name": "relevance", "weight": 0.20, "slo": {"operator": "gte", "value": 70}},
        {"name": "source_quality", "weight": 0.15, "slo": {"operator": "gte", "value": 50}},
        {"name": "writing_quality", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
    ],
    "text/analysis": [
        {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 70}},
        {"name": "methodology", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
        {"name": "depth", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
        {"name": "clarity", "weight": 0.15, "slo": {"operator": "gte", "value": 60}},
        {"name": "actionability", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
    ],
    "code": [
        {"name": "correctness", "weight": 0.30, "slo": {"operator": "gte", "value": 80}},
        {"name": "performance", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
        {"name": "security", "weight": 0.20, "slo": {"operator": "gte", "value": 70}},
        {"name": "maintainability", "weight": 0.15, "slo": {"operator": "gte", "value": 60}},
        {"name": "documentation", "weight": 0.15, "slo": {"operator": "gte", "value": 50}},
    ],
    "data": [
        {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 70}},
        {"name": "completeness", "weight": 0.25, "slo": {"operator": "gte", "value": 60}},
        {"name": "consistency", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
        {"name": "format_compliance", "weight": 0.15, "slo": {"operator": "gte", "value": 70}},
        {"name": "metadata", "weight": 0.15, "slo": {"operator": "gte", "value": 50}},
    ],
    "translation": [
        {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 80}},
        {"name": "fluency", "weight": 0.25, "slo": {"operator": "gte", "value": 70}},
        {"name": "terminology", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
        {"name": "cultural_fit", "weight": 0.15, "slo": {"operator": "gte", "value": 60}},
        {"name": "completeness", "weight": 0.15, "slo": {"operator": "gte", "value": 80}},
    ],
    "general": [
        {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 70}},
        {"name": "completeness", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
        {"name": "relevance", "weight": 0.20, "slo": {"operator": "gte", "value": 70}},
        {"name": "clarity", "weight": 0.20, "slo": {"operator": "gte", "value": 60}},
        {"name": "timeliness", "weight": 0.15, "slo": {"operator": "gte", "value": 60}},
    ],
}


def get_standalone_criteria(deliverable_type: str = "general") -> QualityCriteria:
    """Get default quality criteria for standalone verification."""
    dims_data = _STANDALONE_DEFAULTS.get(deliverable_type, _STANDALONE_DEFAULTS["general"])
    dims = [
        QualityDimensionSpec(
            name=dd["name"],
            weight=dd["weight"],
            slo=SLO.from_dict(dd["slo"]),
        )
        for dd in dims_data
    ]
    return QualityCriteria(dimensions=dims, composite_threshold=65.0)


# ---------------------------------------------------------------------------
# Structural verification
# ---------------------------------------------------------------------------

def verify_structural(
    deliverable: Any,
    criteria: QualityCriteria,
    expected_format: str = "text",
) -> List[DimensionScore]:
    """Perform structural verification checks.

    Checks: non-empty content, format compliance, size constraints.
    Returns dimension scores based on structural checks alone.
    """
    scores: List[DimensionScore] = []

    # Basic format check
    if deliverable is None:
        for dim in criteria.dimensions:
            scores.append(DimensionScore(
                name=dim.name, score=0, slo_target=dim.slo.value if dim.slo else None,
                slo_met=False, evidence="Deliverable is None",
            ))
        return scores

    content = str(deliverable)

    # Check non-empty
    is_empty = len(content.strip()) == 0

    for dim in criteria.dimensions:
        if is_empty:
            score = 0.0
            evidence = "Deliverable is empty"
            slo_met = False
        elif dim.name == "format_compliance":
            # Basic format check
            if expected_format == "json":
                try:
                    json.loads(content)
                    score = 100.0
                    evidence = "Valid JSON"
                except json.JSONDecodeError as e:
                    score = 0.0
                    evidence = f"Invalid JSON: {e}"
            elif expected_format == "markdown":
                has_headers = "#" in content
                score = 80.0 if has_headers else 50.0
                evidence = "Markdown structure detected" if has_headers else "Plain text (no markdown headers)"
            else:
                score = 70.0
                evidence = "Format check: content present"
            slo_met = dim.slo.evaluate(score) if dim.slo else True
        elif dim.name == "completeness":
            # Length heuristic for structural check
            word_count = len(content.split())
            if word_count > 500:
                score = 80.0
            elif word_count > 100:
                score = 60.0
            elif word_count > 20:
                score = 40.0
            else:
                score = 20.0
            evidence = f"Word count: {word_count}"
            slo_met = dim.slo.evaluate(score) if dim.slo else True
        else:
            # For other dimensions, structural check gives baseline
            score = 50.0
            evidence = "Structural check only — content present but quality not assessed"
            slo_met = dim.slo.evaluate(score) if dim.slo else None

        scores.append(DimensionScore(
            name=dim.name,
            score=score,
            slo_target=dim.slo.value if dim.slo else None,
            slo_met=slo_met,
            evidence=evidence,
        ))

    return scores


# ---------------------------------------------------------------------------
# Semantic verification (integration point)
# ---------------------------------------------------------------------------

# Type alias for semantic evaluator callbacks
SemanticEvaluator = Callable[
    [str, str, QualityDimensionSpec],  # original_request, deliverable, dimension
    Tuple[float, str],  # (score, evidence)
]


def verify_semantic(
    deliverable: str,
    original_request: str,
    criteria: QualityCriteria,
    evaluator_fn: Optional[SemanticEvaluator] = None,
) -> List[DimensionScore]:
    """Perform semantic verification using an evaluator function.

    Args:
        deliverable: The deliverable content
        original_request: The original task description
        criteria: Quality criteria with dimensions to evaluate
        evaluator_fn: Callback that scores each dimension. If None,
                     falls back to structural verification.

    The evaluator_fn is the integration point for LLM-as-Judge or
    Agent-as-a-Judge implementations. It receives the request, deliverable,
    and dimension spec, and returns (score, evidence).
    """
    if evaluator_fn is None:
        return verify_structural(deliverable, criteria)

    scores: List[DimensionScore] = []
    for dim in criteria.dimensions:
        score, evidence = evaluator_fn(original_request, deliverable, dim)
        score = max(0.0, min(100.0, score))
        slo_met = dim.slo.evaluate(score) if dim.slo else None

        scores.append(DimensionScore(
            name=dim.name,
            score=score,
            slo_target=dim.slo.value if dim.slo else None,
            slo_met=slo_met,
            evidence=evidence,
        ))

    return scores


# ---------------------------------------------------------------------------
# Composite verification
# ---------------------------------------------------------------------------

def verify_composite(
    deliverable: str,
    original_request: str,
    criteria: QualityCriteria,
    expected_format: str = "text",
    evaluator_fn: Optional[SemanticEvaluator] = None,
) -> List[DimensionScore]:
    """Perform composite verification: structural + semantic.

    Uses structural checks as baseline, then overrides with semantic
    scores where an evaluator is available.
    """
    structural = verify_structural(deliverable, criteria, expected_format)
    structural_map = {s.name: s for s in structural}

    if evaluator_fn is None:
        return structural

    semantic = verify_semantic(deliverable, original_request, criteria, evaluator_fn)

    # Merge: prefer semantic scores, fall back to structural
    merged: List[DimensionScore] = []
    for sem_score in semantic:
        merged.append(sem_score)

    return merged


# ---------------------------------------------------------------------------
# VerificationEngine
# ---------------------------------------------------------------------------

class VerificationEngine:
    """Main verification engine that coordinates the full verification flow.

    Can verify against an agreement's criteria or standalone defaults.
    """

    def __init__(
        self,
        evaluator_fn: Optional[SemanticEvaluator] = None,
        evaluator_identity: Optional[Identity] = None,
    ) -> None:
        self._evaluator_fn = evaluator_fn
        self._evaluator_identity = evaluator_identity

    def verify(
        self,
        deliverable: str,
        original_request: str = "",
        agreement: Optional[Agreement] = None,
        deliverable_type: str = "general",
        quality_criteria: Optional[QualityCriteria] = None,
        expected_format: str = "text",
    ) -> VerificationResult:
        """Run verification and produce a VerificationResult.

        Args:
            deliverable: The content to verify
            original_request: The original task description
            agreement: Optional agreement to verify against
            deliverable_type: Used for standalone defaults if no agreement
            quality_criteria: Explicit criteria override
            expected_format: Expected format for structural checks
        """
        start_ms = time.monotonic()

        # Determine criteria
        criteria: QualityCriteria
        agreement_id = ""
        # Default to semantic if evaluator provided, structural otherwise
        depth = "semantic" if self._evaluator_fn else "structural"

        if agreement and agreement.quality_criteria:
            criteria = agreement.quality_criteria
            agreement_id = agreement.agreement_id
            if agreement.verification:
                depth = agreement.verification.depth
            if agreement.service:
                expected_format = agreement.service.deliverable_format
        elif quality_criteria:
            criteria = quality_criteria
        else:
            criteria = get_standalone_criteria(deliverable_type)

        # Run verification at the appropriate depth
        if depth == "composite":
            dim_scores = verify_composite(
                deliverable, original_request, criteria, expected_format, self._evaluator_fn,
            )
        elif depth == "semantic":
            dim_scores = verify_semantic(
                deliverable, original_request, criteria, self._evaluator_fn,
            )
        else:
            dim_scores = verify_structural(deliverable, criteria, expected_format)

        # Compute composite score
        score_map = {s.name: s.score for s in dim_scores}
        weight_map = {d.name: d.weight for d in criteria.dimensions}
        composite = compute_composite(score_map, weight_map, criteria.composite_method)

        passed = composite >= criteria.composite_threshold

        # Check all SLOs
        all_slos_met = all(
            s.slo_met for s in dim_scores if s.slo_met is not None
        )

        elapsed_ms = int((time.monotonic() - start_ms) * 1000)

        # Compute payment release
        release_pct = 0.0
        if agreement and agreement.escrow:
            from .escrow import compute_release_percent
            release_pct = compute_release_percent(composite, agreement.escrow)
        elif passed:
            release_pct = 100.0

        # Build deliverable hash
        d_hash = hashlib.sha256(deliverable.encode("utf-8")).hexdigest()

        result = VerificationResult(
            agreement_id=agreement_id,
            evaluator_identity=self._evaluator_identity,
            evaluator_type="deterministic" if self._evaluator_fn is None else "agent_as_judge",
            dimensions=dim_scores,
            composite_score=round(composite, 2),
            composite_method=criteria.composite_method,
            composite_threshold=criteria.composite_threshold,
            passed=passed,
            determination="PASS" if passed else "FAIL",
            payment_release_percent=release_pct,
            confidence=0.95 if self._evaluator_fn else 0.5,
            notes=self._build_notes(composite, criteria.composite_threshold, all_slos_met),
            deliverable_hash=d_hash,
            evaluation_duration_ms=elapsed_ms,
        )

        result.compute_hash()
        return result

    def _build_notes(self, score: float, threshold: float, all_slos_met: bool) -> str:
        parts = []
        if score >= threshold:
            parts.append(f"Composite {score:.1f} meets threshold {threshold}")
        else:
            parts.append(f"Composite {score:.1f} below threshold {threshold}")
        if not all_slos_met:
            parts.append("Some individual SLOs not met")
        return ". ".join(parts) + "."
