"""Agreement template library for Agent Service Agreements.

Provides default SLO configurations for common task types:
research, code_generation, data_analysis, translation, review, general.
"""

from typing import Any, Dict, List, Optional

from .schema import (
    EscrowConfig,
    GraduatedTier,
    Identity,
    QualityCriteria,
    QualityDimensionSpec,
    SLO,
    ServiceSpec,
    VerificationConfig,
    DEFAULT_GRADUATED_TIERS,
)
from .agreement import Agreement


# ---------------------------------------------------------------------------
# Template definitions
# ---------------------------------------------------------------------------

def _default_tiers() -> List[GraduatedTier]:
    return [GraduatedTier.from_dict(t) for t in DEFAULT_GRADUATED_TIERS]


TEMPLATES: Dict[str, Dict[str, Any]] = {
    "research": {
        "description": "Research synthesis, literature review, or knowledge compilation",
        "deliverable_format": "markdown",
        "dimensions": [
            {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 85}},
            {"name": "completeness", "weight": 0.20, "slo": {"operator": "gte", "value": 80}},
            {"name": "relevance", "weight": 0.20, "slo": {"operator": "gte", "value": 90}},
            {"name": "source_quality", "weight": 0.15, "slo": {"operator": "gte", "value": 70}},
            {"name": "writing_quality", "weight": 0.20, "slo": {"operator": "gte", "value": 75}},
        ],
        "composite_threshold": 75.0,
        "verification_depth": "semantic",
    },
    "code_generation": {
        "description": "Software development, code generation, or tool building",
        "deliverable_format": "code",
        "dimensions": [
            {"name": "correctness", "weight": 0.30, "slo": {"operator": "gte", "value": 95}},
            {"name": "performance", "weight": 0.20, "slo": {"operator": "gte", "value": 70}},
            {"name": "security", "weight": 0.20, "slo": {"operator": "gte", "value": 80}},
            {"name": "maintainability", "weight": 0.15, "slo": {"operator": "gte", "value": 70}},
            {"name": "test_coverage", "weight": 0.15, "slo": {"operator": "gte", "value": 60}},
        ],
        "composite_threshold": 80.0,
        "verification_depth": "composite",
    },
    "data_analysis": {
        "description": "Data analysis, statistical modeling, or insight generation",
        "deliverable_format": "markdown",
        "dimensions": [
            {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 90}},
            {"name": "methodology", "weight": 0.20, "slo": {"operator": "gte", "value": 75}},
            {"name": "depth", "weight": 0.20, "slo": {"operator": "gte", "value": 70}},
            {"name": "clarity", "weight": 0.15, "slo": {"operator": "gte", "value": 75}},
            {"name": "actionability", "weight": 0.20, "slo": {"operator": "gte", "value": 70}},
        ],
        "composite_threshold": 75.0,
        "verification_depth": "composite",
    },
    "translation": {
        "description": "Language translation with cultural adaptation",
        "deliverable_format": "text",
        "dimensions": [
            {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 90}},
            {"name": "fluency", "weight": 0.25, "slo": {"operator": "gte", "value": 85}},
            {"name": "cultural_fit", "weight": 0.15, "slo": {"operator": "gte", "value": 70}},
            {"name": "terminology", "weight": 0.20, "slo": {"operator": "gte", "value": 80}},
            {"name": "completeness", "weight": 0.15, "slo": {"operator": "gte", "value": 95}},
        ],
        "composite_threshold": 80.0,
        "verification_depth": "semantic",
    },
    "review": {
        "description": "Content review, editing, or quality assessment",
        "deliverable_format": "markdown",
        "dimensions": [
            {"name": "thoroughness", "weight": 0.25, "slo": {"operator": "gte", "value": 80}},
            {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 85}},
            {"name": "actionability", "weight": 0.20, "slo": {"operator": "gte", "value": 75}},
            {"name": "tone", "weight": 0.10, "slo": {"operator": "gte", "value": 70}},
            {"name": "completeness", "weight": 0.20, "slo": {"operator": "gte", "value": 80}},
        ],
        "composite_threshold": 75.0,
        "verification_depth": "semantic",
    },
    "general": {
        "description": "General-purpose task with standard quality dimensions",
        "deliverable_format": "text",
        "dimensions": [
            {"name": "accuracy", "weight": 0.25, "slo": {"operator": "gte", "value": 80}},
            {"name": "completeness", "weight": 0.20, "slo": {"operator": "gte", "value": 75}},
            {"name": "relevance", "weight": 0.20, "slo": {"operator": "gte", "value": 80}},
            {"name": "clarity", "weight": 0.20, "slo": {"operator": "gte", "value": 75}},
            {"name": "timeliness", "weight": 0.15, "metric": "boolean", "slo": {"operator": "eq", "value": True}},
        ],
        "composite_threshold": 70.0,
        "verification_depth": "structural",
    },
}


def list_templates() -> List[str]:
    """Return names of all available templates."""
    return sorted(TEMPLATES.keys())


def get_template(name: str) -> Optional[Dict[str, Any]]:
    """Get raw template data by name."""
    return TEMPLATES.get(name)


def create_agreement_from_template(
    template_name: str,
    client: Identity,
    provider: Identity,
    description: str = "",
    escrow_amount: Optional[str] = None,
    escrow_currency: str = "USD",
    expires_at: str = "",
    evaluator: Optional[Identity] = None,
    slo_overrides: Optional[Dict[str, Any]] = None,
) -> Agreement:
    """Create an Agreement pre-populated from a template.

    Args:
        template_name: One of the built-in template names
        client: Client identity
        provider: Provider identity
        description: Service description override
        escrow_amount: Payment amount (enables escrow if set)
        escrow_currency: Payment currency
        expires_at: Agreement expiry ISO timestamp
        evaluator: Optional evaluator identity
        slo_overrides: Dict mapping dimension names to SLO value overrides
    """
    tmpl = TEMPLATES.get(template_name)
    if tmpl is None:
        raise ValueError(
            f"Unknown template: {template_name}. "
            f"Available: {', '.join(list_templates())}"
        )

    # Build dimensions
    dims: List[QualityDimensionSpec] = []
    for dim_data in tmpl["dimensions"]:
        slo_data = dim_data.get("slo")
        # Apply SLO override if provided
        if slo_overrides and dim_data["name"] in slo_overrides:
            override = slo_overrides[dim_data["name"]]
            if isinstance(override, dict):
                slo_data = override
            else:
                slo_data = {"operator": "gte", "value": override}

        dims.append(QualityDimensionSpec(
            name=dim_data["name"],
            weight=dim_data["weight"],
            metric=dim_data.get("metric", "percentage"),
            slo=SLO.from_dict(slo_data) if slo_data else None,
        ))

    quality = QualityCriteria(
        dimensions=dims,
        composite_threshold=tmpl["composite_threshold"],
    )

    service = ServiceSpec(
        type=template_name,
        description=description or tmpl["description"],
        deliverable_format=tmpl["deliverable_format"],
    )

    verification = VerificationConfig(
        depth=tmpl["verification_depth"],
    )

    escrow = None
    if escrow_amount:
        escrow = EscrowConfig(
            enabled=True,
            amount=escrow_amount,
            currency=escrow_currency,
            tiers=_default_tiers(),
        )

    agreement = Agreement(
        client=client,
        provider=provider,
        evaluator=evaluator,
        service=service,
        quality_criteria=quality,
        verification=verification,
        escrow=escrow,
        expires_at=expires_at,
    )

    return agreement
