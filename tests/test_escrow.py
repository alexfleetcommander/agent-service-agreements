"""Tests for escrow.py — graduated release and dead-man's switch."""

import pytest

from agent_service_agreements.schema import EscrowConfig, GraduatedTier
from agent_service_agreements.escrow import (
    EscrowBinding,
    compute_continuous_release,
    compute_release_percent,
    compute_tiered_release,
)


class TestTieredRelease:
    def test_score_90_plus(self):
        assert compute_tiered_release(95) == 100.0
        assert compute_tiered_release(90) == 100.0

    def test_score_75_89(self):
        assert compute_tiered_release(85) == 85.0
        assert compute_tiered_release(75) == 85.0

    def test_score_60_74(self):
        assert compute_tiered_release(70) == 50.0
        assert compute_tiered_release(60) == 50.0

    def test_score_below_60(self):
        assert compute_tiered_release(59) == 0.0
        assert compute_tiered_release(0) == 0.0

    def test_custom_tiers(self):
        tiers = [
            GraduatedTier(composite_score_gte=80, release_percent=100),
            GraduatedTier(composite_score_gte=50, release_percent=50),
            GraduatedTier(composite_score_lt=50, release_percent=0),
        ]
        assert compute_tiered_release(85, tiers) == 100.0
        assert compute_tiered_release(60, tiers) == 50.0
        assert compute_tiered_release(30, tiers) == 0.0


class TestContinuousRelease:
    def test_linear(self):
        assert compute_continuous_release(75) == 75.0
        assert compute_continuous_release(100) == 100.0
        assert compute_continuous_release(0) == 0.0

    def test_clamp(self):
        assert compute_continuous_release(-5) == 0.0
        assert compute_continuous_release(150) == 100.0


class TestComputeReleasePercent:
    def test_default_tiered(self):
        assert compute_release_percent(85) == 85.0

    def test_continuous_mode(self):
        cfg = EscrowConfig(graduated_release_mode="continuous")
        assert compute_release_percent(75, cfg) == 75.0


class TestEscrowBinding:
    def _config(self, **overrides):
        defaults = dict(
            enabled=True, amount="10.00", currency="USD",
            tiers=[
                GraduatedTier(composite_score_gte=90, release_percent=100),
                GraduatedTier(composite_score_gte=75, release_percent=85),
                GraduatedTier(composite_score_gte=60, release_percent=50),
                GraduatedTier(composite_score_lt=60, release_percent=0),
            ],
        )
        defaults.update(overrides)
        return EscrowConfig(**defaults)

    def test_fund(self):
        binding = EscrowBinding("asa-1", self._config())
        state = binding.fund()
        assert state.status == "funded"
        assert state.funded_amount == "10.00"

    def test_release_high_score(self):
        binding = EscrowBinding("asa-1", self._config())
        binding.fund()
        state = binding.release(92)
        assert state.status == "released"
        assert state.release_percent == 100.0
        assert state.released_amount == "10.00"

    def test_release_medium_score(self):
        binding = EscrowBinding("asa-1", self._config())
        binding.fund()
        state = binding.release(80)
        assert state.release_percent == 85.0
        assert state.released_amount == "8.50"

    def test_release_low_score(self):
        binding = EscrowBinding("asa-1", self._config())
        binding.fund()
        state = binding.release(65)
        assert state.release_percent == 50.0
        assert state.released_amount == "5.00"

    def test_refund(self):
        binding = EscrowBinding("asa-1", self._config())
        binding.fund()
        state = binding.refund()
        assert state.status == "refunded"

    def test_cannot_double_fund(self):
        binding = EscrowBinding("asa-1", self._config())
        binding.fund()
        with pytest.raises(ValueError, match="Cannot fund"):
            binding.fund()

    def test_cannot_release_unfunded(self):
        binding = EscrowBinding("asa-1", self._config())
        with pytest.raises(ValueError, match="Cannot release"):
            binding.release(90)

    def test_dead_mans_switch_provider_timeout(self):
        binding = EscrowBinding("asa-1", self._config())
        binding.fund()
        state = binding.handle_timeout("provider")
        assert state.status == "refunded"

    def test_dead_mans_switch_evaluator_default(self):
        binding = EscrowBinding("asa-1", self._config())
        binding.fund()
        state = binding.handle_timeout("evaluator")
        assert state.status == "held"  # hold_for_backup_evaluator

    def test_dead_mans_switch_evaluator_split(self):
        cfg = self._config(dead_mans_switch_action="split_50_50")
        binding = EscrowBinding("asa-1", cfg)
        binding.fund()
        state = binding.handle_timeout("evaluator")
        assert state.release_percent == 50.0

    def test_dead_mans_switch_not_release_to_provider_by_default(self):
        """Per Editor fix: default must NOT be release_to_provider."""
        cfg = self._config()
        assert cfg.dead_mans_switch_action == "hold_for_backup_evaluator"

    def test_callback_integration(self):
        funded = []
        released = []

        def on_fund(aid, amt, cur):
            funded.append((aid, amt, cur))
            return True

        def on_release(aid, amt, cur, pct):
            released.append((aid, amt, cur, pct))
            return True

        binding = EscrowBinding("asa-1", self._config(), on_fund=on_fund, on_release=on_release)
        binding.fund()
        binding.release(95)

        assert len(funded) == 1
        assert len(released) == 1
        assert released[0][3] == 100.0
