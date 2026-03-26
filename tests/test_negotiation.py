"""Tests for negotiation.py — multi-round negotiation protocol."""

import pytest

from agent_service_agreements.schema import Identity
from agent_service_agreements.agreement import Agreement
from agent_service_agreements.templates import create_agreement_from_template
from agent_service_agreements.negotiation import (
    NegotiationConfig,
    NegotiationSession,
)


def _ids():
    return (
        Identity(scheme="api_key", value="client-1"),
        Identity(scheme="api_key", value="provider-1"),
    )


def _agreement():
    c, p = _ids()
    return create_agreement_from_template("research", client=c, provider=p)


class TestNegotiationSession:
    def test_propose(self):
        c, p = _ids()
        sess = NegotiationSession()
        msg = sess.propose(c, _agreement())
        assert msg.action == "propose"
        assert sess.agreement is not None
        assert len(sess.messages) == 1

    def test_counter(self):
        c, p = _ids()
        sess = NegotiationSession()
        sess.propose(c, _agreement())
        msg = sess.counter(
            p, {"quality_criteria.composite_threshold": 70},
            rationale_code="lower_threshold",
        )
        assert msg.action == "counter"
        assert sess.current_round == 1

    def test_accept(self):
        c, p = _ids()
        sess = NegotiationSession()
        sess.propose(c, _agreement())
        msg = sess.accept(p)
        assert msg.action == "accept"
        assert sess.status == "accepted"

    def test_reject(self):
        c, p = _ids()
        sess = NegotiationSession()
        sess.propose(c, _agreement())
        msg = sess.reject(p, rationale_code="too_expensive")
        assert msg.action == "reject"
        assert sess.status == "rejected"

    def test_max_rounds(self):
        c, p = _ids()
        sess = NegotiationSession(config=NegotiationConfig(max_rounds=2))
        sess.propose(c, _agreement())
        sess.counter(p, {"quality_criteria.composite_threshold": 70})
        sess.counter(c, {"quality_criteria.composite_threshold": 72})
        with pytest.raises(ValueError, match="Maximum rounds"):
            sess.counter(p, {"quality_criteria.composite_threshold": 71})

    def test_cannot_propose_twice(self):
        c, p = _ids()
        sess = NegotiationSession()
        sess.propose(c, _agreement())
        with pytest.raises(ValueError, match="Proposal already exists"):
            sess.propose(p, _agreement())

    def test_cannot_counter_closed(self):
        c, p = _ids()
        sess = NegotiationSession()
        sess.propose(c, _agreement())
        sess.accept(p)
        with pytest.raises(ValueError, match="accepted"):
            sess.counter(c, {})

    def test_counter_applies_changes(self):
        c, p = _ids()
        a = _agreement()
        sess = NegotiationSession()
        sess.propose(c, a)
        sess.counter(p, {"quality_criteria.composite_threshold": 80})
        assert sess.agreement.quality_criteria.composite_threshold == 80.0

    def test_session_serialization(self):
        c, p = _ids()
        sess = NegotiationSession()
        sess.propose(c, _agreement())
        d = sess.to_dict()
        assert d["status"] == "open"
        assert len(d["messages"]) == 1


class TestNegotiationConfig:
    def test_defaults(self):
        cfg = NegotiationConfig()
        assert cfg.max_rounds == 5
        assert cfg.asymmetry_limit_pct == 25.0

    def test_roundtrip(self):
        cfg = NegotiationConfig(max_rounds=3)
        d = cfg.to_dict()
        cfg2 = NegotiationConfig.from_dict(d)
        assert cfg2.max_rounds == 3
