"""Shared data structures and JSON schemas for Agent Service Agreements.

Implements the ASA protocol data model: agreement documents, negotiation messages,
verification results, escrow state, and identity/quality structures.
Zero external dependencies.
"""

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ASA_VERSION = "1.0.0"

IDENTITY_SCHEMES = (
    "coc", "erc8004", "a2a", "w3c_vc", "w3c_did", "mcp", "api_key", "uri",
)

AGREEMENT_STATUSES = (
    "proposed", "negotiating", "active", "delivered",
    "verified", "closed", "disputed", "expired", "rejected",
)

NEGOTIATION_ACTIONS = ("propose", "counter", "accept", "reject")

VERIFICATION_DEPTHS = ("structural", "semantic", "composite")

EVALUATOR_TYPES = ("agent_as_judge", "deterministic", "hybrid")

EVALUATOR_SELECTION_MODES = (
    "random_from_pool", "mutual_agreement", "marketplace",
)

COMPOSITE_METHODS = ("weighted_average", "geometric_mean", "harmonic_mean")

GUARANTEE_TYPES = ("deterministic", "probabilistic")

SLO_OPERATORS = ("gte", "lte", "gt", "lt", "eq", "neq", "between")

METRIC_TYPES = ("percentage", "boolean", "count", "duration_seconds", "score")

ESCROW_TYPES = ("erc8183", "x402", "http_callback", "manual")

TIMEOUT_ACTIONS = (
    "hold_for_backup_evaluator", "split_50_50",
    "return_to_client", "release_to_provider",
)

GRADUATED_RELEASE_MODES = ("tiered", "continuous")

SERVICE_TYPES = (
    "research", "code_generation", "data_analysis",
    "translation", "review", "general",
)

DEFAULT_GRADUATED_TIERS = [
    {"composite_score_gte": 90, "release_percent": 100},
    {"composite_score_gte": 75, "release_percent": 85},
    {"composite_score_gte": 60, "release_percent": 50},
    {"composite_score_lt": 60, "release_percent": 0},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uuid() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _hash_dict(d: Dict[str, Any]) -> str:
    canonical = json.dumps(d, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------

@dataclass
class Identity:
    scheme: str
    value: str
    display_name: str = ""

    def __post_init__(self) -> None:
        if self.scheme not in IDENTITY_SCHEMES:
            raise ValueError(f"Unknown identity scheme: {self.scheme}")

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"scheme": self.scheme, "value": self.value}
        if self.display_name:
            d["display_name"] = self.display_name
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Identity":
        return cls(
            scheme=d["scheme"],
            value=d["value"],
            display_name=d.get("display_name", ""),
        )


# ---------------------------------------------------------------------------
# SLO (Service Level Objective)
# ---------------------------------------------------------------------------

@dataclass
class SLO:
    operator: str
    value: Any

    def __post_init__(self) -> None:
        if self.operator not in SLO_OPERATORS:
            raise ValueError(f"Unknown SLO operator: {self.operator}")

    def evaluate(self, actual: Any) -> bool:
        if self.operator == "gte":
            return actual >= self.value
        elif self.operator == "lte":
            return actual <= self.value
        elif self.operator == "gt":
            return actual > self.value
        elif self.operator == "lt":
            return actual < self.value
        elif self.operator == "eq":
            return actual == self.value
        elif self.operator == "neq":
            return actual != self.value
        elif self.operator == "between":
            low, high = self.value
            return low <= actual <= high
        return False

    def to_dict(self) -> Dict[str, Any]:
        return {"operator": self.operator, "value": self.value}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "SLO":
        return cls(operator=d["operator"], value=d["value"])


# ---------------------------------------------------------------------------
# Quality Dimension (within an agreement)
# ---------------------------------------------------------------------------

@dataclass
class QualityDimensionSpec:
    """A quality dimension specification in an agreement's quality_criteria."""
    name: str
    weight: float
    metric: str = "percentage"
    slo: Optional[SLO] = None
    shadow_metric: Optional[str] = None
    shadow_slo: Optional[SLO] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "name": self.name,
            "weight": self.weight,
            "metric": self.metric,
        }
        if self.slo:
            d["slo"] = self.slo.to_dict()
        if self.shadow_metric:
            d["shadow_metric"] = self.shadow_metric
        if self.shadow_slo:
            d["shadow_slo"] = self.shadow_slo.to_dict()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "QualityDimensionSpec":
        return cls(
            name=d["name"],
            weight=d["weight"],
            metric=d.get("metric", "percentage"),
            slo=SLO.from_dict(d["slo"]) if d.get("slo") else None,
            shadow_metric=d.get("shadow_metric"),
            shadow_slo=SLO.from_dict(d["shadow_slo"]) if d.get("shadow_slo") else None,
        )


# ---------------------------------------------------------------------------
# Quality Criteria
# ---------------------------------------------------------------------------

@dataclass
class QualityCriteria:
    dimensions: List[QualityDimensionSpec] = field(default_factory=list)
    composite_threshold: float = 75.0
    composite_method: str = "weighted_average"
    guarantee_type: str = "deterministic"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dimensions": [d.to_dict() for d in self.dimensions],
            "composite_threshold": self.composite_threshold,
            "composite_method": self.composite_method,
            "guarantee_type": self.guarantee_type,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "QualityCriteria":
        return cls(
            dimensions=[QualityDimensionSpec.from_dict(dim) for dim in d.get("dimensions", [])],
            composite_threshold=d.get("composite_threshold", 75.0),
            composite_method=d.get("composite_method", "weighted_average"),
            guarantee_type=d.get("guarantee_type", "deterministic"),
        )


# ---------------------------------------------------------------------------
# Service definition
# ---------------------------------------------------------------------------

@dataclass
class ServiceSpec:
    type: str
    description: str = ""
    deliverable_format: str = "text"
    max_tokens: Optional[int] = None
    max_duration_seconds: Optional[int] = None
    max_cost_usd: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"type": self.type, "description": self.description,
                              "deliverable_format": self.deliverable_format}
        constraints: Dict[str, Any] = {}
        if self.max_tokens is not None:
            constraints["max_tokens"] = self.max_tokens
        if self.max_duration_seconds is not None:
            constraints["max_duration_seconds"] = self.max_duration_seconds
        if self.max_cost_usd is not None:
            constraints["max_cost_usd"] = self.max_cost_usd
        if constraints:
            d["constraints"] = constraints
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ServiceSpec":
        c = d.get("constraints", {})
        return cls(
            type=d["type"],
            description=d.get("description", ""),
            deliverable_format=d.get("deliverable_format", "text"),
            max_tokens=c.get("max_tokens"),
            max_duration_seconds=c.get("max_duration_seconds"),
            max_cost_usd=c.get("max_cost_usd"),
        )


# ---------------------------------------------------------------------------
# Escrow configuration
# ---------------------------------------------------------------------------

@dataclass
class GraduatedTier:
    composite_score_gte: Optional[float] = None
    composite_score_lt: Optional[float] = None
    release_percent: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"release_percent": self.release_percent}
        if self.composite_score_gte is not None:
            d["composite_score_gte"] = self.composite_score_gte
        if self.composite_score_lt is not None:
            d["composite_score_lt"] = self.composite_score_lt
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "GraduatedTier":
        return cls(
            composite_score_gte=d.get("composite_score_gte"),
            composite_score_lt=d.get("composite_score_lt"),
            release_percent=d.get("release_percent", 0.0),
        )


@dataclass
class EscrowConfig:
    enabled: bool = False
    type: str = "http_callback"
    amount: Optional[str] = None
    currency: str = "USD"
    graduated_release_mode: str = "tiered"
    tiers: List[GraduatedTier] = field(default_factory=list)
    dead_mans_switch_action: str = "hold_for_backup_evaluator"
    client_timeout_seconds: int = 86400
    provider_timeout_seconds: int = 86400
    evaluator_timeout_seconds: int = 3600

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"enabled": self.enabled, "type": self.type}
        if self.amount is not None:
            d["payment"] = {
                "amount": self.amount,
                "currency": self.currency,
                "graduated_release": {
                    "mode": self.graduated_release_mode,
                    "tiers": [t.to_dict() for t in self.tiers],
                },
            }
        d["dead_mans_switch"] = {
            "client_timeout_seconds": self.client_timeout_seconds,
            "provider_timeout_seconds": self.provider_timeout_seconds,
            "evaluator_timeout_seconds": self.evaluator_timeout_seconds,
            "timeout_action": self.dead_mans_switch_action,
        }
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "EscrowConfig":
        payment = d.get("payment", {})
        gr = payment.get("graduated_release", {})
        dms = d.get("dead_mans_switch", {})
        tiers_raw = gr.get("tiers", [])
        return cls(
            enabled=d.get("enabled", False),
            type=d.get("type", "http_callback"),
            amount=payment.get("amount"),
            currency=payment.get("currency", "USD"),
            graduated_release_mode=gr.get("mode", "tiered"),
            tiers=[GraduatedTier.from_dict(t) for t in tiers_raw],
            dead_mans_switch_action=dms.get("timeout_action", "hold_for_backup_evaluator"),
            client_timeout_seconds=dms.get("client_timeout_seconds", 86400),
            provider_timeout_seconds=dms.get("provider_timeout_seconds", 86400),
            evaluator_timeout_seconds=dms.get("evaluator_timeout_seconds", 3600),
        )


# ---------------------------------------------------------------------------
# Verification configuration
# ---------------------------------------------------------------------------

@dataclass
class VerificationConfig:
    strategy: str = "optimistic"
    depth: str = "semantic"
    challenge_window_seconds: int = 7200
    evaluator_timeout_seconds: int = 600
    canary_enabled: bool = False
    canary_frequency: str = "1_per_5_deliveries"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "strategy": self.strategy,
            "depth": self.depth,
            "challenge_window_seconds": self.challenge_window_seconds,
            "evaluator_timeout_seconds": self.evaluator_timeout_seconds,
            "canary_tasks": {
                "enabled": self.canary_enabled,
                "frequency": self.canary_frequency,
            },
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "VerificationConfig":
        canary = d.get("canary_tasks", {})
        return cls(
            strategy=d.get("strategy", "optimistic"),
            depth=d.get("depth", "semantic"),
            challenge_window_seconds=d.get("challenge_window_seconds", 7200),
            evaluator_timeout_seconds=d.get("evaluator_timeout_seconds", 600),
            canary_enabled=canary.get("enabled", False),
            canary_frequency=canary.get("frequency", "1_per_5_deliveries"),
        )


# ---------------------------------------------------------------------------
# Negotiation message
# ---------------------------------------------------------------------------

@dataclass
class NegotiationMessage:
    negotiation_id: str = ""
    agreement_id: str = ""
    round: int = 0
    action: str = "propose"
    sender: Optional[Identity] = None
    proposed_changes: Dict[str, Any] = field(default_factory=dict)
    rationale_code: str = ""
    timestamp: str = ""
    message_hash: str = ""

    def __post_init__(self) -> None:
        if not self.negotiation_id:
            self.negotiation_id = f"neg-{_uuid()[:12]}"
        if not self.timestamp:
            self.timestamp = _now_iso()

    def compute_hash(self) -> str:
        d = {
            "negotiation_id": self.negotiation_id,
            "agreement_id": self.agreement_id,
            "round": self.round,
            "action": self.action,
            "proposed_changes": self.proposed_changes,
            "timestamp": self.timestamp,
        }
        self.message_hash = _hash_dict(d)
        return self.message_hash

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "negotiation_id": self.negotiation_id,
            "agreement_id": self.agreement_id,
            "round": self.round,
            "action": self.action,
            "proposed_changes": self.proposed_changes,
            "rationale_code": self.rationale_code,
            "timestamp": self.timestamp,
        }
        if self.sender:
            d["sender"] = self.sender.to_dict()
        if self.message_hash:
            d["message_hash"] = self.message_hash
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "NegotiationMessage":
        return cls(
            negotiation_id=d.get("negotiation_id", ""),
            agreement_id=d.get("agreement_id", ""),
            round=d.get("round", 0),
            action=d.get("action", "propose"),
            sender=Identity.from_dict(d["sender"]) if d.get("sender") else None,
            proposed_changes=d.get("proposed_changes", {}),
            rationale_code=d.get("rationale_code", ""),
            timestamp=d.get("timestamp", ""),
            message_hash=d.get("message_hash", ""),
        )


# ---------------------------------------------------------------------------
# Dimension score (verification result)
# ---------------------------------------------------------------------------

@dataclass
class DimensionScore:
    name: str
    score: float
    slo_target: Any = None
    slo_met: Optional[bool] = None
    evidence: str = ""
    shadow_metric_name: Optional[str] = None
    shadow_metric_value: Optional[float] = None
    shadow_slo_target: Any = None
    shadow_slo_met: Optional[bool] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"name": self.name, "score": self.score}
        if self.slo_target is not None:
            d["slo_target"] = self.slo_target
        if self.slo_met is not None:
            d["slo_met"] = self.slo_met
        if self.evidence:
            d["evidence"] = self.evidence
        if self.shadow_metric_name:
            d["shadow_metric"] = {
                "name": self.shadow_metric_name,
                "value": self.shadow_metric_value,
                "slo_target": self.shadow_slo_target,
                "slo_met": self.shadow_slo_met,
            }
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "DimensionScore":
        sm = d.get("shadow_metric", {})
        return cls(
            name=d["name"],
            score=d["score"],
            slo_target=d.get("slo_target"),
            slo_met=d.get("slo_met"),
            evidence=d.get("evidence", ""),
            shadow_metric_name=sm.get("name") if sm else None,
            shadow_metric_value=sm.get("value") if sm else None,
            shadow_slo_target=sm.get("slo_target") if sm else None,
            shadow_slo_met=sm.get("slo_met") if sm else None,
        )


# ---------------------------------------------------------------------------
# Verification result
# ---------------------------------------------------------------------------

@dataclass
class VerificationResult:
    verification_id: str = ""
    agreement_id: str = ""
    timestamp: str = ""
    evaluator_identity: Optional[Identity] = None
    evaluator_type: str = "agent_as_judge"
    dimensions: List[DimensionScore] = field(default_factory=list)
    composite_score: float = 0.0
    composite_method: str = "weighted_average"
    composite_threshold: float = 75.0
    passed: bool = False
    determination: str = "FAIL"
    payment_release_percent: float = 0.0
    confidence: float = 0.0
    notes: str = ""
    deliverable_hash: str = ""
    evaluation_hash: str = ""
    evaluation_duration_ms: int = 0
    result_hash: str = ""

    def __post_init__(self) -> None:
        if not self.verification_id:
            self.verification_id = f"ver-{_uuid()[:12]}"
        if not self.timestamp:
            self.timestamp = _now_iso()

    def compute_hash(self) -> str:
        d = {
            "verification_id": self.verification_id,
            "agreement_id": self.agreement_id,
            "dimensions": [ds.to_dict() for ds in self.dimensions],
            "composite_score": self.composite_score,
            "passed": self.passed,
            "timestamp": self.timestamp,
        }
        self.result_hash = _hash_dict(d)
        return self.result_hash

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "verification_id": self.verification_id,
            "agreement_id": self.agreement_id,
            "timestamp": self.timestamp,
            "evaluator": {
                "type": self.evaluator_type,
            },
            "dimensions": [ds.to_dict() for ds in self.dimensions],
            "composite": {
                "score": self.composite_score,
                "method": self.composite_method,
                "threshold": self.composite_threshold,
                "passed": self.passed,
            },
            "determination": {
                "result": self.determination,
                "payment_release_percent": self.payment_release_percent,
                "confidence": self.confidence,
                "notes": self.notes,
            },
            "evidence_trail": {
                "deliverable_hash": self.deliverable_hash,
                "evaluation_hash": self.evaluation_hash,
                "evaluation_duration_ms": self.evaluation_duration_ms,
            },
        }
        if self.evaluator_identity:
            d["evaluator"]["identity"] = self.evaluator_identity.to_dict()
        if self.result_hash:
            d["result_hash"] = self.result_hash
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "VerificationResult":
        ev = d.get("evaluator", {})
        comp = d.get("composite", {})
        det = d.get("determination", {})
        trail = d.get("evidence_trail", {})
        ev_id = ev.get("identity")
        return cls(
            verification_id=d.get("verification_id", ""),
            agreement_id=d.get("agreement_id", ""),
            timestamp=d.get("timestamp", ""),
            evaluator_identity=Identity.from_dict(ev_id) if ev_id else None,
            evaluator_type=ev.get("type", "agent_as_judge"),
            dimensions=[DimensionScore.from_dict(ds) for ds in d.get("dimensions", [])],
            composite_score=comp.get("score", 0.0),
            composite_method=comp.get("method", "weighted_average"),
            composite_threshold=comp.get("threshold", 75.0),
            passed=comp.get("passed", False),
            determination=det.get("result", "FAIL"),
            payment_release_percent=det.get("payment_release_percent", 0.0),
            confidence=det.get("confidence", 0.0),
            notes=det.get("notes", ""),
            deliverable_hash=trail.get("deliverable_hash", ""),
            evaluation_hash=trail.get("evaluation_hash", ""),
            evaluation_duration_ms=trail.get("evaluation_duration_ms", 0),
            result_hash=d.get("result_hash", ""),
        )


# ---------------------------------------------------------------------------
# Escrow state (runtime)
# ---------------------------------------------------------------------------

@dataclass
class EscrowState:
    agreement_id: str = ""
    status: str = "unfunded"  # unfunded, funded, releasing, released, refunded, held
    funded_amount: str = "0"
    currency: str = "USD"
    released_amount: str = "0"
    release_percent: float = 0.0
    funded_at: str = ""
    released_at: str = ""
    trigger: str = ""  # verification_pass, timeout, manual
    state_hash: str = ""

    def compute_hash(self) -> str:
        d = {
            "agreement_id": self.agreement_id,
            "status": self.status,
            "funded_amount": self.funded_amount,
            "released_amount": self.released_amount,
            "release_percent": self.release_percent,
        }
        self.state_hash = _hash_dict(d)
        return self.state_hash

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "agreement_id": self.agreement_id,
            "status": self.status,
            "funded_amount": self.funded_amount,
            "currency": self.currency,
            "released_amount": self.released_amount,
            "release_percent": self.release_percent,
        }
        if self.funded_at:
            d["funded_at"] = self.funded_at
        if self.released_at:
            d["released_at"] = self.released_at
        if self.trigger:
            d["trigger"] = self.trigger
        if self.state_hash:
            d["state_hash"] = self.state_hash
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "EscrowState":
        return cls(
            agreement_id=d.get("agreement_id", ""),
            status=d.get("status", "unfunded"),
            funded_amount=d.get("funded_amount", "0"),
            currency=d.get("currency", "USD"),
            released_amount=d.get("released_amount", "0"),
            release_percent=d.get("release_percent", 0.0),
            funded_at=d.get("funded_at", ""),
            released_at=d.get("released_at", ""),
            trigger=d.get("trigger", ""),
            state_hash=d.get("state_hash", ""),
        )
