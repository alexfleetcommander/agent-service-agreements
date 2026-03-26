"""Tests for store.py — JSONL append-only store."""

import os
import tempfile
import pytest

from agent_service_agreements.schema import (
    Identity,
    NegotiationMessage,
    VerificationResult,
    DimensionScore,
    EscrowState,
    QualityCriteria,
    QualityDimensionSpec,
    SLO,
    ServiceSpec,
)
from agent_service_agreements.agreement import Agreement
from agent_service_agreements.store import AgreementStore


@pytest.fixture
def store(tmp_path):
    return AgreementStore(str(tmp_path / ".asa"))


def _make_agreement():
    return Agreement(
        client=Identity(scheme="api_key", value="c"),
        provider=Identity(scheme="api_key", value="p"),
        service=ServiceSpec(type="general"),
        quality_criteria=QualityCriteria(
            dimensions=[
                QualityDimensionSpec(name="accuracy", weight=1.0, slo=SLO("gte", 70)),
            ],
        ),
    )


class TestAgreementStore:
    def test_append_and_get(self, store):
        a = _make_agreement()
        aid = store.append_agreement(a)
        retrieved = store.get_agreement(aid)
        assert retrieved is not None
        assert retrieved.agreement_id == a.agreement_id

    def test_get_nonexistent(self, store):
        assert store.get_agreement("nope") is None

    def test_list_agreements(self, store):
        for _ in range(3):
            store.append_agreement(_make_agreement())
        assert len(store.get_agreements()) == 3

    def test_get_agreements_for(self, store):
        a = _make_agreement()
        store.append_agreement(a)
        results = store.get_agreements_for("c")
        assert len(results) == 1

    def test_append_negotiation(self, store):
        msg = NegotiationMessage(agreement_id="asa-1", action="propose")
        nid = store.append_negotiation(msg)
        msgs = store.get_negotiations_for("asa-1")
        assert len(msgs) == 1

    def test_append_verification(self, store):
        vr = VerificationResult(
            agreement_id="asa-1",
            composite_score=85.0,
            passed=True,
            dimensions=[DimensionScore(name="accuracy", score=85)],
        )
        vid = store.append_verification(vr)
        retrieved = store.get_verification(vid)
        assert retrieved is not None
        assert retrieved.composite_score == 85.0

    def test_append_escrow(self, store):
        es = EscrowState(agreement_id="asa-1", status="funded", funded_amount="10.00")
        store.append_escrow_state(es)
        latest = store.get_latest_escrow("asa-1")
        assert latest is not None
        assert latest.funded_amount == "10.00"

    def test_stats(self, store):
        store.append_agreement(_make_agreement())
        stats = store.stats()
        assert stats["agreements"]["count"] == 1
        assert stats["directory"] == str(store.directory)

    def test_persistence(self, tmp_path):
        path = str(tmp_path / ".asa2")
        store1 = AgreementStore(path)
        a = _make_agreement()
        store1.append_agreement(a)

        store2 = AgreementStore(path)
        assert len(store2.get_agreements()) == 1
