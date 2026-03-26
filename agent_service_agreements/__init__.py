"""Agent Service Agreements — machine-readable contracts and quality
verification for autonomous agent commerce.

A pip-installable implementation of the ASA protocol, companion to
Chain of Consciousness, Agent Rating Protocol, and Agent Justice Protocol.
"""

from .schema import (
    ASA_VERSION,
    AGREEMENT_STATUSES,
    COMPOSITE_METHODS,
    DEFAULT_GRADUATED_TIERS,
    ESCROW_TYPES,
    EVALUATOR_SELECTION_MODES,
    EVALUATOR_TYPES,
    GUARANTEE_TYPES,
    GRADUATED_RELEASE_MODES,
    IDENTITY_SCHEMES,
    METRIC_TYPES,
    NEGOTIATION_ACTIONS,
    SERVICE_TYPES,
    SLO_OPERATORS,
    TIMEOUT_ACTIONS,
    VERIFICATION_DEPTHS,
    DimensionScore,
    EscrowConfig,
    EscrowState,
    GraduatedTier,
    Identity,
    NegotiationMessage,
    QualityCriteria,
    QualityDimensionSpec,
    ServiceSpec,
    SLO,
    VerificationConfig,
    VerificationResult,
)
from .agreement import Agreement
from .negotiation import NegotiationConfig, NegotiationSession
from .templates import (
    TEMPLATES,
    create_agreement_from_template,
    get_template,
    list_templates,
)
from .escrow import (
    EscrowBinding,
    compute_continuous_release,
    compute_release_percent,
    compute_tiered_release,
)
from .verification import (
    VerificationEngine,
    get_standalone_criteria,
    verify_composite,
    verify_semantic,
    verify_structural,
)
from .evaluator import (
    CanaryTask,
    EvaluatorRecord,
    EvaluatorRegistry,
)
from .dimensions import (
    DIMENSION_REGISTRY,
    QualityDimension,
    compute_composite,
    compute_geometric_mean,
    compute_harmonic_mean,
    compute_weighted_average,
    get_dimension,
    list_dimensions,
)
from .store import AgreementStore

__all__ = [
    # Schema / constants
    "ASA_VERSION",
    "AGREEMENT_STATUSES",
    "COMPOSITE_METHODS",
    "DEFAULT_GRADUATED_TIERS",
    "ESCROW_TYPES",
    "EVALUATOR_SELECTION_MODES",
    "EVALUATOR_TYPES",
    "GUARANTEE_TYPES",
    "GRADUATED_RELEASE_MODES",
    "IDENTITY_SCHEMES",
    "METRIC_TYPES",
    "NEGOTIATION_ACTIONS",
    "SERVICE_TYPES",
    "SLO_OPERATORS",
    "TIMEOUT_ACTIONS",
    "VERIFICATION_DEPTHS",
    # Data structures
    "DimensionScore",
    "EscrowConfig",
    "EscrowState",
    "GraduatedTier",
    "Identity",
    "NegotiationMessage",
    "QualityCriteria",
    "QualityDimensionSpec",
    "ServiceSpec",
    "SLO",
    "VerificationConfig",
    "VerificationResult",
    # Agreement
    "Agreement",
    # Negotiation
    "NegotiationConfig",
    "NegotiationSession",
    # Templates
    "TEMPLATES",
    "create_agreement_from_template",
    "get_template",
    "list_templates",
    # Escrow
    "EscrowBinding",
    "compute_continuous_release",
    "compute_release_percent",
    "compute_tiered_release",
    # Verification
    "VerificationEngine",
    "get_standalone_criteria",
    "verify_composite",
    "verify_semantic",
    "verify_structural",
    # Evaluator
    "CanaryTask",
    "EvaluatorRecord",
    "EvaluatorRegistry",
    # Dimensions
    "DIMENSION_REGISTRY",
    "QualityDimension",
    "compute_composite",
    "compute_geometric_mean",
    "compute_harmonic_mean",
    "compute_weighted_average",
    "get_dimension",
    "list_dimensions",
    # Store
    "AgreementStore",
]

__version__ = "0.1.0"
