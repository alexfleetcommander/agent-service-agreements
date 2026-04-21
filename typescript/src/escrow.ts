import {
  DEFAULT_GRADUATED_TIERS,
  EscrowConfig,
  EscrowState,
  GraduatedTier,
  nowIso,
} from "./schema";

export type FundCallback = (agreementId: string, amount: string, currency: string) => boolean;
export type ReleaseCallback = (agreementId: string, amount: string, currency: string, percent: number) => boolean;
export type RefundCallback = (agreementId: string, amount: string, currency: string) => boolean;

export function computeTieredRelease(
  compositeScore: number,
  tiers?: GraduatedTier[] | null,
): number {
  const useTiers = tiers && tiers.length > 0
    ? tiers
    : DEFAULT_GRADUATED_TIERS.map((t) => GraduatedTier.fromDict(t as any));

  for (const tier of useTiers) {
    if (tier.compositeScoreGte !== null) {
      if (compositeScore >= tier.compositeScoreGte) return tier.releasePercent;
    } else if (tier.compositeScoreLt !== null) {
      if (compositeScore < tier.compositeScoreLt) return tier.releasePercent;
    }
  }
  return 0.0;
}

export function computeContinuousRelease(compositeScore: number): number {
  return Math.max(0.0, Math.min(100.0, compositeScore));
}

export function computeReleasePercent(
  compositeScore: number,
  config?: EscrowConfig | null,
): number {
  if (!config) return computeTieredRelease(compositeScore);
  if (config.graduatedReleaseMode === "continuous") return computeContinuousRelease(compositeScore);
  return computeTieredRelease(compositeScore, config.tiers.length > 0 ? config.tiers : null);
}

export class EscrowBinding {
  config: EscrowConfig;
  state: EscrowState;
  private _onFund: FundCallback | null;
  private _onRelease: ReleaseCallback | null;
  private _onRefund: RefundCallback | null;

  constructor(
    agreementId: string,
    config: EscrowConfig,
    onFund: FundCallback | null = null,
    onRelease: ReleaseCallback | null = null,
    onRefund: RefundCallback | null = null,
  ) {
    this.config = config;
    this.state = new EscrowState({
      agreementId,
      currency: config.currency,
    });
    this._onFund = onFund;
    this._onRelease = onRelease;
    this._onRefund = onRefund;
  }

  fund(amount?: string): EscrowState {
    if (this.state.status !== "unfunded") {
      throw new Error(`Cannot fund escrow in status '${this.state.status}'`);
    }
    const fundAmount = amount || this.config.amount || "0";

    if (this._onFund) {
      const success = this._onFund(this.state.agreementId, fundAmount, this.config.currency);
      if (!success) throw new Error("External escrow funding failed");
    }

    this.state.fundedAmount = fundAmount;
    this.state.status = "funded";
    this.state.fundedAt = nowIso();
    this.state.computeHash();
    return this.state;
  }

  release(compositeScore: number): EscrowState {
    if (this.state.status !== "funded") {
      throw new Error(`Cannot release from status '${this.state.status}'`);
    }

    const releasePct = computeReleasePercent(compositeScore, this.config);
    const funded = parseFloat(this.state.fundedAmount);
    const releaseAmount = funded * (releasePct / 100.0);

    if (this._onRelease) {
      const success = this._onRelease(
        this.state.agreementId,
        releaseAmount.toFixed(2),
        this.config.currency,
        releasePct,
      );
      if (!success) throw new Error("External escrow release failed");
    }

    this.state.releasedAmount = releaseAmount.toFixed(2);
    this.state.releasePercent = releasePct;
    this.state.status = "released";
    this.state.releasedAt = nowIso();
    this.state.trigger = "verification_pass";
    this.state.computeHash();
    return this.state;
  }

  refund(): EscrowState {
    if (this.state.status !== "funded") {
      throw new Error(`Cannot refund from status '${this.state.status}'`);
    }

    if (this._onRefund) {
      const success = this._onRefund(
        this.state.agreementId,
        this.state.fundedAmount,
        this.config.currency,
      );
      if (!success) throw new Error("External escrow refund failed");
    }

    this.state.releasedAmount = "0.00";
    this.state.releasePercent = 0.0;
    this.state.status = "refunded";
    this.state.releasedAt = nowIso();
    this.state.trigger = "refund";
    this.state.computeHash();
    return this.state;
  }

  handleTimeout(whoTimedOut: string): EscrowState {
    if (whoTimedOut === "provider") return this.refund();

    if (whoTimedOut === "client") {
      this.state.status = "refunded";
      this.state.trigger = "client_timeout";
      this.state.computeHash();
      return this.state;
    }

    const action = this.config.deadMansSwitchAction;

    if (action === "hold_for_backup_evaluator") {
      this.state.status = "held";
      this.state.trigger = "evaluator_timeout_held";
    } else if (action === "split_50_50") {
      const funded = parseFloat(this.state.fundedAmount);
      const half = funded * 0.5;
      this.state.releasedAmount = half.toFixed(2);
      this.state.releasePercent = 50.0;
      this.state.status = "released";
      this.state.trigger = "evaluator_timeout_split";
    } else if (action === "return_to_client") {
      return this.refund();
    } else if (action === "release_to_provider") {
      const funded = parseFloat(this.state.fundedAmount);
      this.state.releasedAmount = funded.toFixed(2);
      this.state.releasePercent = 100.0;
      this.state.status = "released";
      this.state.trigger = "evaluator_timeout_release";
    } else {
      this.state.status = "held";
      this.state.trigger = "evaluator_timeout_held";
    }

    this.state.releasedAt = nowIso();
    this.state.computeHash();
    return this.state;
  }

  getState(): EscrowState {
    return this.state;
  }

  toDict(): Record<string, unknown> {
    return {
      config: this.config.toDict(),
      state: this.state.toDict(),
    };
  }
}
