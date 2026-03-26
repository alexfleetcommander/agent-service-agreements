"""Tests for agreement.py — Agreement lifecycle and serialization."""

import json
import pytest

from agent_service_agreements.schema import (
    Identity,
    QualityCriteria,
    QualityDimensionSpec,
    SLO,
    ServiceSpec,
    EscrowConfig,
)
from agent_service_agreements.agreement import Agreement


def _make_agreement(**overrides):
    defaults = dict(
        client=Identity(scheme="api_key", value="client-1"),
        provider=Identity(scheme="api_key", value="provider-1"),
        service=ServiceSpec(type="research", description="Test task"),
        quality_criteria=QualityCriteria(
            dimensions=[
                QualityDimensionSpec(name="accuracy", weight=0.5, slo=SLO("gte", 80)),
                QualityDimensionSpec(name="completeness", weight=0.5, slo=SLO("gte", 70)),
            ],
            composite_threshold=75.0,
        ),
    )
    defaults.update(overrides)
    return Agreement(**defaults)


class TestAgreementCreation:
    def test_auto_id(self):
        a = _make_agreement()
        assert a.agreement_id.startswith("asa-")

    def test_default_status(self):
        a = _make_agreement()
        assert a.status == "proposed"

    def test_hash(self):
        a = _make_agreement()
        h = a.compute_hash()
        assert len(h) == 64
        assert a.agreement_hash == h


class TestAgreementValidation:
    def test_valid(self):
        a = _make_agreement()
        assert a.is_valid()

    def test_missing_client(self):
        a = _make_agreement(client=None)
        errors = a.validate()
        assert any("client" in e for e in errors)

    def test_missing_provider(self):
        a = _make_agreement(provider=None)
        errors = a.validate()
        assert any("provider" in e for e in errors)

    def test_missing_service(self):
        a = _make_agreement(service=None)
        errors = a.validate()
        assert any("service" in e for e in errors)

    def test_no_dimensions(self):
        a = _make_agreement(
            quality_criteria=QualityCriteria(dimensions=[])
        )
        errors = a.validate()
        assert any("dimension" in e for e in errors)


class TestAgreementLifecycle:
    def test_sign_and_activate(self):
        a = _make_agreement()
        a.sign("client", "sig-c")
        assert a.status == "proposed"  # Not yet active
        a.sign("provider", "sig-p")
        assert a.status == "active"
        assert a.agreement_hash  # Hash computed on activation

    def test_deliver(self):
        a = _make_agreement()
        a.sign("client", "sig-c")
        a.sign("provider", "sig-p")
        a.deliver("sha256:abc123")
        assert a.status == "delivered"
        assert a.deliverable_hash == "sha256:abc123"

    def test_deliver_wrong_status(self):
        a = _make_agreement()
        with pytest.raises(ValueError, match="must be 'active'"):
            a.deliver("sha256:abc123")

    def test_verify(self):
        a = _make_agreement()
        a.sign("client", "c")
        a.sign("provider", "p")
        a.deliver("hash")
        a.mark_verified(True)
        assert a.status == "verified"

    def test_close(self):
        a = _make_agreement()
        a.sign("client", "c")
        a.sign("provider", "p")
        a.deliver("hash")
        a.mark_verified(True)
        a.close()
        assert a.status == "closed"

    def test_dispute(self):
        a = _make_agreement()
        a.sign("client", "c")
        a.sign("provider", "p")
        a.deliver("hash")
        a.dispute()
        assert a.status == "disputed"

    def test_reject(self):
        a = _make_agreement()
        a.reject()
        assert a.status == "rejected"

    def test_expire(self):
        a = _make_agreement()
        a.expire()
        assert a.status == "expired"


class TestAgreementSerialization:
    def test_to_dict_roundtrip(self):
        a = _make_agreement()
        a.compute_hash()
        d = a.to_dict()
        a2 = Agreement.from_dict(d)
        assert a2.agreement_id == a.agreement_id
        assert a2.client.value == "client-1"
        assert a2.provider.value == "provider-1"
        assert len(a2.quality_criteria.dimensions) == 2

    def test_json_roundtrip(self):
        a = _make_agreement()
        a.compute_hash()
        j = a.to_json()
        a2 = Agreement.from_json(j)
        assert a2.agreement_id == a.agreement_id
        assert a2.agreement_hash == a.agreement_hash
