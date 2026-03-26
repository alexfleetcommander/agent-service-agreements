"""Agreement class for Agent Service Agreements.

Machine-readable service contracts with quality criteria, SLO definitions,
payment terms, JSON serialization, and SHA-256 agreement hashing.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .schema import (
    ASA_VERSION,
    AGREEMENT_STATUSES,
    EscrowConfig,
    Identity,
    QualityCriteria,
    ServiceSpec,
    VerificationConfig,
    _hash_dict,
    _now_iso,
    _uuid,
)


@dataclass
class Agreement:
    """A machine-readable service agreement between a client and provider.

    Lifecycle: PROPOSED -> NEGOTIATING -> ACTIVE -> DELIVERED -> VERIFIED -> CLOSED
    """

    # Core identifiers
    agreement_id: str = ""
    asa_version: str = ASA_VERSION
    created_at: str = ""
    expires_at: str = ""
    status: str = "proposed"

    # Parties
    client: Optional[Identity] = None
    provider: Optional[Identity] = None
    evaluator: Optional[Identity] = None
    evaluator_type: str = "agent_as_judge"

    # Service definition
    service: Optional[ServiceSpec] = None

    # Quality criteria
    quality_criteria: Optional[QualityCriteria] = None

    # Verification configuration
    verification: Optional[VerificationConfig] = None

    # Escrow configuration
    escrow: Optional[EscrowConfig] = None

    # Dispute configuration
    dispute_protocol: str = "ajp"
    dispute_auto_file_threshold: float = 60.0

    # Signatures
    client_signature: str = ""
    provider_signature: str = ""

    # Deliverable (set when delivered)
    deliverable_hash: str = ""
    delivered_at: str = ""

    # Hash
    agreement_hash: str = ""

    def __post_init__(self) -> None:
        if not self.agreement_id:
            self.agreement_id = f"asa-{_uuid()[:12]}"
        if not self.created_at:
            self.created_at = _now_iso()

    def compute_hash(self) -> str:
        """Compute SHA-256 hash of the agreement's canonical form."""
        d = self._canonical_dict()
        self.agreement_hash = _hash_dict(d)
        return self.agreement_hash

    def _canonical_dict(self) -> Dict[str, Any]:
        """Fields included in the agreement hash (excludes mutable state)."""
        d: Dict[str, Any] = {
            "agreement_id": self.agreement_id,
            "asa_version": self.asa_version,
            "created_at": self.created_at,
        }
        if self.client:
            d["client"] = self.client.to_dict()
        if self.provider:
            d["provider"] = self.provider.to_dict()
        if self.service:
            d["service"] = self.service.to_dict()
        if self.quality_criteria:
            d["quality_criteria"] = self.quality_criteria.to_dict()
        if self.escrow:
            d["escrow"] = self.escrow.to_dict()
        return d

    def validate(self) -> List[str]:
        """Validate the agreement. Returns list of error messages (empty = valid)."""
        errors: List[str] = []
        if not self.client:
            errors.append("Agreement must have a client identity")
        if not self.provider:
            errors.append("Agreement must have a provider identity")
        if not self.service:
            errors.append("Agreement must specify a service")
        if not self.quality_criteria:
            errors.append("Agreement must have quality criteria")
        elif self.quality_criteria:
            if not self.quality_criteria.dimensions:
                errors.append("Quality criteria must include at least one dimension")
            else:
                total_weight = sum(d.weight for d in self.quality_criteria.dimensions)
                if abs(total_weight - 1.0) > 0.05:
                    errors.append(
                        f"Dimension weights should sum to ~1.0, got {total_weight:.2f}"
                    )
        if self.status not in AGREEMENT_STATUSES:
            errors.append(f"Invalid status: {self.status}")
        return errors

    def is_valid(self) -> bool:
        return len(self.validate()) == 0

    # -- Lifecycle transitions --

    def sign(self, party: str, signature: str) -> None:
        """Sign the agreement. Both parties must sign to activate."""
        if party == "client":
            self.client_signature = signature
        elif party == "provider":
            self.provider_signature = signature
        if self.client_signature and self.provider_signature:
            self.status = "active"
            self.compute_hash()

    def deliver(self, deliverable_hash: str) -> None:
        """Mark agreement as delivered with content hash."""
        if self.status != "active":
            raise ValueError(f"Cannot deliver in status '{self.status}', must be 'active'")
        self.deliverable_hash = deliverable_hash
        self.delivered_at = _now_iso()
        self.status = "delivered"

    def mark_verified(self, passed: bool) -> None:
        """Transition to verified state."""
        if self.status != "delivered":
            raise ValueError(f"Cannot verify in status '{self.status}', must be 'delivered'")
        self.status = "verified"

    def close(self) -> None:
        """Close the agreement."""
        if self.status not in ("verified", "disputed"):
            raise ValueError(f"Cannot close in status '{self.status}'")
        self.status = "closed"

    def dispute(self) -> None:
        """Transition to disputed state."""
        if self.status not in ("verified", "delivered"):
            raise ValueError(f"Cannot dispute in status '{self.status}'")
        self.status = "disputed"

    def expire(self) -> None:
        """Expire the agreement (timeout)."""
        self.status = "expired"

    def reject(self) -> None:
        """Reject during negotiation."""
        if self.status not in ("proposed", "negotiating"):
            raise ValueError(f"Cannot reject in status '{self.status}'")
        self.status = "rejected"

    # -- Serialization --

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "asa_version": self.asa_version,
            "agreement_id": self.agreement_id,
            "created_at": self.created_at,
            "status": self.status,
        }
        if self.expires_at:
            d["expires_at"] = self.expires_at

        parties: Dict[str, Any] = {}
        if self.client:
            parties["client"] = self.client.to_dict()
        if self.provider:
            parties["provider"] = self.provider.to_dict()
        if self.evaluator:
            parties["evaluator"] = self.evaluator.to_dict()
            parties["evaluator"]["type"] = self.evaluator_type
        if parties:
            d["parties"] = parties

        if self.service:
            d["service"] = self.service.to_dict()
        if self.quality_criteria:
            d["quality_criteria"] = self.quality_criteria.to_dict()
        if self.verification:
            d["verification"] = self.verification.to_dict()
        if self.escrow:
            d["escrow"] = self.escrow.to_dict()

        d["dispute"] = {
            "protocol": self.dispute_protocol,
            "auto_file_threshold": self.dispute_auto_file_threshold,
        }

        sigs: Dict[str, str] = {}
        if self.client_signature:
            sigs["client"] = self.client_signature
        if self.provider_signature:
            sigs["provider"] = self.provider_signature
        if sigs:
            d["signatures"] = sigs

        if self.deliverable_hash:
            d["deliverable_hash"] = self.deliverable_hash
        if self.delivered_at:
            d["delivered_at"] = self.delivered_at
        if self.agreement_hash:
            d["agreement_hash"] = self.agreement_hash

        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Agreement":
        parties = d.get("parties", {})
        client_d = parties.get("client")
        provider_d = parties.get("provider")
        evaluator_d = parties.get("evaluator")
        sigs = d.get("signatures", {})
        dispute = d.get("dispute", {})

        evaluator_type = "agent_as_judge"
        if evaluator_d and "type" in evaluator_d:
            evaluator_type = evaluator_d.pop("type", "agent_as_judge")

        return cls(
            agreement_id=d.get("agreement_id", ""),
            asa_version=d.get("asa_version", ASA_VERSION),
            created_at=d.get("created_at", ""),
            expires_at=d.get("expires_at", ""),
            status=d.get("status", "proposed"),
            client=Identity.from_dict(client_d) if client_d else None,
            provider=Identity.from_dict(provider_d) if provider_d else None,
            evaluator=Identity.from_dict(evaluator_d) if evaluator_d else None,
            evaluator_type=evaluator_type,
            service=ServiceSpec.from_dict(d["service"]) if d.get("service") else None,
            quality_criteria=QualityCriteria.from_dict(d["quality_criteria"]) if d.get("quality_criteria") else None,
            verification=VerificationConfig.from_dict(d["verification"]) if d.get("verification") else None,
            escrow=EscrowConfig.from_dict(d["escrow"]) if d.get("escrow") else None,
            dispute_protocol=dispute.get("protocol", "ajp"),
            dispute_auto_file_threshold=dispute.get("auto_file_threshold", 60.0),
            client_signature=sigs.get("client", ""),
            provider_signature=sigs.get("provider", ""),
            deliverable_hash=d.get("deliverable_hash", ""),
            delivered_at=d.get("delivered_at", ""),
            agreement_hash=d.get("agreement_hash", ""),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        import json
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    @classmethod
    def from_json(cls, s: str) -> "Agreement":
        """Deserialize from JSON string."""
        import json
        return cls.from_dict(json.loads(s))
