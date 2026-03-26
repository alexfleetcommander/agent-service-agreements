"""Tests for templates.py — agreement template library."""

import pytest

from agent_service_agreements.schema import Identity
from agent_service_agreements.templates import (
    TEMPLATES,
    create_agreement_from_template,
    get_template,
    list_templates,
)


class TestTemplateRegistry:
    def test_list_templates(self):
        names = list_templates()
        assert "research" in names
        assert "code_generation" in names
        assert "translation" in names
        assert len(names) >= 6

    def test_get_template(self):
        t = get_template("research")
        assert t is not None
        assert "dimensions" in t
        assert len(t["dimensions"]) >= 4

    def test_get_unknown(self):
        assert get_template("nonexistent") is None


class TestCreateFromTemplate:
    def _ids(self):
        return (
            Identity(scheme="api_key", value="client-1"),
            Identity(scheme="api_key", value="provider-1"),
        )

    def test_research(self):
        c, p = self._ids()
        a = create_agreement_from_template("research", client=c, provider=p)
        assert a.service.type == "research"
        assert a.quality_criteria is not None
        assert len(a.quality_criteria.dimensions) == 5
        assert a.quality_criteria.composite_threshold == 75.0

    def test_code_generation(self):
        c, p = self._ids()
        a = create_agreement_from_template("code_generation", client=c, provider=p)
        assert a.quality_criteria.composite_threshold == 80.0
        dim_names = [d.name for d in a.quality_criteria.dimensions]
        assert "correctness" in dim_names
        assert "security" in dim_names

    def test_with_escrow(self):
        c, p = self._ids()
        a = create_agreement_from_template(
            "general", client=c, provider=p,
            escrow_amount="10.00", escrow_currency="USDC",
        )
        assert a.escrow is not None
        assert a.escrow.enabled is True
        assert a.escrow.amount == "10.00"
        assert a.escrow.currency == "USDC"

    def test_slo_override(self):
        c, p = self._ids()
        a = create_agreement_from_template(
            "research", client=c, provider=p,
            slo_overrides={"accuracy": 95},
        )
        accuracy_dim = next(d for d in a.quality_criteria.dimensions if d.name == "accuracy")
        assert accuracy_dim.slo.value == 95

    def test_unknown_template(self):
        c, p = self._ids()
        with pytest.raises(ValueError, match="Unknown template"):
            create_agreement_from_template("invalid", client=c, provider=p)

    def test_all_templates_produce_valid_agreements(self):
        c, p = self._ids()
        for name in list_templates():
            a = create_agreement_from_template(name, client=c, provider=p)
            assert a.is_valid(), f"Template {name} produced invalid agreement: {a.validate()}"
