"""Escrow binding abstraction for Agent Service Agreements.

Graduated payment release based on composite quality scores:
- >= 90: 100% release
- 75-89: 85% release
- 60-74: 50% release
- < 60: 0% release (dispute option)

Dead-man's switch defaults to hold_for_backup (NOT release_to_provider).
Supports tiered and continuous release modes.
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from .schema import (
    DEFAULT_GRADUATED_TIERS,
    EscrowConfig,
    EscrowState,
    GraduatedTier,
    TIMEOUT_ACTIONS,
    _now_iso,
)


def compute_tiered_release(
    composite_score: float,
    tiers: Optional[List[GraduatedTier]] = None,
) -> float:
    """Compute release percentage from tiered graduation.

    Default tiers: >=90 -> 100%, >=75 -> 85%, >=60 -> 50%, <60 -> 0%
    """
    if tiers is None:
        tiers = [GraduatedTier.from_dict(t) for t in DEFAULT_GRADUATED_TIERS]

    for tier in tiers:
        if tier.composite_score_gte is not None:
            if composite_score >= tier.composite_score_gte:
                return tier.release_percent
        elif tier.composite_score_lt is not None:
            if composite_score < tier.composite_score_lt:
                return tier.release_percent

    return 0.0


def compute_continuous_release(composite_score: float) -> float:
    """Continuous release: payment = (score / 100) * 100%.

    No cliffs, no optimization targets.
    """
    return max(0.0, min(100.0, composite_score))


def compute_release_percent(
    composite_score: float,
    config: Optional[EscrowConfig] = None,
) -> float:
    """Compute release percentage based on config mode.

    Args:
        composite_score: The composite quality score (0-100)
        config: Escrow configuration. If None, uses default tiers.

    Returns:
        Release percentage (0-100)
    """
    if config is None:
        return compute_tiered_release(composite_score)

    if config.graduated_release_mode == "continuous":
        return compute_continuous_release(composite_score)

    return compute_tiered_release(composite_score, config.tiers or None)


class EscrowBinding:
    """Abstract escrow binding that manages fund lifecycle.

    This is an abstraction layer — actual fund management is delegated
    to external payment systems (ERC-8183, x402, HTTP callbacks, etc.).
    The binding tracks state and computes release amounts.
    """

    def __init__(
        self,
        agreement_id: str,
        config: EscrowConfig,
        on_fund: Optional[Callable[[str, str, str], bool]] = None,
        on_release: Optional[Callable[[str, str, str, float], bool]] = None,
        on_refund: Optional[Callable[[str, str, str], bool]] = None,
    ) -> None:
        """Initialize escrow binding.

        Args:
            agreement_id: The agreement this escrow is bound to
            config: Escrow configuration from the agreement
            on_fund: Callback(agreement_id, amount, currency) -> success
            on_release: Callback(agreement_id, amount, currency, percent) -> success
            on_refund: Callback(agreement_id, amount, currency) -> success
        """
        self.config = config
        self.state = EscrowState(
            agreement_id=agreement_id,
            currency=config.currency,
        )
        self._on_fund = on_fund
        self._on_release = on_release
        self._on_refund = on_refund

    def fund(self, amount: Optional[str] = None) -> EscrowState:
        """Fund the escrow. Uses config amount if not specified."""
        if self.state.status != "unfunded":
            raise ValueError(f"Cannot fund escrow in status '{self.state.status}'")

        fund_amount = amount or self.config.amount or "0"

        if self._on_fund:
            success = self._on_fund(
                self.state.agreement_id, fund_amount, self.config.currency
            )
            if not success:
                raise RuntimeError("External escrow funding failed")

        self.state.funded_amount = fund_amount
        self.state.status = "funded"
        self.state.funded_at = _now_iso()
        self.state.compute_hash()
        return self.state

    def release(self, composite_score: float) -> EscrowState:
        """Release funds based on composite quality score.

        Args:
            composite_score: Quality score (0-100)

        Returns:
            Updated escrow state with release details
        """
        if self.state.status != "funded":
            raise ValueError(f"Cannot release from status '{self.state.status}'")

        release_pct = compute_release_percent(composite_score, self.config)
        funded = float(self.state.funded_amount)
        release_amount = funded * (release_pct / 100.0)

        if self._on_release:
            success = self._on_release(
                self.state.agreement_id,
                f"{release_amount:.2f}",
                self.config.currency,
                release_pct,
            )
            if not success:
                raise RuntimeError("External escrow release failed")

        self.state.released_amount = f"{release_amount:.2f}"
        self.state.release_percent = release_pct
        self.state.status = "released"
        self.state.released_at = _now_iso()
        self.state.trigger = "verification_pass"
        self.state.compute_hash()
        return self.state

    def refund(self) -> EscrowState:
        """Refund entire amount to client."""
        if self.state.status != "funded":
            raise ValueError(f"Cannot refund from status '{self.state.status}'")

        if self._on_refund:
            success = self._on_refund(
                self.state.agreement_id,
                self.state.funded_amount,
                self.config.currency,
            )
            if not success:
                raise RuntimeError("External escrow refund failed")

        self.state.released_amount = "0.00"
        self.state.release_percent = 0.0
        self.state.status = "refunded"
        self.state.released_at = _now_iso()
        self.state.trigger = "refund"
        self.state.compute_hash()
        return self.state

    def handle_timeout(self, who_timed_out: str) -> EscrowState:
        """Handle dead-man's switch timeout.

        Default action: hold_for_backup_evaluator (NOT release_to_provider).

        Args:
            who_timed_out: "client", "provider", or "evaluator"
        """
        action = self.config.dead_mans_switch_action

        if who_timed_out == "provider":
            # Provider didn't deliver — refund client
            return self.refund()

        if who_timed_out == "client":
            # Client didn't fund — just expire
            self.state.status = "refunded"
            self.state.trigger = "client_timeout"
            self.state.compute_hash()
            return self.state

        # Evaluator timeout — use configured action
        if action == "hold_for_backup_evaluator":
            self.state.status = "held"
            self.state.trigger = "evaluator_timeout_held"
        elif action == "split_50_50":
            funded = float(self.state.funded_amount)
            half = funded * 0.5
            self.state.released_amount = f"{half:.2f}"
            self.state.release_percent = 50.0
            self.state.status = "released"
            self.state.trigger = "evaluator_timeout_split"
        elif action == "return_to_client":
            return self.refund()
        elif action == "release_to_provider":
            funded = float(self.state.funded_amount)
            self.state.released_amount = f"{funded:.2f}"
            self.state.release_percent = 100.0
            self.state.status = "released"
            self.state.trigger = "evaluator_timeout_release"
        else:
            # Default: hold for backup
            self.state.status = "held"
            self.state.trigger = "evaluator_timeout_held"

        self.state.released_at = _now_iso()
        self.state.compute_hash()
        return self.state

    def get_state(self) -> EscrowState:
        return self.state

    def to_dict(self) -> Dict[str, Any]:
        return {
            "config": self.config.to_dict(),
            "state": self.state.to_dict(),
        }
