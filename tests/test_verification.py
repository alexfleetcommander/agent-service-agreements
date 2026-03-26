"""Tests for verification.py — quality verification engine."""

import pytest

from agent_service_agreements.schema import (
    Identity,
    QualityCriteria,
    QualityDimensionSpec,
    SLO,
    ServiceSpec,
    EscrowConfig,
    GraduatedTier,
    VerificationConfig,
)
from agent_service_agreements.agreement import Agreement
from agent_service_agreements.verification import (
    VerificationEngine,
    get_standalone_criteria,
    verify_structural,
    verify_semantic,
)


class TestStandaloneCriteria:
    def test_general(self):
        qc = get_standalone_criteria("general")
        assert len(qc.dimensions) == 5

    def test_code(self):
        qc = get_standalone_criteria("code")
        dim_names = [d.name for d in qc.dimensions]
        assert "correctness" in dim_names

    def test_unknown_falls_back(self):
        qc = get_standalone_criteria("unknown")
        assert len(qc.dimensions) == 5  # general defaults


class TestStructuralVerification:
    def test_empty_deliverable(self):
        qc = get_standalone_criteria("general")
        scores = verify_structural("", qc)
        assert all(s.score == 0 for s in scores)

    def test_none_deliverable(self):
        qc = get_standalone_criteria("general")
        scores = verify_structural(None, qc)
        assert all(s.score == 0 for s in scores)

    def test_text_deliverable(self):
        qc = get_standalone_criteria("general")
        text = "This is a test deliverable with enough content. " * 20
        scores = verify_structural(text, qc)
        assert all(s.score > 0 for s in scores)


class TestSemanticVerification:
    def test_without_evaluator(self):
        qc = get_standalone_criteria("general")
        scores = verify_semantic("test content", "test request", qc, None)
        # Falls back to structural
        assert len(scores) == len(qc.dimensions)

    def test_with_evaluator(self):
        def mock_evaluator(request, deliverable, dim):
            return (85.0, f"Evaluated {dim.name}")

        qc = get_standalone_criteria("general")
        scores = verify_semantic("test", "request", qc, mock_evaluator)
        assert all(s.score == 85.0 for s in scores)
        assert all("Evaluated" in s.evidence for s in scores)

    def test_score_clamping(self):
        def bad_evaluator(request, deliverable, dim):
            return (150.0, "Over 100")

        qc = get_standalone_criteria("general")
        scores = verify_semantic("test", "request", qc, bad_evaluator)
        assert all(s.score == 100.0 for s in scores)


class TestVerificationEngine:
    def test_standalone_verify(self):
        engine = VerificationEngine()
        result = engine.verify(
            deliverable="Test deliverable content " * 30,
            original_request="Write a summary",
        )
        assert result.verification_id.startswith("ver-")
        assert result.composite_score >= 0
        assert result.result_hash

    def test_verify_with_agreement(self):
        a = Agreement(
            client=Identity(scheme="api_key", value="c"),
            provider=Identity(scheme="api_key", value="p"),
            service=ServiceSpec(type="research"),
            quality_criteria=QualityCriteria(
                dimensions=[
                    QualityDimensionSpec(name="accuracy", weight=0.5, slo=SLO("gte", 80)),
                    QualityDimensionSpec(name="completeness", weight=0.5, slo=SLO("gte", 60)),
                ],
                composite_threshold=70.0,
            ),
            verification=VerificationConfig(depth="structural"),
        )
        engine = VerificationEngine()
        result = engine.verify(
            deliverable="Detailed research content " * 50,
            original_request="Research task",
            agreement=a,
        )
        assert result.agreement_id == a.agreement_id

    def test_pass_determination(self):
        def high_evaluator(req, deliv, dim):
            return (90.0, "High quality")

        engine = VerificationEngine(evaluator_fn=high_evaluator)
        qc = QualityCriteria(
            dimensions=[
                QualityDimensionSpec(name="accuracy", weight=1.0, slo=SLO("gte", 80)),
            ],
            composite_threshold=80.0,
        )
        result = engine.verify("content", "request", quality_criteria=qc)
        assert result.passed is True
        assert result.determination == "PASS"

    def test_fail_determination(self):
        def low_evaluator(req, deliv, dim):
            return (40.0, "Low quality")

        engine = VerificationEngine(evaluator_fn=low_evaluator)
        qc = QualityCriteria(
            dimensions=[
                QualityDimensionSpec(name="accuracy", weight=1.0, slo=SLO("gte", 80)),
            ],
            composite_threshold=80.0,
        )
        result = engine.verify("content", "request", quality_criteria=qc)
        assert result.passed is False
        assert result.determination == "FAIL"

    def test_payment_release_with_escrow(self):
        a = Agreement(
            client=Identity(scheme="api_key", value="c"),
            provider=Identity(scheme="api_key", value="p"),
            service=ServiceSpec(type="general"),
            quality_criteria=QualityCriteria(
                dimensions=[
                    QualityDimensionSpec(name="accuracy", weight=1.0, slo=SLO("gte", 70)),
                ],
                composite_threshold=70.0,
            ),
            verification=VerificationConfig(depth="structural"),
            escrow=EscrowConfig(
                enabled=True, amount="10.00",
                tiers=[
                    GraduatedTier(composite_score_gte=90, release_percent=100),
                    GraduatedTier(composite_score_gte=60, release_percent=50),
                    GraduatedTier(composite_score_lt=60, release_percent=0),
                ],
            ),
        )
        engine = VerificationEngine()
        result = engine.verify("Some content " * 50, agreement=a)
        assert result.payment_release_percent >= 0

    def test_deliverable_hash(self):
        engine = VerificationEngine()
        result = engine.verify("test content")
        assert result.deliverable_hash
        assert len(result.deliverable_hash) == 64
