"""Multi-round negotiation protocol for Agent Service Agreements.

Supports propose, counter, accept, reject flows with configurable
round limits and fairness constraints.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .schema import (
    Identity,
    NegotiationMessage,
    NEGOTIATION_ACTIONS,
    _now_iso,
    _uuid,
)
from .agreement import Agreement


@dataclass
class NegotiationConfig:
    """Configuration for a negotiation session."""
    max_rounds: int = 5
    asymmetry_limit_pct: float = 25.0
    price_bound_low_multiplier: float = 0.5
    price_bound_high_multiplier: float = 3.0
    timeout_seconds: int = 3600

    def to_dict(self) -> Dict[str, Any]:
        return {
            "max_rounds": self.max_rounds,
            "asymmetry_limit_pct": self.asymmetry_limit_pct,
            "price_bound_low_multiplier": self.price_bound_low_multiplier,
            "price_bound_high_multiplier": self.price_bound_high_multiplier,
            "timeout_seconds": self.timeout_seconds,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "NegotiationConfig":
        return cls(
            max_rounds=d.get("max_rounds", 5),
            asymmetry_limit_pct=d.get("asymmetry_limit_pct", 25.0),
            price_bound_low_multiplier=d.get("price_bound_low_multiplier", 0.5),
            price_bound_high_multiplier=d.get("price_bound_high_multiplier", 3.0),
            timeout_seconds=d.get("timeout_seconds", 3600),
        )


@dataclass
class NegotiationSession:
    """A bounded negotiation between client and provider.

    Flow: PROPOSE -> (COUNTER)* -> ACCEPT | REJECT

    Each round, one party proposes changes to the agreement terms.
    Fairness constraints prevent exploitative swings.
    """

    session_id: str = ""
    agreement: Optional[Agreement] = None
    config: NegotiationConfig = field(default_factory=NegotiationConfig)
    messages: List[NegotiationMessage] = field(default_factory=list)
    current_round: int = 0
    status: str = "open"  # open, accepted, rejected, expired
    started_at: str = ""

    def __post_init__(self) -> None:
        if not self.session_id:
            self.session_id = f"neg-{_uuid()[:12]}"
        if not self.started_at:
            self.started_at = _now_iso()

    @property
    def is_open(self) -> bool:
        return self.status == "open"

    def propose(
        self,
        sender: Identity,
        agreement: Agreement,
    ) -> NegotiationMessage:
        """Initial proposal to start negotiation.

        Args:
            sender: The proposing party (typically the client)
            agreement: The proposed agreement terms
        """
        if self.messages:
            raise ValueError("Proposal already exists; use counter() for subsequent rounds")

        self.agreement = agreement
        self.agreement.status = "negotiating"

        msg = NegotiationMessage(
            negotiation_id=self.session_id,
            agreement_id=agreement.agreement_id,
            round=0,
            action="propose",
            sender=sender,
        )
        msg.compute_hash()
        self.messages.append(msg)
        return msg

    def counter(
        self,
        sender: Identity,
        proposed_changes: Dict[str, Any],
        rationale_code: str = "",
    ) -> NegotiationMessage:
        """Submit a counter-proposal.

        Args:
            sender: The counter-proposing party
            proposed_changes: Dict of field paths to new values
            rationale_code: Machine-readable rationale
        """
        if not self.is_open:
            raise ValueError(f"Negotiation is {self.status}, cannot counter")
        if not self.messages:
            raise ValueError("No proposal yet; use propose() first")

        self.current_round += 1

        if self.current_round > self.config.max_rounds:
            self.status = "rejected"
            raise ValueError(
                f"Maximum rounds ({self.config.max_rounds}) exceeded"
            )

        # Validate asymmetry constraints
        violations = self._check_asymmetry(proposed_changes)

        msg = NegotiationMessage(
            negotiation_id=self.session_id,
            agreement_id=self.agreement.agreement_id if self.agreement else "",
            round=self.current_round,
            action="counter",
            sender=sender,
            proposed_changes=proposed_changes,
            rationale_code=rationale_code,
        )
        msg.compute_hash()
        self.messages.append(msg)

        # Apply changes to the agreement
        if self.agreement:
            self._apply_changes(proposed_changes)

        return msg

    def accept(self, sender: Identity) -> NegotiationMessage:
        """Accept the current terms."""
        if not self.is_open:
            raise ValueError(f"Negotiation is {self.status}, cannot accept")
        if not self.messages:
            raise ValueError("No proposal to accept")

        self.current_round += 1
        msg = NegotiationMessage(
            negotiation_id=self.session_id,
            agreement_id=self.agreement.agreement_id if self.agreement else "",
            round=self.current_round,
            action="accept",
            sender=sender,
        )
        msg.compute_hash()
        self.messages.append(msg)
        self.status = "accepted"

        if self.agreement:
            self.agreement.status = "proposed"  # Ready for signing

        return msg

    def reject(self, sender: Identity, rationale_code: str = "") -> NegotiationMessage:
        """Reject the negotiation."""
        if not self.is_open:
            raise ValueError(f"Negotiation is {self.status}, cannot reject")

        self.current_round += 1
        msg = NegotiationMessage(
            negotiation_id=self.session_id,
            agreement_id=self.agreement.agreement_id if self.agreement else "",
            round=self.current_round,
            action="reject",
            sender=sender,
            rationale_code=rationale_code,
        )
        msg.compute_hash()
        self.messages.append(msg)
        self.status = "rejected"

        if self.agreement:
            self.agreement.status = "rejected"

        return msg

    def _check_asymmetry(self, proposed_changes: Dict[str, Any]) -> List[str]:
        """Check if proposed changes violate asymmetry limits.

        Returns list of violated field paths.
        """
        violations: List[str] = []
        limit = self.config.asymmetry_limit_pct / 100.0

        for path, new_value in proposed_changes.items():
            old_value = self._get_current_value(path)
            if old_value is None or not isinstance(old_value, (int, float)):
                continue
            if not isinstance(new_value, (int, float)):
                continue
            if old_value == 0:
                continue

            change_pct = abs(new_value - old_value) / abs(old_value)
            if change_pct > limit:
                violations.append(path)

        return violations

    def _get_current_value(self, path: str) -> Any:
        """Get a value from the current agreement by dotted path."""
        if not self.agreement:
            return None
        d = self.agreement.to_dict()
        parts = path.split(".")
        current: Any = d
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list):
                try:
                    idx = int(part)
                    current = current[idx]
                except (ValueError, IndexError):
                    return None
            else:
                return None
        return current

    def _apply_changes(self, changes: Dict[str, Any]) -> None:
        """Apply proposed changes to the agreement.

        Handles common negotiation fields: SLO values, payment amount,
        duration, and composite threshold.
        """
        if not self.agreement:
            return

        for path, value in changes.items():
            # Handle common paths
            if path.startswith("quality_criteria.dimensions["):
                self._apply_dimension_change(path, value)
            elif path == "quality_criteria.composite_threshold":
                if self.agreement.quality_criteria:
                    self.agreement.quality_criteria.composite_threshold = float(value)
            elif path == "escrow.payment.amount":
                if self.agreement.escrow:
                    self.agreement.escrow.amount = str(value)
            elif path == "service.constraints.max_duration_seconds":
                if self.agreement.service:
                    self.agreement.service.max_duration_seconds = int(value)
            elif path == "service.constraints.max_cost_usd":
                if self.agreement.service:
                    self.agreement.service.max_cost_usd = float(value)

    def _apply_dimension_change(self, path: str, value: Any) -> None:
        """Apply a change to a quality dimension's SLO."""
        if not self.agreement or not self.agreement.quality_criteria:
            return

        # Parse "quality_criteria.dimensions[0].slo.value"
        import re
        m = re.search(r"dimensions\[(\d+)\]\.(.+)", path)
        if not m:
            return

        idx = int(m.group(1))
        subpath = m.group(2)
        dims = self.agreement.quality_criteria.dimensions

        if idx >= len(dims):
            return

        dim = dims[idx]
        if subpath == "slo.value" and dim.slo:
            dim.slo.value = value
        elif subpath == "weight":
            dim.weight = float(value)

    # -- Serialization --

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "agreement_id": self.agreement.agreement_id if self.agreement else "",
            "config": self.config.to_dict(),
            "current_round": self.current_round,
            "status": self.status,
            "started_at": self.started_at,
            "messages": [m.to_dict() for m in self.messages],
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "NegotiationSession":
        return cls(
            session_id=d.get("session_id", ""),
            config=NegotiationConfig.from_dict(d.get("config", {})),
            current_round=d.get("current_round", 0),
            status=d.get("status", "open"),
            started_at=d.get("started_at", ""),
            messages=[NegotiationMessage.from_dict(m) for m in d.get("messages", [])],
        )
