import {
  Identity,
  NegotiationMessage,
  nowIso,
  uuid,
} from "./schema";
import { Agreement } from "./agreement";

export interface NegotiationConfigDict {
  max_rounds: number;
  asymmetry_limit_pct: number;
  price_bound_low_multiplier: number;
  price_bound_high_multiplier: number;
  timeout_seconds: number;
}

export class NegotiationConfig {
  maxRounds: number;
  asymmetryLimitPct: number;
  priceBoundLowMultiplier: number;
  priceBoundHighMultiplier: number;
  timeoutSeconds: number;

  constructor(opts: {
    maxRounds?: number;
    asymmetryLimitPct?: number;
    priceBoundLowMultiplier?: number;
    priceBoundHighMultiplier?: number;
    timeoutSeconds?: number;
  } = {}) {
    this.maxRounds = opts.maxRounds ?? 5;
    this.asymmetryLimitPct = opts.asymmetryLimitPct ?? 25.0;
    this.priceBoundLowMultiplier = opts.priceBoundLowMultiplier ?? 0.5;
    this.priceBoundHighMultiplier = opts.priceBoundHighMultiplier ?? 3.0;
    this.timeoutSeconds = opts.timeoutSeconds ?? 3600;
  }

  toDict(): NegotiationConfigDict {
    return {
      max_rounds: this.maxRounds,
      asymmetry_limit_pct: this.asymmetryLimitPct,
      price_bound_low_multiplier: this.priceBoundLowMultiplier,
      price_bound_high_multiplier: this.priceBoundHighMultiplier,
      timeout_seconds: this.timeoutSeconds,
    };
  }

  static fromDict(d: Record<string, unknown>): NegotiationConfig {
    return new NegotiationConfig({
      maxRounds: (d.max_rounds as number) ?? 5,
      asymmetryLimitPct: (d.asymmetry_limit_pct as number) ?? 25.0,
      priceBoundLowMultiplier: (d.price_bound_low_multiplier as number) ?? 0.5,
      priceBoundHighMultiplier: (d.price_bound_high_multiplier as number) ?? 3.0,
      timeoutSeconds: (d.timeout_seconds as number) ?? 3600,
    });
  }
}

export class NegotiationSession {
  sessionId: string;
  agreement: Agreement | null;
  config: NegotiationConfig;
  messages: NegotiationMessage[];
  currentRound: number;
  status: string;
  startedAt: string;

  constructor(opts: {
    sessionId?: string;
    agreement?: Agreement | null;
    config?: NegotiationConfig;
    messages?: NegotiationMessage[];
    currentRound?: number;
    status?: string;
    startedAt?: string;
  } = {}) {
    this.sessionId = opts.sessionId || `neg-${uuid().slice(0, 12)}`;
    this.agreement = opts.agreement ?? null;
    this.config = opts.config || new NegotiationConfig();
    this.messages = opts.messages || [];
    this.currentRound = opts.currentRound ?? 0;
    this.status = opts.status || "open";
    this.startedAt = opts.startedAt || nowIso();
  }

  get isOpen(): boolean {
    return this.status === "open";
  }

  propose(sender: Identity, agreement: Agreement): NegotiationMessage {
    if (this.messages.length > 0) {
      throw new Error("Proposal already exists; use counter() for subsequent rounds");
    }
    this.agreement = agreement;
    this.agreement.status = "negotiating";

    const msg = new NegotiationMessage({
      negotiationId: this.sessionId,
      agreementId: agreement.agreementId,
      round: 0,
      action: "propose",
      sender,
    });
    msg.computeHash();
    this.messages.push(msg);
    return msg;
  }

  counter(
    sender: Identity,
    proposedChanges: Record<string, unknown>,
    rationaleCode = "",
  ): NegotiationMessage {
    if (!this.isOpen) {
      throw new Error(`Negotiation is ${this.status}, cannot counter`);
    }
    if (this.messages.length === 0) {
      throw new Error("No proposal yet; use propose() first");
    }

    this.currentRound += 1;

    if (this.currentRound > this.config.maxRounds) {
      this.status = "rejected";
      throw new Error(`Maximum rounds (${this.config.maxRounds}) exceeded`);
    }

    this._checkAsymmetry(proposedChanges);

    const msg = new NegotiationMessage({
      negotiationId: this.sessionId,
      agreementId: this.agreement?.agreementId || "",
      round: this.currentRound,
      action: "counter",
      sender,
      proposedChanges: proposedChanges,
      rationaleCode,
    });
    msg.computeHash();
    this.messages.push(msg);

    if (this.agreement) {
      this._applyChanges(proposedChanges);
    }

    return msg;
  }

  accept(sender: Identity): NegotiationMessage {
    if (!this.isOpen) {
      throw new Error(`Negotiation is ${this.status}, cannot accept`);
    }
    if (this.messages.length === 0) {
      throw new Error("No proposal to accept");
    }

    this.currentRound += 1;
    const msg = new NegotiationMessage({
      negotiationId: this.sessionId,
      agreementId: this.agreement?.agreementId || "",
      round: this.currentRound,
      action: "accept",
      sender,
    });
    msg.computeHash();
    this.messages.push(msg);
    this.status = "accepted";

    if (this.agreement) {
      this.agreement.status = "proposed";
    }

    return msg;
  }

  reject(sender: Identity, rationaleCode = ""): NegotiationMessage {
    if (!this.isOpen) {
      throw new Error(`Negotiation is ${this.status}, cannot reject`);
    }

    this.currentRound += 1;
    const msg = new NegotiationMessage({
      negotiationId: this.sessionId,
      agreementId: this.agreement?.agreementId || "",
      round: this.currentRound,
      action: "reject",
      sender,
      rationaleCode,
    });
    msg.computeHash();
    this.messages.push(msg);
    this.status = "rejected";

    if (this.agreement) {
      this.agreement.status = "rejected";
    }

    return msg;
  }

  private _checkAsymmetry(proposedChanges: Record<string, unknown>): string[] {
    const violations: string[] = [];
    const limit = this.config.asymmetryLimitPct / 100.0;

    for (const [path, newValue] of Object.entries(proposedChanges)) {
      const oldValue = this._getCurrentValue(path);
      if (oldValue === null || typeof oldValue !== "number") continue;
      if (typeof newValue !== "number") continue;
      if (oldValue === 0) continue;

      const changePct = Math.abs(newValue - oldValue) / Math.abs(oldValue);
      if (changePct > limit) violations.push(path);
    }
    return violations;
  }

  private _getCurrentValue(path: string): unknown {
    if (!this.agreement) return null;
    const d = this.agreement.toDict() as unknown as Record<string, unknown>;
    const parts = path.split(".");
    let current: unknown = d;
    for (const part of parts) {
      if (current && typeof current === "object" && !Array.isArray(current)) {
        current = (current as Record<string, unknown>)[part];
      } else if (Array.isArray(current)) {
        const idx = parseInt(part, 10);
        if (isNaN(idx) || idx < 0 || idx >= current.length) return null;
        current = current[idx];
      } else {
        return null;
      }
    }
    return current;
  }

  private _applyChanges(changes: Record<string, unknown>): void {
    if (!this.agreement) return;

    for (const [path, value] of Object.entries(changes)) {
      if (path.startsWith("quality_criteria.dimensions[")) {
        this._applyDimensionChange(path, value);
      } else if (path === "quality_criteria.composite_threshold") {
        if (this.agreement.qualityCriteria) {
          this.agreement.qualityCriteria.compositeThreshold = Number(value);
        }
      } else if (path === "escrow.payment.amount") {
        if (this.agreement.escrow) {
          this.agreement.escrow.amount = String(value);
        }
      } else if (path === "service.constraints.max_duration_seconds") {
        if (this.agreement.service) {
          this.agreement.service.maxDurationSeconds = Number(value);
        }
      } else if (path === "service.constraints.max_cost_usd") {
        if (this.agreement.service) {
          this.agreement.service.maxCostUsd = Number(value);
        }
      }
    }
  }

  private _applyDimensionChange(path: string, value: unknown): void {
    if (!this.agreement?.qualityCriteria) return;

    const m = path.match(/dimensions\[(\d+)]\.(.+)/);
    if (!m) return;

    const idx = parseInt(m[1], 10);
    const subpath = m[2];
    const dims = this.agreement.qualityCriteria.dimensions;
    if (idx >= dims.length) return;

    const dim = dims[idx];
    if (subpath === "slo.value" && dim.slo) {
      dim.slo.value = value;
    } else if (subpath === "weight") {
      dim.weight = Number(value);
    }
  }

  toDict(): Record<string, unknown> {
    return {
      session_id: this.sessionId,
      agreement_id: this.agreement?.agreementId || "",
      config: this.config.toDict(),
      current_round: this.currentRound,
      status: this.status,
      started_at: this.startedAt,
      messages: this.messages.map((m) => m.toDict()),
    };
  }

  static fromDict(d: Record<string, unknown>): NegotiationSession {
    return new NegotiationSession({
      sessionId: (d.session_id as string) || "",
      config: NegotiationConfig.fromDict((d.config || {}) as Record<string, unknown>),
      currentRound: (d.current_round as number) ?? 0,
      status: (d.status as string) || "open",
      startedAt: (d.started_at as string) || "",
      messages: ((d.messages || []) as Record<string, unknown>[]).map(
        (m) => NegotiationMessage.fromDict(m as any),
      ),
    });
  }
}
