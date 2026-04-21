import { createHash, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ASA_VERSION = "1.0.0";

export const IDENTITY_SCHEMES = [
  "coc", "erc8004", "a2a", "w3c_vc", "w3c_did", "mcp", "api_key", "uri",
] as const;
export type IdentityScheme = (typeof IDENTITY_SCHEMES)[number];

export const AGREEMENT_STATUSES = [
  "proposed", "negotiating", "active", "delivered",
  "verified", "closed", "disputed", "expired", "rejected",
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const NEGOTIATION_ACTIONS = ["propose", "counter", "accept", "reject"] as const;
export type NegotiationAction = (typeof NEGOTIATION_ACTIONS)[number];

export const VERIFICATION_DEPTHS = ["structural", "semantic", "composite"] as const;
export type VerificationDepth = (typeof VERIFICATION_DEPTHS)[number];

export const EVALUATOR_TYPES = ["agent_as_judge", "deterministic", "hybrid"] as const;
export type EvaluatorType = (typeof EVALUATOR_TYPES)[number];

export const EVALUATOR_SELECTION_MODES = [
  "random_from_pool", "mutual_agreement", "marketplace",
] as const;
export type EvaluatorSelectionMode = (typeof EVALUATOR_SELECTION_MODES)[number];

export const COMPOSITE_METHODS = ["weighted_average", "geometric_mean", "harmonic_mean"] as const;
export type CompositeMethod = (typeof COMPOSITE_METHODS)[number];

export const GUARANTEE_TYPES = ["deterministic", "probabilistic"] as const;
export type GuaranteeType = (typeof GUARANTEE_TYPES)[number];

export const SLO_OPERATORS = ["gte", "lte", "gt", "lt", "eq", "neq", "between"] as const;
export type SloOperator = (typeof SLO_OPERATORS)[number];

export const METRIC_TYPES = ["percentage", "boolean", "count", "duration_seconds", "score"] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export const ESCROW_TYPES = ["erc8183", "x402", "http_callback", "manual"] as const;
export type EscrowType = (typeof ESCROW_TYPES)[number];

export const TIMEOUT_ACTIONS = [
  "hold_for_backup_evaluator", "split_50_50",
  "return_to_client", "release_to_provider",
] as const;
export type TimeoutAction = (typeof TIMEOUT_ACTIONS)[number];

export const GRADUATED_RELEASE_MODES = ["tiered", "continuous"] as const;
export type GraduatedReleaseMode = (typeof GRADUATED_RELEASE_MODES)[number];

export const SERVICE_TYPES = [
  "research", "code_generation", "data_analysis",
  "translation", "review", "general",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const DEFAULT_GRADUATED_TIERS = [
  { composite_score_gte: 90, release_percent: 100 },
  { composite_score_gte: 75, release_percent: 85 },
  { composite_score_gte: 60, release_percent: 50 },
  { composite_score_lt: 60, release_percent: 0 },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function uuid(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function hashDict(d: Record<string, unknown>): string {
  const canonical = JSON.stringify(d, Object.keys(d).sort(), undefined);
  const compact = JSON.parse(canonical);
  const final = JSON.stringify(compact, null, undefined)
    .replace(/: /g, ":")
    .replace(/, /g, ",");
  // Use proper canonical: sort keys recursively, compact separators
  const canonicalStr = canonicalJsonStringify(d);
  return createHash("sha256").update(canonicalStr, "utf-8").digest("hex");
}

function canonicalJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items = value.map((v) => canonicalJsonStringify(v));
    return "[" + items.join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((k) => JSON.stringify(k) + ":" + canonicalJsonStringify(obj[k]));
    return "{" + pairs.join(",") + "}";
  }
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface IdentityDict {
  scheme: string;
  value: string;
  display_name?: string;
}

export class Identity {
  scheme: IdentityScheme;
  value: string;
  displayName: string;

  constructor(scheme: string, value: string, displayName = "") {
    if (!(IDENTITY_SCHEMES as readonly string[]).includes(scheme)) {
      throw new Error(`Unknown identity scheme: ${scheme}`);
    }
    this.scheme = scheme as IdentityScheme;
    this.value = value;
    this.displayName = displayName;
  }

  toDict(): IdentityDict {
    const d: IdentityDict = { scheme: this.scheme, value: this.value };
    if (this.displayName) d.display_name = this.displayName;
    return d;
  }

  static fromDict(d: IdentityDict): Identity {
    return new Identity(d.scheme, d.value, d.display_name || "");
  }
}

// ---------------------------------------------------------------------------
// SLO
// ---------------------------------------------------------------------------

export interface SloDict {
  operator: string;
  value: unknown;
}

export class SLO {
  operator: SloOperator;
  value: unknown;

  constructor(operator: string, value: unknown) {
    if (!(SLO_OPERATORS as readonly string[]).includes(operator)) {
      throw new Error(`Unknown SLO operator: ${operator}`);
    }
    this.operator = operator as SloOperator;
    this.value = value;
  }

  evaluate(actual: unknown): boolean {
    const a = actual as number;
    const v = this.value as number;
    switch (this.operator) {
      case "gte": return a >= v;
      case "lte": return a <= v;
      case "gt": return a > v;
      case "lt": return a < v;
      case "eq": return actual === this.value;
      case "neq": return actual !== this.value;
      case "between": {
        const [low, high] = this.value as [number, number];
        return a >= low && a <= high;
      }
      default: return false;
    }
  }

  toDict(): SloDict {
    return { operator: this.operator, value: this.value };
  }

  static fromDict(d: SloDict): SLO {
    return new SLO(d.operator, d.value);
  }
}

// ---------------------------------------------------------------------------
// QualityDimensionSpec
// ---------------------------------------------------------------------------

export interface QualityDimensionSpecDict {
  name: string;
  weight: number;
  metric?: string;
  slo?: SloDict;
  shadow_metric?: string;
  shadow_slo?: SloDict;
}

export class QualityDimensionSpec {
  name: string;
  weight: number;
  metric: string;
  slo: SLO | null;
  shadowMetric: string | null;
  shadowSlo: SLO | null;

  constructor(
    name: string,
    weight: number,
    metric = "percentage",
    slo: SLO | null = null,
    shadowMetric: string | null = null,
    shadowSlo: SLO | null = null,
  ) {
    this.name = name;
    this.weight = weight;
    this.metric = metric;
    this.slo = slo;
    this.shadowMetric = shadowMetric;
    this.shadowSlo = shadowSlo;
  }

  toDict(): QualityDimensionSpecDict {
    const d: QualityDimensionSpecDict = {
      name: this.name,
      weight: this.weight,
      metric: this.metric,
    };
    if (this.slo) d.slo = this.slo.toDict();
    if (this.shadowMetric) d.shadow_metric = this.shadowMetric;
    if (this.shadowSlo) d.shadow_slo = this.shadowSlo.toDict();
    return d;
  }

  static fromDict(d: QualityDimensionSpecDict): QualityDimensionSpec {
    return new QualityDimensionSpec(
      d.name,
      d.weight,
      d.metric || "percentage",
      d.slo ? SLO.fromDict(d.slo) : null,
      d.shadow_metric || null,
      d.shadow_slo ? SLO.fromDict(d.shadow_slo) : null,
    );
  }
}

// ---------------------------------------------------------------------------
// QualityCriteria
// ---------------------------------------------------------------------------

export interface QualityCriteriaDict {
  dimensions: QualityDimensionSpecDict[];
  composite_threshold: number;
  composite_method: string;
  guarantee_type: string;
}

export class QualityCriteria {
  dimensions: QualityDimensionSpec[];
  compositeThreshold: number;
  compositeMethod: string;
  guaranteeType: string;

  constructor(
    dimensions: QualityDimensionSpec[] = [],
    compositeThreshold = 75.0,
    compositeMethod = "weighted_average",
    guaranteeType = "deterministic",
  ) {
    this.dimensions = dimensions;
    this.compositeThreshold = compositeThreshold;
    this.compositeMethod = compositeMethod;
    this.guaranteeType = guaranteeType;
  }

  toDict(): QualityCriteriaDict {
    return {
      dimensions: this.dimensions.map((d) => d.toDict()),
      composite_threshold: this.compositeThreshold,
      composite_method: this.compositeMethod,
      guarantee_type: this.guaranteeType,
    };
  }

  static fromDict(d: QualityCriteriaDict): QualityCriteria {
    return new QualityCriteria(
      (d.dimensions || []).map((dim) => QualityDimensionSpec.fromDict(dim)),
      d.composite_threshold ?? 75.0,
      d.composite_method || "weighted_average",
      d.guarantee_type || "deterministic",
    );
  }
}

// ---------------------------------------------------------------------------
// ServiceSpec
// ---------------------------------------------------------------------------

export interface ServiceSpecDict {
  type: string;
  description: string;
  deliverable_format: string;
  constraints?: {
    max_tokens?: number;
    max_duration_seconds?: number;
    max_cost_usd?: number;
  };
}

export class ServiceSpec {
  type: string;
  description: string;
  deliverableFormat: string;
  maxTokens: number | null;
  maxDurationSeconds: number | null;
  maxCostUsd: number | null;

  constructor(
    type: string,
    description = "",
    deliverableFormat = "text",
    maxTokens: number | null = null,
    maxDurationSeconds: number | null = null,
    maxCostUsd: number | null = null,
  ) {
    this.type = type;
    this.description = description;
    this.deliverableFormat = deliverableFormat;
    this.maxTokens = maxTokens;
    this.maxDurationSeconds = maxDurationSeconds;
    this.maxCostUsd = maxCostUsd;
  }

  toDict(): ServiceSpecDict {
    const d: ServiceSpecDict = {
      type: this.type,
      description: this.description,
      deliverable_format: this.deliverableFormat,
    };
    const constraints: Record<string, number> = {};
    if (this.maxTokens !== null) constraints.max_tokens = this.maxTokens;
    if (this.maxDurationSeconds !== null) constraints.max_duration_seconds = this.maxDurationSeconds;
    if (this.maxCostUsd !== null) constraints.max_cost_usd = this.maxCostUsd;
    if (Object.keys(constraints).length > 0) d.constraints = constraints;
    return d;
  }

  static fromDict(d: ServiceSpecDict): ServiceSpec {
    const c = d.constraints || {};
    return new ServiceSpec(
      d.type,
      d.description || "",
      d.deliverable_format || "text",
      c.max_tokens ?? null,
      c.max_duration_seconds ?? null,
      c.max_cost_usd ?? null,
    );
  }
}

// ---------------------------------------------------------------------------
// GraduatedTier
// ---------------------------------------------------------------------------

export interface GraduatedTierDict {
  composite_score_gte?: number;
  composite_score_lt?: number;
  release_percent: number;
}

export class GraduatedTier {
  compositeScoreGte: number | null;
  compositeScoreLt: number | null;
  releasePercent: number;

  constructor(
    compositeScoreGte: number | null = null,
    compositeScoreLt: number | null = null,
    releasePercent = 0.0,
  ) {
    this.compositeScoreGte = compositeScoreGte;
    this.compositeScoreLt = compositeScoreLt;
    this.releasePercent = releasePercent;
  }

  toDict(): GraduatedTierDict {
    const d: GraduatedTierDict = { release_percent: this.releasePercent };
    if (this.compositeScoreGte !== null) d.composite_score_gte = this.compositeScoreGte;
    if (this.compositeScoreLt !== null) d.composite_score_lt = this.compositeScoreLt;
    return d;
  }

  static fromDict(d: GraduatedTierDict): GraduatedTier {
    return new GraduatedTier(
      d.composite_score_gte ?? null,
      d.composite_score_lt ?? null,
      d.release_percent ?? 0.0,
    );
  }
}

// ---------------------------------------------------------------------------
// EscrowConfig
// ---------------------------------------------------------------------------

export interface EscrowConfigDict {
  enabled: boolean;
  type: string;
  payment?: {
    amount: string;
    currency: string;
    graduated_release: {
      mode: string;
      tiers: GraduatedTierDict[];
    };
  };
  dead_mans_switch: {
    client_timeout_seconds: number;
    provider_timeout_seconds: number;
    evaluator_timeout_seconds: number;
    timeout_action: string;
  };
}

export class EscrowConfig {
  enabled: boolean;
  type: string;
  amount: string | null;
  currency: string;
  graduatedReleaseMode: string;
  tiers: GraduatedTier[];
  deadMansSwitchAction: string;
  clientTimeoutSeconds: number;
  providerTimeoutSeconds: number;
  evaluatorTimeoutSeconds: number;

  constructor(opts: {
    enabled?: boolean;
    type?: string;
    amount?: string | null;
    currency?: string;
    graduatedReleaseMode?: string;
    tiers?: GraduatedTier[];
    deadMansSwitchAction?: string;
    clientTimeoutSeconds?: number;
    providerTimeoutSeconds?: number;
    evaluatorTimeoutSeconds?: number;
  } = {}) {
    this.enabled = opts.enabled ?? false;
    this.type = opts.type || "http_callback";
    this.amount = opts.amount ?? null;
    this.currency = opts.currency || "USD";
    this.graduatedReleaseMode = opts.graduatedReleaseMode || "tiered";
    this.tiers = opts.tiers || [];
    this.deadMansSwitchAction = opts.deadMansSwitchAction || "hold_for_backup_evaluator";
    this.clientTimeoutSeconds = opts.clientTimeoutSeconds ?? 86400;
    this.providerTimeoutSeconds = opts.providerTimeoutSeconds ?? 86400;
    this.evaluatorTimeoutSeconds = opts.evaluatorTimeoutSeconds ?? 3600;
  }

  toDict(): EscrowConfigDict {
    const d: Record<string, unknown> = { enabled: this.enabled, type: this.type };
    if (this.amount !== null) {
      d.payment = {
        amount: this.amount,
        currency: this.currency,
        graduated_release: {
          mode: this.graduatedReleaseMode,
          tiers: this.tiers.map((t) => t.toDict()),
        },
      };
    }
    d.dead_mans_switch = {
      client_timeout_seconds: this.clientTimeoutSeconds,
      provider_timeout_seconds: this.providerTimeoutSeconds,
      evaluator_timeout_seconds: this.evaluatorTimeoutSeconds,
      timeout_action: this.deadMansSwitchAction,
    };
    return d as unknown as EscrowConfigDict;
  }

  static fromDict(d: Record<string, unknown>): EscrowConfig {
    const payment = (d.payment || {}) as Record<string, unknown>;
    const gr = (payment.graduated_release || {}) as Record<string, unknown>;
    const dms = (d.dead_mans_switch || {}) as Record<string, unknown>;
    const tiersRaw = (gr.tiers || []) as GraduatedTierDict[];
    return new EscrowConfig({
      enabled: (d.enabled as boolean) ?? false,
      type: (d.type as string) || "http_callback",
      amount: (payment.amount as string) ?? null,
      currency: (payment.currency as string) || "USD",
      graduatedReleaseMode: (gr.mode as string) || "tiered",
      tiers: tiersRaw.map((t) => GraduatedTier.fromDict(t)),
      deadMansSwitchAction: (dms.timeout_action as string) || "hold_for_backup_evaluator",
      clientTimeoutSeconds: (dms.client_timeout_seconds as number) ?? 86400,
      providerTimeoutSeconds: (dms.provider_timeout_seconds as number) ?? 86400,
      evaluatorTimeoutSeconds: (dms.evaluator_timeout_seconds as number) ?? 3600,
    });
  }
}

// ---------------------------------------------------------------------------
// VerificationConfig
// ---------------------------------------------------------------------------

export interface VerificationConfigDict {
  strategy: string;
  depth: string;
  challenge_window_seconds: number;
  evaluator_timeout_seconds: number;
  canary_tasks: {
    enabled: boolean;
    frequency: string;
  };
}

export class VerificationConfig {
  strategy: string;
  depth: string;
  challengeWindowSeconds: number;
  evaluatorTimeoutSeconds: number;
  canaryEnabled: boolean;
  canaryFrequency: string;

  constructor(opts: {
    strategy?: string;
    depth?: string;
    challengeWindowSeconds?: number;
    evaluatorTimeoutSeconds?: number;
    canaryEnabled?: boolean;
    canaryFrequency?: string;
  } = {}) {
    this.strategy = opts.strategy || "optimistic";
    this.depth = opts.depth || "semantic";
    this.challengeWindowSeconds = opts.challengeWindowSeconds ?? 7200;
    this.evaluatorTimeoutSeconds = opts.evaluatorTimeoutSeconds ?? 600;
    this.canaryEnabled = opts.canaryEnabled ?? false;
    this.canaryFrequency = opts.canaryFrequency || "1_per_5_deliveries";
  }

  toDict(): VerificationConfigDict {
    return {
      strategy: this.strategy,
      depth: this.depth,
      challenge_window_seconds: this.challengeWindowSeconds,
      evaluator_timeout_seconds: this.evaluatorTimeoutSeconds,
      canary_tasks: {
        enabled: this.canaryEnabled,
        frequency: this.canaryFrequency,
      },
    };
  }

  static fromDict(d: Record<string, unknown>): VerificationConfig {
    const canary = (d.canary_tasks || {}) as Record<string, unknown>;
    return new VerificationConfig({
      strategy: (d.strategy as string) || "optimistic",
      depth: (d.depth as string) || "semantic",
      challengeWindowSeconds: (d.challenge_window_seconds as number) ?? 7200,
      evaluatorTimeoutSeconds: (d.evaluator_timeout_seconds as number) ?? 600,
      canaryEnabled: (canary.enabled as boolean) ?? false,
      canaryFrequency: (canary.frequency as string) || "1_per_5_deliveries",
    });
  }
}

// ---------------------------------------------------------------------------
// NegotiationMessage
// ---------------------------------------------------------------------------

export interface NegotiationMessageDict {
  negotiation_id: string;
  agreement_id: string;
  round: number;
  action: string;
  sender?: IdentityDict;
  proposed_changes: Record<string, unknown>;
  rationale_code: string;
  timestamp: string;
  message_hash?: string;
}

export class NegotiationMessage {
  negotiationId: string;
  agreementId: string;
  round: number;
  action: string;
  sender: Identity | null;
  proposedChanges: Record<string, unknown>;
  rationaleCode: string;
  timestamp: string;
  messageHash: string;

  constructor(opts: {
    negotiationId?: string;
    agreementId?: string;
    round?: number;
    action?: string;
    sender?: Identity | null;
    proposedChanges?: Record<string, unknown>;
    rationaleCode?: string;
    timestamp?: string;
    messageHash?: string;
  } = {}) {
    this.negotiationId = opts.negotiationId || `neg-${uuid().slice(0, 12)}`;
    this.agreementId = opts.agreementId || "";
    this.round = opts.round ?? 0;
    this.action = opts.action || "propose";
    this.sender = opts.sender ?? null;
    this.proposedChanges = opts.proposedChanges || {};
    this.rationaleCode = opts.rationaleCode || "";
    this.timestamp = opts.timestamp || nowIso();
    this.messageHash = opts.messageHash || "";
  }

  computeHash(): string {
    const d: Record<string, unknown> = {
      negotiation_id: this.negotiationId,
      agreement_id: this.agreementId,
      round: this.round,
      action: this.action,
      proposed_changes: this.proposedChanges,
      timestamp: this.timestamp,
    };
    this.messageHash = hashDict(d);
    return this.messageHash;
  }

  toDict(): NegotiationMessageDict {
    const d: NegotiationMessageDict = {
      negotiation_id: this.negotiationId,
      agreement_id: this.agreementId,
      round: this.round,
      action: this.action,
      proposed_changes: this.proposedChanges,
      rationale_code: this.rationaleCode,
      timestamp: this.timestamp,
    };
    if (this.sender) d.sender = this.sender.toDict();
    if (this.messageHash) d.message_hash = this.messageHash;
    return d;
  }

  static fromDict(d: NegotiationMessageDict): NegotiationMessage {
    return new NegotiationMessage({
      negotiationId: d.negotiation_id || "",
      agreementId: d.agreement_id || "",
      round: d.round ?? 0,
      action: d.action || "propose",
      sender: d.sender ? Identity.fromDict(d.sender) : null,
      proposedChanges: d.proposed_changes || {},
      rationaleCode: d.rationale_code || "",
      timestamp: d.timestamp || "",
      messageHash: d.message_hash || "",
    });
  }
}

// ---------------------------------------------------------------------------
// DimensionScore
// ---------------------------------------------------------------------------

export interface DimensionScoreDict {
  name: string;
  score: number;
  slo_target?: unknown;
  slo_met?: boolean;
  evidence?: string;
  shadow_metric?: {
    name: string;
    value: number | null;
    slo_target: unknown;
    slo_met: boolean | null;
  };
}

export class DimensionScore {
  name: string;
  score: number;
  sloTarget: unknown;
  sloMet: boolean | null;
  evidence: string;
  shadowMetricName: string | null;
  shadowMetricValue: number | null;
  shadowSloTarget: unknown;
  shadowSloMet: boolean | null;

  constructor(opts: {
    name: string;
    score: number;
    sloTarget?: unknown;
    sloMet?: boolean | null;
    evidence?: string;
    shadowMetricName?: string | null;
    shadowMetricValue?: number | null;
    shadowSloTarget?: unknown;
    shadowSloMet?: boolean | null;
  }) {
    this.name = opts.name;
    this.score = opts.score;
    this.sloTarget = opts.sloTarget ?? null;
    this.sloMet = opts.sloMet ?? null;
    this.evidence = opts.evidence || "";
    this.shadowMetricName = opts.shadowMetricName ?? null;
    this.shadowMetricValue = opts.shadowMetricValue ?? null;
    this.shadowSloTarget = opts.shadowSloTarget ?? null;
    this.shadowSloMet = opts.shadowSloMet ?? null;
  }

  toDict(): DimensionScoreDict {
    const d: DimensionScoreDict = { name: this.name, score: this.score };
    if (this.sloTarget !== null) d.slo_target = this.sloTarget;
    if (this.sloMet !== null) d.slo_met = this.sloMet;
    if (this.evidence) d.evidence = this.evidence;
    if (this.shadowMetricName) {
      d.shadow_metric = {
        name: this.shadowMetricName,
        value: this.shadowMetricValue,
        slo_target: this.shadowSloTarget,
        slo_met: this.shadowSloMet,
      };
    }
    return d;
  }

  static fromDict(d: DimensionScoreDict): DimensionScore {
    const sm = d.shadow_metric;
    return new DimensionScore({
      name: d.name,
      score: d.score,
      sloTarget: d.slo_target ?? null,
      sloMet: d.slo_met ?? null,
      evidence: d.evidence || "",
      shadowMetricName: sm?.name ?? null,
      shadowMetricValue: sm?.value ?? null,
      shadowSloTarget: sm?.slo_target ?? null,
      shadowSloMet: sm?.slo_met ?? null,
    });
  }
}

// ---------------------------------------------------------------------------
// VerificationResult
// ---------------------------------------------------------------------------

export interface VerificationResultDict {
  verification_id: string;
  agreement_id: string;
  timestamp: string;
  evaluator: {
    type: string;
    identity?: IdentityDict;
  };
  dimensions: DimensionScoreDict[];
  composite: {
    score: number;
    method: string;
    threshold: number;
    passed: boolean;
  };
  determination: {
    result: string;
    payment_release_percent: number;
    confidence: number;
    notes: string;
  };
  evidence_trail: {
    deliverable_hash: string;
    evaluation_hash: string;
    evaluation_duration_ms: number;
  };
  result_hash?: string;
}

export class VerificationResult {
  verificationId: string;
  agreementId: string;
  timestamp: string;
  evaluatorIdentity: Identity | null;
  evaluatorType: string;
  dimensions: DimensionScore[];
  compositeScore: number;
  compositeMethod: string;
  compositeThreshold: number;
  passed: boolean;
  determination: string;
  paymentReleasePercent: number;
  confidence: number;
  notes: string;
  deliverableHash: string;
  evaluationHash: string;
  evaluationDurationMs: number;
  resultHash: string;

  constructor(opts: {
    verificationId?: string;
    agreementId?: string;
    timestamp?: string;
    evaluatorIdentity?: Identity | null;
    evaluatorType?: string;
    dimensions?: DimensionScore[];
    compositeScore?: number;
    compositeMethod?: string;
    compositeThreshold?: number;
    passed?: boolean;
    determination?: string;
    paymentReleasePercent?: number;
    confidence?: number;
    notes?: string;
    deliverableHash?: string;
    evaluationHash?: string;
    evaluationDurationMs?: number;
    resultHash?: string;
  } = {}) {
    this.verificationId = opts.verificationId || `ver-${uuid().slice(0, 12)}`;
    this.agreementId = opts.agreementId || "";
    this.timestamp = opts.timestamp || nowIso();
    this.evaluatorIdentity = opts.evaluatorIdentity ?? null;
    this.evaluatorType = opts.evaluatorType || "agent_as_judge";
    this.dimensions = opts.dimensions || [];
    this.compositeScore = opts.compositeScore ?? 0.0;
    this.compositeMethod = opts.compositeMethod || "weighted_average";
    this.compositeThreshold = opts.compositeThreshold ?? 75.0;
    this.passed = opts.passed ?? false;
    this.determination = opts.determination || "FAIL";
    this.paymentReleasePercent = opts.paymentReleasePercent ?? 0.0;
    this.confidence = opts.confidence ?? 0.0;
    this.notes = opts.notes || "";
    this.deliverableHash = opts.deliverableHash || "";
    this.evaluationHash = opts.evaluationHash || "";
    this.evaluationDurationMs = opts.evaluationDurationMs ?? 0;
    this.resultHash = opts.resultHash || "";
  }

  computeHash(): string {
    const d: Record<string, unknown> = {
      verification_id: this.verificationId,
      agreement_id: this.agreementId,
      dimensions: this.dimensions.map((ds) => ds.toDict()),
      composite_score: this.compositeScore,
      passed: this.passed,
      timestamp: this.timestamp,
    };
    this.resultHash = hashDict(d);
    return this.resultHash;
  }

  toDict(): VerificationResultDict {
    const d: VerificationResultDict = {
      verification_id: this.verificationId,
      agreement_id: this.agreementId,
      timestamp: this.timestamp,
      evaluator: {
        type: this.evaluatorType,
      },
      dimensions: this.dimensions.map((ds) => ds.toDict()),
      composite: {
        score: this.compositeScore,
        method: this.compositeMethod,
        threshold: this.compositeThreshold,
        passed: this.passed,
      },
      determination: {
        result: this.determination,
        payment_release_percent: this.paymentReleasePercent,
        confidence: this.confidence,
        notes: this.notes,
      },
      evidence_trail: {
        deliverable_hash: this.deliverableHash,
        evaluation_hash: this.evaluationHash,
        evaluation_duration_ms: this.evaluationDurationMs,
      },
    };
    if (this.evaluatorIdentity) {
      d.evaluator.identity = this.evaluatorIdentity.toDict();
    }
    if (this.resultHash) d.result_hash = this.resultHash;
    return d;
  }

  static fromDict(d: VerificationResultDict): VerificationResult {
    const ev = d.evaluator || {};
    const comp = d.composite || { score: 0, method: "weighted_average", threshold: 75, passed: false };
    const det = d.determination || { result: "FAIL", payment_release_percent: 0, confidence: 0, notes: "" };
    const trail = d.evidence_trail || { deliverable_hash: "", evaluation_hash: "", evaluation_duration_ms: 0 };
    const evId = ev.identity;
    return new VerificationResult({
      verificationId: d.verification_id || "",
      agreementId: d.agreement_id || "",
      timestamp: d.timestamp || "",
      evaluatorIdentity: evId ? Identity.fromDict(evId) : null,
      evaluatorType: ev.type || "agent_as_judge",
      dimensions: (d.dimensions || []).map((ds) => DimensionScore.fromDict(ds)),
      compositeScore: comp.score ?? 0.0,
      compositeMethod: comp.method || "weighted_average",
      compositeThreshold: comp.threshold ?? 75.0,
      passed: comp.passed ?? false,
      determination: det.result || "FAIL",
      paymentReleasePercent: det.payment_release_percent ?? 0.0,
      confidence: det.confidence ?? 0.0,
      notes: det.notes || "",
      deliverableHash: trail.deliverable_hash || "",
      evaluationHash: trail.evaluation_hash || "",
      evaluationDurationMs: trail.evaluation_duration_ms ?? 0,
      resultHash: d.result_hash || "",
    });
  }
}

// ---------------------------------------------------------------------------
// EscrowState
// ---------------------------------------------------------------------------

export interface EscrowStateDict {
  agreement_id: string;
  status: string;
  funded_amount: string;
  currency: string;
  released_amount: string;
  release_percent: number;
  funded_at?: string;
  released_at?: string;
  trigger?: string;
  state_hash?: string;
}

export class EscrowState {
  agreementId: string;
  status: string;
  fundedAmount: string;
  currency: string;
  releasedAmount: string;
  releasePercent: number;
  fundedAt: string;
  releasedAt: string;
  trigger: string;
  stateHash: string;

  constructor(opts: {
    agreementId?: string;
    status?: string;
    fundedAmount?: string;
    currency?: string;
    releasedAmount?: string;
    releasePercent?: number;
    fundedAt?: string;
    releasedAt?: string;
    trigger?: string;
    stateHash?: string;
  } = {}) {
    this.agreementId = opts.agreementId || "";
    this.status = opts.status || "unfunded";
    this.fundedAmount = opts.fundedAmount || "0";
    this.currency = opts.currency || "USD";
    this.releasedAmount = opts.releasedAmount || "0";
    this.releasePercent = opts.releasePercent ?? 0.0;
    this.fundedAt = opts.fundedAt || "";
    this.releasedAt = opts.releasedAt || "";
    this.trigger = opts.trigger || "";
    this.stateHash = opts.stateHash || "";
  }

  computeHash(): string {
    const d: Record<string, unknown> = {
      agreement_id: this.agreementId,
      status: this.status,
      funded_amount: this.fundedAmount,
      released_amount: this.releasedAmount,
      release_percent: this.releasePercent,
    };
    this.stateHash = hashDict(d);
    return this.stateHash;
  }

  toDict(): EscrowStateDict {
    const d: EscrowStateDict = {
      agreement_id: this.agreementId,
      status: this.status,
      funded_amount: this.fundedAmount,
      currency: this.currency,
      released_amount: this.releasedAmount,
      release_percent: this.releasePercent,
    };
    if (this.fundedAt) d.funded_at = this.fundedAt;
    if (this.releasedAt) d.released_at = this.releasedAt;
    if (this.trigger) d.trigger = this.trigger;
    if (this.stateHash) d.state_hash = this.stateHash;
    return d;
  }

  static fromDict(d: EscrowStateDict): EscrowState {
    return new EscrowState({
      agreementId: d.agreement_id || "",
      status: d.status || "unfunded",
      fundedAmount: d.funded_amount || "0",
      currency: d.currency || "USD",
      releasedAmount: d.released_amount || "0",
      releasePercent: d.release_percent ?? 0.0,
      fundedAt: d.funded_at || "",
      releasedAt: d.released_at || "",
      trigger: d.trigger || "",
      stateHash: d.state_hash || "",
    });
  }
}
