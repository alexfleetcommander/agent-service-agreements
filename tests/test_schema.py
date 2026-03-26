"""Tests for schema.py — data structures, serialization, hashing."""

import json
import pytest

from agent_service_agreements.schema import (
    ASA_VERSION,
    DimensionScore,
    EscrowConfig,
    EscrowState,
    GraduatedTier,
    Identity,
    NegotiationMessage,
    QualityCriteria,
    QualityDimensionSpec,
    SLO,
    ServiceSpec,
    VerificationConfig,
    VerificationResult,
    _hash_dict,
)


class TestIdentity:
    def test_create_valid(self):
        i = Identity(scheme="api_key", value="key-123", display_name="Test")
        assert i.scheme == "api_key"
        assert i.value == "key-123"

    def test_invalid_scheme(self):
        with pytest.raises(ValueError, match="Unknown identity scheme"):
            Identity(scheme="invalid", value="x")

    def test_roundtrip(self):
        i = Identity(scheme="coc", value="sha256:abc", display_name="Agent")
        d = i.to_dict()
        i2 = Identity.from_dict(d)
        assert i2.scheme == i.scheme
        assert i2.value == i.value
        assert i2.display_name == i.display_name


class TestSLO:
    def test_gte(self):
        slo = SLO(operator="gte", value=85)
        assert slo.evaluate(85) is True
        assert slo.evaluate(90) is True
        assert slo.evaluate(84) is False

    def test_lte(self):
        slo = SLO(operator="lte", value=5)
        assert slo.evaluate(3) is True
        assert slo.evaluate(6) is False

    def test_eq(self):
        slo = SLO(operator="eq", value=True)
        assert slo.evaluate(True) is True
        assert slo.evaluate(False) is False

    def test_between(self):
        slo = SLO(operator="between", value=[60, 90])
        assert slo.evaluate(75) is True
        assert slo.evaluate(59) is False

    def test_invalid_operator(self):
        with pytest.raises(ValueError):
            SLO(operator="invalid", value=1)

    def test_roundtrip(self):
        slo = SLO(operator="gte", value=85)
        d = slo.to_dict()
        slo2 = SLO.from_dict(d)
        assert slo2.operator == slo.operator
        assert slo2.value == slo.value


class TestQualityDimensionSpec:
    def test_basic(self):
        dim = QualityDimensionSpec(
            name="accuracy", weight=0.25,
            slo=SLO(operator="gte", value=85),
        )
        assert dim.name == "accuracy"
        assert dim.weight == 0.25

    def test_roundtrip(self):
        dim = QualityDimensionSpec(
            name="accuracy", weight=0.25, metric="percentage",
            slo=SLO(operator="gte", value=85),
            shadow_metric="hallucination_rate",
            shadow_slo=SLO(operator="lte", value=5),
        )
        d = dim.to_dict()
        dim2 = QualityDimensionSpec.from_dict(d)
        assert dim2.name == dim.name
        assert dim2.shadow_metric == "hallucination_rate"


class TestQualityCriteria:
    def test_roundtrip(self):
        qc = QualityCriteria(
            dimensions=[
                QualityDimensionSpec(name="accuracy", weight=0.5, slo=SLO("gte", 80)),
                QualityDimensionSpec(name="completeness", weight=0.5, slo=SLO("gte", 70)),
            ],
            composite_threshold=75.0,
        )
        d = qc.to_dict()
        qc2 = QualityCriteria.from_dict(d)
        assert len(qc2.dimensions) == 2
        assert qc2.composite_threshold == 75.0


class TestServiceSpec:
    def test_roundtrip(self):
        s = ServiceSpec(type="research", description="Test", max_tokens=5000)
        d = s.to_dict()
        s2 = ServiceSpec.from_dict(d)
        assert s2.type == "research"
        assert s2.max_tokens == 5000


class TestEscrowConfig:
    def test_defaults(self):
        ec = EscrowConfig()
        assert ec.dead_mans_switch_action == "hold_for_backup_evaluator"

    def test_roundtrip(self):
        ec = EscrowConfig(
            enabled=True, amount="10.00", currency="USDC",
            tiers=[GraduatedTier(composite_score_gte=90, release_percent=100)],
        )
        d = ec.to_dict()
        ec2 = EscrowConfig.from_dict(d)
        assert ec2.enabled is True
        assert ec2.amount == "10.00"
        assert len(ec2.tiers) == 1


class TestNegotiationMessage:
    def test_auto_id(self):
        msg = NegotiationMessage()
        assert msg.negotiation_id.startswith("neg-")

    def test_hash(self):
        msg = NegotiationMessage(action="propose")
        h = msg.compute_hash()
        assert len(h) == 64  # SHA-256

    def test_roundtrip(self):
        msg = NegotiationMessage(
            action="counter",
            proposed_changes={"quality_criteria.composite_threshold": 80},
        )
        msg.compute_hash()
        d = msg.to_dict()
        msg2 = NegotiationMessage.from_dict(d)
        assert msg2.action == "counter"
        assert msg2.message_hash == msg.message_hash


class TestVerificationResult:
    def test_auto_id(self):
        vr = VerificationResult()
        assert vr.verification_id.startswith("ver-")

    def test_hash(self):
        vr = VerificationResult(composite_score=85.0, passed=True)
        h = vr.compute_hash()
        assert len(h) == 64

    def test_roundtrip(self):
        vr = VerificationResult(
            composite_score=86.1, passed=True, determination="PASS",
            dimensions=[
                DimensionScore(name="accuracy", score=88, slo_target=85, slo_met=True),
            ],
        )
        vr.compute_hash()
        d = vr.to_dict()
        vr2 = VerificationResult.from_dict(d)
        assert vr2.composite_score == 86.1
        assert vr2.passed is True
        assert len(vr2.dimensions) == 1


class TestEscrowState:
    def test_hash(self):
        es = EscrowState(agreement_id="asa-123", status="funded", funded_amount="5.00")
        h = es.compute_hash()
        assert len(h) == 64

    def test_roundtrip(self):
        es = EscrowState(agreement_id="asa-123", status="released", release_percent=85.0)
        d = es.to_dict()
        es2 = EscrowState.from_dict(d)
        assert es2.release_percent == 85.0


class TestHashDict:
    def test_deterministic(self):
        d = {"b": 2, "a": 1}
        h1 = _hash_dict(d)
        h2 = _hash_dict(d)
        assert h1 == h2

    def test_key_order_invariant(self):
        h1 = _hash_dict({"a": 1, "b": 2})
        h2 = _hash_dict({"b": 2, "a": 1})
        assert h1 == h2
