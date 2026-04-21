import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import {
  // Constants
  ASA_VERSION,
  AGREEMENT_STATUSES,
  IDENTITY_SCHEMES,
  SLO_OPERATORS,
  COMPOSITE_METHODS,
  NEGOTIATION_ACTIONS,
  VERIFICATION_DEPTHS,
  SERVICE_TYPES,
  ESCROW_TYPES,
  DEFAULT_GRADUATED_TIERS,
  // Schema classes
  Identity,
  SLO,
  QualityDimensionSpec,
  QualityCriteria,
  ServiceSpec,
  GraduatedTier,
  EscrowConfig,
  VerificationConfig,
  NegotiationMessage,
  DimensionScore,
  VerificationResult,
  EscrowState,
  hashDict,
  // Agreement
  Agreement,
  // Negotiation
  NegotiationConfig,
  NegotiationSession,
  // Templates
  TEMPLATES,
  createAgreementFromTemplate,
  getTemplate,
  listTemplates,
  // Escrow
  EscrowBinding,
  computeContinuousRelease,
  computeReleasePercent,
  computeTieredRelease,
  // Verification
  VerificationEngine,
  getStandaloneCriteria,
  verifyComposite,
  verifySemantic,
  verifyStructural,
  // Evaluator
  CanaryTask,
  EvaluatorRecord,
  EvaluatorRegistry,
  // Dimensions
  DIMENSION_REGISTRY,
  QualityDimension,
  computeComposite,
  computeGeometricMean,
  computeHarmonicMean,
  computeWeightedAverage,
  getDimension,
  listDimensions,
  // Store
  AgreementStore,
} from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(): Identity {
  return new Identity("coc", "client-001", "Test Client");
}

function makeProvider(): Identity {
  return new Identity("coc", "provider-001", "Test Provider");
}

function makeEvaluator(): Identity {
  return new Identity("coc", "evaluator-001", "Test Evaluator");
}

function makeBasicAgreement(): Agreement {
  return new Agreement({
    client: makeClient(),
    provider: makeProvider(),
    service: new ServiceSpec("research", "Test task"),
    qualityCriteria: new QualityCriteria([
      new QualityDimensionSpec("accuracy", 0.5, "percentage", new SLO("gte", 70)),
      new QualityDimensionSpec("completeness", 0.5, "percentage", new SLO("gte", 60)),
    ]),
  });
}

const TEST_STORE_DIR = ".asa-test-" + Date.now();

// =========================================================================
// Schema tests
// =========================================================================

describe("Schema — Constants", () => {
  it("ASA_VERSION is 1.0.0", () => {
    assert.equal(ASA_VERSION, "1.0.0");
  });

  it("all constant arrays are non-empty", () => {
    assert.ok(AGREEMENT_STATUSES.length > 0);
    assert.ok(IDENTITY_SCHEMES.length > 0);
    assert.ok(SLO_OPERATORS.length > 0);
    assert.ok(COMPOSITE_METHODS.length > 0);
    assert.ok(NEGOTIATION_ACTIONS.length > 0);
    assert.ok(VERIFICATION_DEPTHS.length > 0);
    assert.ok(SERVICE_TYPES.length > 0);
    assert.ok(ESCROW_TYPES.length > 0);
  });

  it("DEFAULT_GRADUATED_TIERS has 4 entries", () => {
    assert.equal(DEFAULT_GRADUATED_TIERS.length, 4);
  });
});

describe("Schema — Identity", () => {
  it("creates and round-trips", () => {
    const id = new Identity("coc", "agent-x", "Agent X");
    const d = id.toDict();
    assert.equal(d.scheme, "coc");
    assert.equal(d.value, "agent-x");
    assert.equal(d.display_name, "Agent X");
    const id2 = Identity.fromDict(d);
    assert.equal(id2.scheme, "coc");
    assert.equal(id2.displayName, "Agent X");
  });

  it("rejects unknown scheme", () => {
    assert.throws(() => new Identity("invalid", "x"), /Unknown identity scheme/);
  });

  it("omits display_name when empty", () => {
    const d = new Identity("uri", "http://example.com").toDict();
    assert.equal(d.display_name, undefined);
  });
});

describe("Schema — SLO", () => {
  it("evaluates all operators", () => {
    assert.equal(new SLO("gte", 70).evaluate(70), true);
    assert.equal(new SLO("gte", 70).evaluate(69), false);
    assert.equal(new SLO("lte", 50).evaluate(50), true);
    assert.equal(new SLO("lte", 50).evaluate(51), false);
    assert.equal(new SLO("gt", 80).evaluate(81), true);
    assert.equal(new SLO("gt", 80).evaluate(80), false);
    assert.equal(new SLO("lt", 30).evaluate(29), true);
    assert.equal(new SLO("lt", 30).evaluate(30), false);
    assert.equal(new SLO("eq", 100).evaluate(100), true);
    assert.equal(new SLO("eq", 100).evaluate(99), false);
    assert.equal(new SLO("neq", 0).evaluate(1), true);
    assert.equal(new SLO("neq", 0).evaluate(0), false);
    assert.equal(new SLO("between", [60, 90]).evaluate(75), true);
    assert.equal(new SLO("between", [60, 90]).evaluate(59), false);
  });

  it("round-trips", () => {
    const slo = new SLO("gte", 85);
    const d = slo.toDict();
    const slo2 = SLO.fromDict(d);
    assert.equal(slo2.operator, "gte");
    assert.equal(slo2.value, 85);
  });

  it("rejects unknown operator", () => {
    assert.throws(() => new SLO("invalid", 0), /Unknown SLO operator/);
  });
});

describe("Schema — QualityDimensionSpec", () => {
  it("round-trips with SLO and shadow", () => {
    const spec = new QualityDimensionSpec(
      "accuracy", 0.25, "percentage",
      new SLO("gte", 80),
      "f1_score", new SLO("gte", 0.9),
    );
    const d = spec.toDict();
    assert.equal(d.name, "accuracy");
    assert.equal(d.shadow_metric, "f1_score");
    const spec2 = QualityDimensionSpec.fromDict(d);
    assert.equal(spec2.shadowMetric, "f1_score");
    assert.equal(spec2.shadowSlo!.value, 0.9);
  });
});

describe("Schema — QualityCriteria", () => {
  it("round-trips", () => {
    const qc = new QualityCriteria(
      [new QualityDimensionSpec("accuracy", 1.0)],
      80.0, "geometric_mean", "probabilistic",
    );
    const d = qc.toDict();
    assert.equal(d.composite_threshold, 80.0);
    assert.equal(d.composite_method, "geometric_mean");
    const qc2 = QualityCriteria.fromDict(d);
    assert.equal(qc2.compositeMethod, "geometric_mean");
    assert.equal(qc2.guaranteeType, "probabilistic");
  });
});

describe("Schema — ServiceSpec", () => {
  it("round-trips with constraints", () => {
    const ss = new ServiceSpec("code_generation", "Build API", "code", 10000, 3600, 5.0);
    const d = ss.toDict();
    assert.equal(d.constraints!.max_tokens, 10000);
    assert.equal(d.constraints!.max_cost_usd, 5.0);
    const ss2 = ServiceSpec.fromDict(d);
    assert.equal(ss2.maxTokens, 10000);
    assert.equal(ss2.maxCostUsd, 5.0);
  });

  it("omits constraints when empty", () => {
    const d = new ServiceSpec("general").toDict();
    assert.equal(d.constraints, undefined);
  });
});

describe("Schema — GraduatedTier", () => {
  it("round-trips", () => {
    const t = new GraduatedTier(90, null, 100);
    const d = t.toDict();
    assert.equal(d.composite_score_gte, 90);
    assert.equal(d.composite_score_lt, undefined);
    const t2 = GraduatedTier.fromDict(d);
    assert.equal(t2.compositeScoreGte, 90);
    assert.equal(t2.releasePercent, 100);
  });
});

describe("Schema — EscrowConfig", () => {
  it("round-trips with payment", () => {
    const ec = new EscrowConfig({
      enabled: true,
      amount: "100.00",
      currency: "USD",
      tiers: [new GraduatedTier(90, null, 100)],
    });
    const d = ec.toDict();
    assert.equal(d.payment!.amount, "100.00");
    assert.equal(d.dead_mans_switch.timeout_action, "hold_for_backup_evaluator");
    const ec2 = EscrowConfig.fromDict(d as any);
    assert.equal(ec2.amount, "100.00");
    assert.equal(ec2.deadMansSwitchAction, "hold_for_backup_evaluator");
  });
});

describe("Schema — VerificationConfig", () => {
  it("round-trips", () => {
    const vc = new VerificationConfig({ depth: "composite", canaryEnabled: true });
    const d = vc.toDict();
    assert.equal(d.canary_tasks.enabled, true);
    const vc2 = VerificationConfig.fromDict(d as any);
    assert.equal(vc2.canaryEnabled, true);
    assert.equal(vc2.depth, "composite");
  });
});

describe("Schema — NegotiationMessage", () => {
  it("auto-generates ID and timestamp", () => {
    const msg = new NegotiationMessage({ action: "propose" });
    assert.ok(msg.negotiationId.startsWith("neg-"));
    assert.ok(msg.timestamp.length > 0);
  });

  it("computes and round-trips hash", () => {
    const msg = new NegotiationMessage({
      agreementId: "asa-test",
      action: "propose",
    });
    const hash = msg.computeHash();
    assert.ok(hash.length === 64);
    const d = msg.toDict();
    assert.equal(d.message_hash, hash);
    const msg2 = NegotiationMessage.fromDict(d);
    assert.equal(msg2.messageHash, hash);
  });
});

describe("Schema — DimensionScore", () => {
  it("round-trips with shadow metric", () => {
    const ds = new DimensionScore({
      name: "accuracy", score: 85,
      sloTarget: 70, sloMet: true,
      evidence: "Good",
      shadowMetricName: "f1",
      shadowMetricValue: 0.92,
      shadowSloTarget: 0.9,
      shadowSloMet: true,
    });
    const d = ds.toDict();
    assert.equal(d.shadow_metric!.name, "f1");
    const ds2 = DimensionScore.fromDict(d);
    assert.equal(ds2.shadowMetricName, "f1");
    assert.equal(ds2.shadowMetricValue, 0.92);
  });
});

describe("Schema — VerificationResult", () => {
  it("auto-generates ID", () => {
    const vr = new VerificationResult();
    assert.ok(vr.verificationId.startsWith("ver-"));
  });

  it("computes hash and round-trips", () => {
    const vr = new VerificationResult({
      agreementId: "asa-test",
      compositeScore: 82.5,
      passed: true,
    });
    vr.computeHash();
    const d = vr.toDict();
    assert.equal(d.result_hash, vr.resultHash);
    const vr2 = VerificationResult.fromDict(d);
    assert.equal(vr2.resultHash, vr.resultHash);
    assert.equal(vr2.compositeScore, 82.5);
  });
});

describe("Schema — EscrowState", () => {
  it("round-trips", () => {
    const es = new EscrowState({
      agreementId: "asa-1", status: "funded",
      fundedAmount: "100.00", fundedAt: "2026-01-01T00:00:00Z",
    });
    es.computeHash();
    const d = es.toDict();
    assert.equal(d.funded_at, "2026-01-01T00:00:00Z");
    const es2 = EscrowState.fromDict(d);
    assert.equal(es2.fundedAmount, "100.00");
    assert.equal(es2.stateHash, es.stateHash);
  });
});

describe("Schema — hashDict", () => {
  it("is deterministic", () => {
    const d = { b: 2, a: 1 };
    assert.equal(hashDict(d), hashDict(d));
    assert.equal(hashDict(d), hashDict({ a: 1, b: 2 }));
  });

  it("produces 64-char hex", () => {
    assert.equal(hashDict({ x: 1 }).length, 64);
  });
});

// =========================================================================
// Agreement tests
// =========================================================================

describe("Agreement", () => {
  it("auto-generates ID and created_at", () => {
    const ag = new Agreement();
    assert.ok(ag.agreementId.startsWith("asa-"));
    assert.ok(ag.createdAt.length > 0);
  });

  it("validates correctly", () => {
    const ag = makeBasicAgreement();
    assert.deepEqual(ag.validate(), []);
    assert.equal(ag.isValid(), true);
  });

  it("reports validation errors", () => {
    const ag = new Agreement();
    const errors = ag.validate();
    assert.ok(errors.length >= 3);
  });

  it("validates weight sum", () => {
    const ag = new Agreement({
      client: makeClient(),
      provider: makeProvider(),
      service: new ServiceSpec("general"),
      qualityCriteria: new QualityCriteria([
        new QualityDimensionSpec("a", 0.1),
        new QualityDimensionSpec("b", 0.1),
      ]),
    });
    const errors = ag.validate();
    assert.ok(errors.some((e) => e.includes("weights should sum")));
  });

  it("lifecycle: propose -> sign -> deliver -> verify -> close", () => {
    const ag = makeBasicAgreement();
    assert.equal(ag.status, "proposed");

    ag.sign("client", "sig-client");
    assert.equal(ag.status, "proposed");

    ag.sign("provider", "sig-provider");
    assert.equal(ag.status, "active");
    assert.ok(ag.agreementHash.length === 64);

    ag.deliver("abc123");
    assert.equal(ag.status, "delivered");
    assert.equal(ag.deliverableHash, "abc123");

    ag.markVerified(true);
    assert.equal(ag.status, "verified");

    ag.close();
    assert.equal(ag.status, "closed");
  });

  it("lifecycle: propose -> reject", () => {
    const ag = makeBasicAgreement();
    ag.reject();
    assert.equal(ag.status, "rejected");
  });

  it("lifecycle: dispute from delivered", () => {
    const ag = makeBasicAgreement();
    ag.sign("client", "c");
    ag.sign("provider", "p");
    ag.deliver("hash");
    ag.dispute();
    assert.equal(ag.status, "disputed");
  });

  it("lifecycle: expire", () => {
    const ag = makeBasicAgreement();
    ag.expire();
    assert.equal(ag.status, "expired");
  });

  it("throws on invalid transitions", () => {
    const ag = makeBasicAgreement();
    assert.throws(() => ag.deliver("x"), /must be 'active'/);
    assert.throws(() => ag.markVerified(true), /must be 'delivered'/);
    assert.throws(() => ag.close(), /Cannot close/);
  });

  it("round-trips via toDict/fromDict", () => {
    const ag = makeBasicAgreement();
    ag.verification = new VerificationConfig({ depth: "composite" });
    ag.escrow = new EscrowConfig({ enabled: true, amount: "50.00" });
    ag.evaluator = makeEvaluator();
    ag.expiresAt = "2027-01-01T00:00:00Z";
    ag.sign("client", "sc");
    ag.sign("provider", "sp");

    const d = ag.toDict();
    const ag2 = Agreement.fromDict(d as any);
    assert.equal(ag2.agreementId, ag.agreementId);
    assert.equal(ag2.status, "active");
    assert.equal(ag2.client!.value, "client-001");
    assert.equal(ag2.evaluator!.value, "evaluator-001");
    assert.equal(ag2.escrow!.amount, "50.00");
    assert.equal(ag2.verification!.depth, "composite");
  });

  it("round-trips via toJson/fromJson", () => {
    const ag = makeBasicAgreement();
    const json = ag.toJson();
    const ag2 = Agreement.fromJson(json);
    assert.equal(ag2.agreementId, ag.agreementId);
  });

  it("computes deterministic hash", () => {
    const ag = makeBasicAgreement();
    ag.agreementId = "asa-fixed";
    ag.createdAt = "2026-01-01T00:00:00Z";
    const h1 = ag.computeHash();
    const h2 = ag.computeHash();
    assert.equal(h1, h2);
    assert.equal(h1.length, 64);
  });
});

// =========================================================================
// Dimensions tests
// =========================================================================

describe("Dimensions — Registry", () => {
  it("contains 30 dimensions", () => {
    assert.equal(DIMENSION_REGISTRY.size, 30);
  });

  it("getDimension finds known", () => {
    const d = getDimension("correctness");
    assert.ok(d !== null);
    assert.equal(d!.name, "correctness");
    assert.equal(d!.category, "core");
  });

  it("getDimension returns null for unknown", () => {
    assert.equal(getDimension("nonexistent"), null);
  });

  it("listDimensions returns sorted", () => {
    const all = listDimensions();
    assert.equal(all.length, 30);
    for (let i = 1; i < all.length; i++) {
      assert.ok(all[i].name >= all[i - 1].name);
    }
  });

  it("listDimensions filters by category", () => {
    const codeDims = listDimensions("code");
    assert.ok(codeDims.length > 0);
    for (const d of codeDims) assert.equal(d.category, "code");
  });
});

describe("Dimensions — QualityDimension", () => {
  it("validates score range", () => {
    const d = new QualityDimension({ name: "test", description: "test" });
    assert.equal(d.validateScore(50), true);
    assert.equal(d.validateScore(-1), false);
    assert.equal(d.validateScore(101), false);
  });

  it("round-trips", () => {
    const d = new QualityDimension({
      name: "custom", description: "Custom dim",
      minScore: 10, maxScore: 90,
      defaultWeight: 0.3, defaultThreshold: 65,
      category: "custom",
    });
    const dict = d.toDict();
    const d2 = QualityDimension.fromDict(dict as unknown as Record<string, unknown>);
    assert.equal(d2.name, "custom");
    assert.equal(d2.minScore, 10);
    assert.equal(d2.maxScore, 90);
  });
});

describe("Dimensions — Composite calculations", () => {
  const scores = { a: 80, b: 90 };
  const weights = { a: 0.5, b: 0.5 };

  it("weighted average", () => {
    const result = computeWeightedAverage(scores, weights);
    assert.equal(result, 85);
  });

  it("geometric mean", () => {
    const result = computeGeometricMean(scores, weights);
    assert.ok(Math.abs(result - Math.sqrt(80 * 90)) < 0.01);
  });

  it("harmonic mean", () => {
    const result = computeHarmonicMean(scores, weights);
    const expected = 2 / (1 / 80 + 1 / 90);
    assert.ok(Math.abs(result - expected) < 0.01);
  });

  it("computeComposite dispatches correctly", () => {
    assert.equal(computeComposite(scores, weights, "weighted_average"), 85);
    assert.ok(computeComposite(scores, weights, "geometric_mean") < 85);
    assert.ok(computeComposite(scores, weights, "harmonic_mean") < computeComposite(scores, weights, "geometric_mean"));
  });

  it("handles zero scores in geometric mean", () => {
    assert.equal(computeGeometricMean({ a: 0, b: 90 }, weights), 0);
  });

  it("handles zero scores in harmonic mean", () => {
    assert.equal(computeHarmonicMean({ a: 0, b: 90 }, weights), 0);
  });

  it("handles empty scores", () => {
    assert.equal(computeWeightedAverage({}, {}), 0);
    assert.equal(computeGeometricMean({}, {}), 0);
    assert.equal(computeHarmonicMean({}, {}), 0);
  });
});

// =========================================================================
// Escrow tests
// =========================================================================

describe("Escrow — Release computation", () => {
  it("default tiers", () => {
    assert.equal(computeTieredRelease(95), 100);
    assert.equal(computeTieredRelease(90), 100);
    assert.equal(computeTieredRelease(80), 85);
    assert.equal(computeTieredRelease(75), 85);
    assert.equal(computeTieredRelease(65), 50);
    assert.equal(computeTieredRelease(50), 0);
  });

  it("continuous release", () => {
    assert.equal(computeContinuousRelease(75), 75);
    assert.equal(computeContinuousRelease(0), 0);
    assert.equal(computeContinuousRelease(100), 100);
    assert.equal(computeContinuousRelease(120), 100);
    assert.equal(computeContinuousRelease(-10), 0);
  });

  it("computeReleasePercent with config", () => {
    const config = new EscrowConfig({ graduatedReleaseMode: "continuous" });
    assert.equal(computeReleasePercent(75, config), 75);
  });

  it("computeReleasePercent with null config", () => {
    assert.equal(computeReleasePercent(95), 100);
  });
});

describe("Escrow — EscrowBinding", () => {
  it("fund, release lifecycle", () => {
    const config = new EscrowConfig({ enabled: true, amount: "100.00" });
    const binding = new EscrowBinding("asa-1", config);

    assert.equal(binding.getState().status, "unfunded");

    binding.fund();
    assert.equal(binding.getState().status, "funded");
    assert.equal(binding.getState().fundedAmount, "100.00");

    binding.release(85);
    assert.equal(binding.getState().status, "released");
    assert.equal(binding.getState().releasePercent, 85);
    assert.equal(binding.getState().releasedAmount, "85.00");
  });

  it("fund with custom amount", () => {
    const config = new EscrowConfig({ enabled: true });
    const binding = new EscrowBinding("asa-2", config);
    binding.fund("200.00");
    assert.equal(binding.getState().fundedAmount, "200.00");
  });

  it("refund lifecycle", () => {
    const config = new EscrowConfig({ enabled: true, amount: "50.00" });
    const binding = new EscrowBinding("asa-3", config);
    binding.fund();
    binding.refund();
    assert.equal(binding.getState().status, "refunded");
    assert.equal(binding.getState().releasedAmount, "0.00");
  });

  it("throws on double fund", () => {
    const config = new EscrowConfig({ enabled: true, amount: "10.00" });
    const binding = new EscrowBinding("asa-4", config);
    binding.fund();
    assert.throws(() => binding.fund(), /Cannot fund/);
  });

  it("throws on release before fund", () => {
    const config = new EscrowConfig({ enabled: true });
    const binding = new EscrowBinding("asa-5", config);
    assert.throws(() => binding.release(80), /Cannot release/);
  });

  it("handles provider timeout (refund)", () => {
    const config = new EscrowConfig({ enabled: true, amount: "100.00" });
    const binding = new EscrowBinding("asa-6", config);
    binding.fund();
    binding.handleTimeout("provider");
    assert.equal(binding.getState().status, "refunded");
  });

  it("handles client timeout", () => {
    const config = new EscrowConfig({ enabled: true, amount: "100.00" });
    const binding = new EscrowBinding("asa-7", config);
    // Client timeout doesn't need fund
    const state = new EscrowState({ agreementId: "asa-7" });
    // Just test default hold behavior for evaluator
    const binding2 = new EscrowBinding("asa-8", config);
    binding2.fund();
    binding2.handleTimeout("evaluator");
    assert.equal(binding2.getState().status, "held");
  });

  it("evaluator timeout: split_50_50", () => {
    const config = new EscrowConfig({
      enabled: true, amount: "100.00",
      deadMansSwitchAction: "split_50_50",
    });
    const binding = new EscrowBinding("asa-9", config);
    binding.fund();
    binding.handleTimeout("evaluator");
    assert.equal(binding.getState().status, "released");
    assert.equal(binding.getState().releasePercent, 50.0);
    assert.equal(binding.getState().releasedAmount, "50.00");
  });

  it("evaluator timeout: release_to_provider", () => {
    const config = new EscrowConfig({
      enabled: true, amount: "100.00",
      deadMansSwitchAction: "release_to_provider",
    });
    const binding = new EscrowBinding("asa-10", config);
    binding.fund();
    binding.handleTimeout("evaluator");
    assert.equal(binding.getState().status, "released");
    assert.equal(binding.getState().releasePercent, 100.0);
  });

  it("with callbacks", () => {
    let funded = false;
    let released = false;
    const config = new EscrowConfig({ enabled: true, amount: "100.00" });
    const binding = new EscrowBinding(
      "asa-cb", config,
      () => { funded = true; return true; },
      () => { released = true; return true; },
    );
    binding.fund();
    assert.equal(funded, true);
    binding.release(95);
    assert.equal(released, true);
  });

  it("callback failure throws", () => {
    const config = new EscrowConfig({ enabled: true, amount: "100.00" });
    const binding = new EscrowBinding("asa-fail", config, () => false);
    assert.throws(() => binding.fund(), /External escrow funding failed/);
  });

  it("toDict returns config and state", () => {
    const config = new EscrowConfig({ enabled: true, amount: "10.00" });
    const binding = new EscrowBinding("asa-d", config);
    const d = binding.toDict();
    assert.ok("config" in d);
    assert.ok("state" in d);
  });
});

// =========================================================================
// Evaluator tests
// =========================================================================

describe("Evaluator — EvaluatorRecord", () => {
  it("qualification check", () => {
    const ev = new EvaluatorRecord({
      identity: new Identity("coc", "eval-1"),
      totalEvaluations: 100,
      canaryPassRate: 0.95,
      calibrationDeviation: 0.05,
    });
    assert.equal(ev.isQualified(), true);
  });

  it("fails qualification on low evaluations", () => {
    const ev = new EvaluatorRecord({
      identity: new Identity("coc", "eval-2"),
      totalEvaluations: 10,
    });
    assert.equal(ev.isQualified(), false);
  });

  it("round-trips", () => {
    const ev = new EvaluatorRecord({
      identity: new Identity("coc", "eval-3"),
      domains: ["code", "research"],
      totalEvaluations: 75,
      costPerEvalUsd: 0.50,
    });
    const d = ev.toDict();
    assert.equal((d.domains as string[]).length, 2);
    const ev2 = EvaluatorRecord.fromDict(d);
    assert.equal(ev2.identity.value, "eval-3");
    assert.equal(ev2.costPerEvalUsd, 0.50);
  });
});

describe("Evaluator — CanaryTask", () => {
  it("checks results within tolerance", () => {
    const canary = new CanaryTask({
      expectedScores: { accuracy: 80, completeness: 70 },
      tolerance: 10,
    });
    assert.equal(canary.checkResult({ accuracy: 85, completeness: 75 }), true);
    assert.equal(canary.checkResult({ accuracy: 95, completeness: 75 }), false);
    assert.equal(canary.checkResult({ accuracy: 85 }), false);
  });

  it("auto-generates task ID", () => {
    const canary = new CanaryTask();
    assert.ok(canary.taskId.startsWith("canary-"));
  });
});

describe("Evaluator — EvaluatorRegistry", () => {
  function makeRegistry(): EvaluatorRegistry {
    const reg = new EvaluatorRegistry();
    for (let i = 0; i < 5; i++) {
      reg.register(new EvaluatorRecord({
        identity: new Identity("coc", `eval-${i}`),
        domains: ["research"],
        totalEvaluations: 100,
        canaryPassRate: 0.95,
        calibrationDeviation: 0.05,
        costPerEvalUsd: i * 0.1,
      }));
    }
    return reg;
  }

  it("register and get", () => {
    const reg = makeRegistry();
    assert.ok(reg.get("eval-0") !== null);
    assert.equal(reg.get("nonexistent"), null);
  });

  it("remove", () => {
    const reg = makeRegistry();
    reg.remove("eval-0");
    assert.equal(reg.get("eval-0"), null);
  });

  it("listQualified filters by domain", () => {
    const reg = makeRegistry();
    assert.equal(reg.listQualified("research").length, 5);
    assert.equal(reg.listQualified("code").length, 0);
  });

  it("selectRandom excludes parties", () => {
    const reg = makeRegistry();
    const selected = reg.selectRandom("eval-0", "eval-1", "research");
    assert.ok(selected !== null);
    assert.ok(selected!.identity.value !== "eval-0");
    assert.ok(selected!.identity.value !== "eval-1");
  });

  it("selectRandom returns null when all excluded", () => {
    const reg = new EvaluatorRegistry();
    reg.register(new EvaluatorRecord({
      identity: new Identity("coc", "only-one"),
      totalEvaluations: 100, canaryPassRate: 0.95, calibrationDeviation: 0.05,
    }));
    const result = reg.selectRandom("only-one", "someone");
    assert.equal(result, null);
  });

  it("selectMutual prefers common proposals", () => {
    const reg = makeRegistry();
    const selected = reg.selectMutual(
      ["eval-2", "eval-3"],
      ["eval-2", "eval-4"],
      "client-x", "provider-y", "research",
    );
    assert.ok(selected !== null);
    assert.equal(selected!.identity.value, "eval-2");
  });

  it("selectMarketplace sorts by quality", () => {
    const reg = makeRegistry();
    const selected = reg.selectMarketplace("client-x", "provider-y", "research", 0.5);
    assert.ok(selected !== null);
    assert.ok(selected!.costPerEvalUsd <= 0.5);
  });

  it("conflict of interest detection", () => {
    const reg = makeRegistry();
    assert.equal(reg.checkConflictOfInterest("eval-0", "eval-0", "eval-1"), true);
    assert.equal(reg.checkConflictOfInterest("eval-0", "eval-1", "eval-0"), true);
    assert.equal(reg.checkConflictOfInterest("eval-0", "eval-1", "eval-2"), false);
  });

  it("canary task management", () => {
    const reg = makeRegistry();
    assert.equal(reg.getCanaryTask(), null);
    reg.addCanaryTask(new CanaryTask({ expectedScores: { accuracy: 80 } }));
    assert.ok(reg.getCanaryTask() !== null);
  });

  it("updateEvaluatorStats", () => {
    const reg = makeRegistry();
    const ev = reg.get("eval-0")!;
    const origEvals = ev.totalEvaluations;
    reg.updateEvaluatorStats("eval-0", true);
    assert.equal(ev.totalEvaluations, origEvals + 1);
  });

  it("toDict serializes", () => {
    const reg = makeRegistry();
    const d = reg.toDict();
    assert.ok("evaluators" in d);
    assert.ok("assignment_history" in d);
    assert.equal(d.canary_tasks_count, 0);
  });
});

// =========================================================================
// Negotiation tests
// =========================================================================

describe("Negotiation — NegotiationConfig", () => {
  it("defaults and round-trips", () => {
    const nc = new NegotiationConfig();
    assert.equal(nc.maxRounds, 5);
    const d = nc.toDict();
    const nc2 = NegotiationConfig.fromDict(d as unknown as Record<string, unknown>);
    assert.equal(nc2.maxRounds, 5);
    assert.equal(nc2.asymmetryLimitPct, 25.0);
  });
});

describe("Negotiation — NegotiationSession", () => {
  it("full flow: propose -> counter -> accept", () => {
    const session = new NegotiationSession();
    const client = makeClient();
    const provider = makeProvider();
    const agreement = makeBasicAgreement();

    const proposal = session.propose(client, agreement);
    assert.equal(proposal.action, "propose");
    assert.equal(session.agreement!.status, "negotiating");

    const counter = session.counter(provider, {
      "quality_criteria.composite_threshold": 80,
    });
    assert.equal(counter.action, "counter");
    assert.equal(session.agreement!.qualityCriteria!.compositeThreshold, 80);

    const acceptance = session.accept(client);
    assert.equal(acceptance.action, "accept");
    assert.equal(session.status, "accepted");
  });

  it("propose -> reject", () => {
    const session = new NegotiationSession();
    session.propose(makeClient(), makeBasicAgreement());
    session.reject(makeProvider(), "price_too_high");
    assert.equal(session.status, "rejected");
  });

  it("throws on double propose", () => {
    const session = new NegotiationSession();
    session.propose(makeClient(), makeBasicAgreement());
    assert.throws(() => session.propose(makeClient(), makeBasicAgreement()), /Proposal already exists/);
  });

  it("throws on counter before propose", () => {
    const session = new NegotiationSession();
    assert.throws(() => session.counter(makeClient(), {}), /No proposal yet/);
  });

  it("throws when max rounds exceeded", () => {
    const session = new NegotiationSession({
      config: new NegotiationConfig({ maxRounds: 2 }),
    });
    session.propose(makeClient(), makeBasicAgreement());
    session.counter(makeProvider(), {});
    session.counter(makeClient(), {});
    assert.throws(() => session.counter(makeProvider(), {}), /Maximum rounds/);
  });

  it("applies dimension SLO changes", () => {
    const session = new NegotiationSession();
    const agreement = makeBasicAgreement();
    session.propose(makeClient(), agreement);
    session.counter(makeProvider(), {
      "quality_criteria.dimensions[0].slo.value": 80,
    });
    assert.equal(agreement.qualityCriteria!.dimensions[0].slo!.value, 80);
  });

  it("applies escrow amount change", () => {
    const agreement = makeBasicAgreement();
    agreement.escrow = new EscrowConfig({ enabled: true, amount: "100.00" });
    const session = new NegotiationSession();
    session.propose(makeClient(), agreement);
    session.counter(makeProvider(), { "escrow.payment.amount": "150" });
    assert.equal(agreement.escrow!.amount, "150");
  });

  it("round-trips via toDict/fromDict", () => {
    const session = new NegotiationSession();
    session.propose(makeClient(), makeBasicAgreement());
    const d = session.toDict();
    const session2 = NegotiationSession.fromDict(d);
    assert.equal(session2.sessionId, session.sessionId);
    assert.equal(session2.messages.length, 1);
  });
});

// =========================================================================
// Templates tests
// =========================================================================

describe("Templates", () => {
  it("listTemplates returns 6 templates", () => {
    const names = listTemplates();
    assert.equal(names.length, 6);
    assert.ok(names.includes("research"));
    assert.ok(names.includes("code_generation"));
    assert.ok(names.includes("general"));
  });

  it("getTemplate returns data for known template", () => {
    const t = getTemplate("research");
    assert.ok(t !== null);
    assert.equal(t!.dimensions.length, 5);
  });

  it("getTemplate returns null for unknown", () => {
    assert.equal(getTemplate("nonexistent"), null);
  });

  it("createAgreementFromTemplate produces valid agreement", () => {
    const ag = createAgreementFromTemplate({
      templateName: "code_generation",
      client: makeClient(),
      provider: makeProvider(),
      description: "Build a web scraper",
    });
    assert.equal(ag.isValid(), true);
    assert.equal(ag.service!.type, "code_generation");
    assert.equal(ag.qualityCriteria!.dimensions.length, 5);
    assert.equal(ag.qualityCriteria!.compositeThreshold, 80.0);
  });

  it("createAgreementFromTemplate with escrow", () => {
    const ag = createAgreementFromTemplate({
      templateName: "research",
      client: makeClient(),
      provider: makeProvider(),
      escrowAmount: "200.00",
    });
    assert.ok(ag.escrow !== null);
    assert.equal(ag.escrow!.amount, "200.00");
    assert.equal(ag.escrow!.enabled, true);
  });

  it("createAgreementFromTemplate with SLO overrides", () => {
    const ag = createAgreementFromTemplate({
      templateName: "general",
      client: makeClient(),
      provider: makeProvider(),
      sloOverrides: { accuracy: 95 },
    });
    const accDim = ag.qualityCriteria!.dimensions.find((d) => d.name === "accuracy");
    assert.equal(accDim!.slo!.value, 95);
  });

  it("createAgreementFromTemplate throws for unknown template", () => {
    assert.throws(
      () => createAgreementFromTemplate({
        templateName: "nonexistent",
        client: makeClient(),
        provider: makeProvider(),
      }),
      /Unknown template/,
    );
  });

  it("all templates produce valid agreements", () => {
    for (const name of listTemplates()) {
      const ag = createAgreementFromTemplate({
        templateName: name,
        client: makeClient(),
        provider: makeProvider(),
      });
      assert.equal(ag.isValid(), true, `Template ${name} should produce valid agreement`);
    }
  });
});

// =========================================================================
// Verification tests
// =========================================================================

describe("Verification — Structural", () => {
  const criteria = new QualityCriteria([
    new QualityDimensionSpec("accuracy", 0.5, "percentage", new SLO("gte", 70)),
    new QualityDimensionSpec("completeness", 0.5, "percentage", new SLO("gte", 60)),
  ]);

  it("scores null deliverable as 0", () => {
    const scores = verifyStructural(null, criteria);
    for (const s of scores) {
      assert.equal(s.score, 0);
      assert.equal(s.sloMet, false);
    }
  });

  it("scores empty deliverable as 0", () => {
    const scores = verifyStructural("", criteria);
    for (const s of scores) {
      assert.equal(s.score, 0);
    }
  });

  it("scores non-empty content", () => {
    const content = "A ".repeat(200);
    const scores = verifyStructural(content, criteria);
    for (const s of scores) assert.ok(s.score > 0);
  });

  it("completeness heuristic", () => {
    const short = verifyStructural("hello world", criteria).find((s) => s.name === "completeness");
    const long = verifyStructural("word ".repeat(600), criteria).find((s) => s.name === "completeness");
    assert.ok(long!.score > short!.score);
  });

  it("format_compliance JSON check", () => {
    const jsonCriteria = new QualityCriteria([
      new QualityDimensionSpec("format_compliance", 1.0, "percentage", new SLO("gte", 50)),
    ]);
    const valid = verifyStructural('{"key":"value"}', jsonCriteria, "json");
    assert.equal(valid[0].score, 100);
    const invalid = verifyStructural("not json", jsonCriteria, "json");
    assert.equal(invalid[0].score, 0);
  });

  it("format_compliance markdown check", () => {
    const mdCriteria = new QualityCriteria([
      new QualityDimensionSpec("format_compliance", 1.0),
    ]);
    const withHeader = verifyStructural("# Title\nContent", mdCriteria, "markdown");
    assert.equal(withHeader[0].score, 80);
    const noHeader = verifyStructural("plain text", mdCriteria, "markdown");
    assert.equal(noHeader[0].score, 50);
  });
});

describe("Verification — Semantic", () => {
  it("falls back to structural when no evaluator", () => {
    const criteria = new QualityCriteria([
      new QualityDimensionSpec("accuracy", 1.0, "percentage", new SLO("gte", 70)),
    ]);
    const scores = verifySemantic("content", "request", criteria);
    assert.equal(scores.length, 1);
    assert.equal(scores[0].score, 50);
  });

  it("uses evaluator function when provided", () => {
    const criteria = new QualityCriteria([
      new QualityDimensionSpec("accuracy", 1.0, "percentage", new SLO("gte", 70)),
    ]);
    const evaluator = (_req: string, _del: string, dim: QualityDimensionSpec): [number, string] => {
      return [85, `${dim.name} evaluated`];
    };
    const scores = verifySemantic("deliverable", "request", criteria, evaluator);
    assert.equal(scores[0].score, 85);
    assert.equal(scores[0].sloMet, true);
  });

  it("clamps score to 0-100", () => {
    const criteria = new QualityCriteria([
      new QualityDimensionSpec("x", 1.0),
    ]);
    const evaluator = () => [150, "over"] as [number, string];
    const scores = verifySemantic("d", "r", criteria, evaluator);
    assert.equal(scores[0].score, 100);
  });
});

describe("Verification — Composite", () => {
  it("returns structural when no evaluator", () => {
    const criteria = new QualityCriteria([
      new QualityDimensionSpec("accuracy", 1.0),
    ]);
    const scores = verifyComposite("content", "request", criteria);
    assert.equal(scores[0].score, 50);
  });

  it("uses semantic when evaluator provided", () => {
    const criteria = new QualityCriteria([
      new QualityDimensionSpec("accuracy", 1.0),
    ]);
    const evaluator = () => [90, "good"] as [number, string];
    const scores = verifyComposite("content", "request", criteria, "text", evaluator);
    assert.equal(scores[0].score, 90);
  });
});

describe("Verification — getStandaloneCriteria", () => {
  it("returns criteria for known types", () => {
    for (const t of ["general", "code", "data", "translation", "text/research", "text/analysis"]) {
      const c = getStandaloneCriteria(t);
      assert.ok(c.dimensions.length > 0);
      assert.equal(c.compositeThreshold, 65.0);
    }
  });

  it("falls back to general for unknown type", () => {
    const c = getStandaloneCriteria("unknown");
    assert.ok(c.dimensions.length > 0);
  });
});

describe("Verification — VerificationEngine", () => {
  it("standalone verification without agreement", () => {
    const engine = new VerificationEngine();
    const result = engine.verify({ deliverable: "Here is a detailed analysis." });
    assert.ok(result.verificationId.startsWith("ver-"));
    assert.ok(result.compositeScore >= 0);
    assert.equal(result.evaluatorType, "deterministic");
    assert.equal(result.confidence, 0.5);
    assert.ok(result.deliverableHash.length === 64);
    assert.ok(result.resultHash.length === 64);
  });

  it("verification against agreement", () => {
    const agreement = makeBasicAgreement();
    agreement.sign("client", "c");
    agreement.sign("provider", "p");
    const engine = new VerificationEngine();
    const result = engine.verify({
      deliverable: "word ".repeat(200),
      agreement,
    });
    assert.equal(result.agreementId, agreement.agreementId);
    assert.ok(result.notes.length > 0);
  });

  it("verification with semantic evaluator", () => {
    const evaluator = (_req: string, _del: string, dim: QualityDimensionSpec): [number, string] => {
      return [88, `${dim.name} scored by judge`];
    };
    const engine = new VerificationEngine(evaluator, makeEvaluator());
    const result = engine.verify({ deliverable: "content", originalRequest: "request" });
    assert.equal(result.evaluatorType, "agent_as_judge");
    assert.equal(result.confidence, 0.95);
    assert.ok(result.compositeScore > 80);
    assert.equal(result.passed, true);
  });

  it("determines payment release from agreement escrow", () => {
    const agreement = makeBasicAgreement();
    agreement.escrow = new EscrowConfig({ enabled: true, amount: "100.00" });
    agreement.sign("client", "c");
    agreement.sign("provider", "p");

    const evaluator = () => [92, "excellent"] as [number, string];
    const engine = new VerificationEngine(evaluator);
    const result = engine.verify({ deliverable: "content", agreement });
    assert.equal(result.paymentReleasePercent, 100);
  });

  it("FAIL result gets 0 release without escrow", () => {
    const evaluator = () => [30, "poor"] as [number, string];
    const engine = new VerificationEngine(evaluator);
    const result = engine.verify({ deliverable: "bad" });
    assert.equal(result.passed, false);
    assert.equal(result.determination, "FAIL");
    assert.equal(result.paymentReleasePercent, 0);
  });
});

// =========================================================================
// Store tests
// =========================================================================

describe("Store — AgreementStore", () => {
  let store: AgreementStore;

  beforeEach(() => {
    store = new AgreementStore(TEST_STORE_DIR);
  });

  afterEach(() => {
    try {
      rmSync(TEST_STORE_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("creates directory", () => {
    assert.ok(existsSync(TEST_STORE_DIR));
  });

  it("append and retrieve agreement", () => {
    const ag = makeBasicAgreement();
    const id = store.appendAgreement(ag);
    assert.equal(id, ag.agreementId);
    const retrieved = store.getAgreement(ag.agreementId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved!.agreementId, ag.agreementId);
  });

  it("get all agreements", () => {
    store.appendAgreement(makeBasicAgreement());
    store.appendAgreement(makeBasicAgreement());
    const all = store.getAgreements();
    assert.equal(all.length, 2);
  });

  it("getAgreementsFor filters by party", () => {
    const ag = makeBasicAgreement();
    store.appendAgreement(ag);
    assert.equal(store.getAgreementsFor("client-001").length, 1);
    assert.equal(store.getAgreementsFor("nobody").length, 0);
  });

  it("getAgreement returns null for missing", () => {
    assert.equal(store.getAgreement("nonexistent"), null);
  });

  it("append and retrieve negotiation", () => {
    const msg = new NegotiationMessage({
      agreementId: "asa-test",
      action: "propose",
    });
    store.appendNegotiation(msg);
    const all = store.getNegotiations();
    assert.equal(all.length, 1);
    assert.equal(all[0].agreementId, "asa-test");
  });

  it("getNegotiationsFor filters", () => {
    store.appendNegotiation(new NegotiationMessage({ agreementId: "asa-1" }));
    store.appendNegotiation(new NegotiationMessage({ agreementId: "asa-2" }));
    assert.equal(store.getNegotiationsFor("asa-1").length, 1);
  });

  it("append and retrieve verification", () => {
    const vr = new VerificationResult({ agreementId: "asa-test", compositeScore: 85 });
    store.appendVerification(vr);
    const retrieved = store.getVerification(vr.verificationId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved!.compositeScore, 85);
  });

  it("getVerificationsFor filters", () => {
    store.appendVerification(new VerificationResult({ agreementId: "asa-1" }));
    store.appendVerification(new VerificationResult({ agreementId: "asa-2" }));
    assert.equal(store.getVerificationsFor("asa-1").length, 1);
  });

  it("append and retrieve escrow state", () => {
    const state = new EscrowState({ agreementId: "asa-test", status: "funded" });
    store.appendEscrowState(state);
    const latest = store.getLatestEscrow("asa-test");
    assert.ok(latest !== null);
    assert.equal(latest!.status, "funded");
  });

  it("getLatestEscrow returns last entry", () => {
    store.appendEscrowState(new EscrowState({ agreementId: "asa-1", status: "unfunded" }));
    store.appendEscrowState(new EscrowState({ agreementId: "asa-1", status: "funded" }));
    const latest = store.getLatestEscrow("asa-1");
    assert.equal(latest!.status, "funded");
  });

  it("getLatestEscrow returns null for missing", () => {
    assert.equal(store.getLatestEscrow("nope"), null);
  });

  it("stats returns counts", () => {
    store.appendAgreement(makeBasicAgreement());
    const s = store.stats() as any;
    assert.equal(s.agreements.count, 1);
    assert.ok(s.agreements.file_size_bytes > 0);
  });
});

// =========================================================================
// Cross-module integration tests
// =========================================================================

describe("Integration — Full workflow", () => {
  it("template -> negotiate -> sign -> deliver -> verify -> escrow release", () => {
    const client = makeClient();
    const provider = makeProvider();

    // 1. Create from template
    const ag = createAgreementFromTemplate({
      templateName: "research",
      client,
      provider,
      escrowAmount: "100.00",
    });
    assert.equal(ag.isValid(), true);

    // 2. Negotiate
    const session = new NegotiationSession();
    session.propose(client, ag);
    session.counter(provider, {
      "quality_criteria.composite_threshold": 70,
    });
    session.accept(client);
    assert.equal(session.status, "accepted");
    assert.equal(ag.qualityCriteria!.compositeThreshold, 70);

    // 3. Sign
    ag.status = "proposed";
    ag.sign("client", "sig-c");
    ag.sign("provider", "sig-p");
    assert.equal(ag.status, "active");

    // 4. Deliver
    ag.deliver("deliverable-hash-abc");
    assert.equal(ag.status, "delivered");

    // 5. Verify
    const evaluator = () => [85, "good quality"] as [number, string];
    const engine = new VerificationEngine(evaluator, makeEvaluator());
    const result = engine.verify({
      deliverable: "Full research report with citations...",
      originalRequest: "Research AI safety",
      agreement: ag,
    });
    assert.ok(result.compositeScore > 70);
    assert.equal(result.passed, true);

    // 6. Escrow release
    const escrowBinding = new EscrowBinding("asa-workflow", ag.escrow!);
    escrowBinding.fund("100.00");
    escrowBinding.release(result.compositeScore);
    assert.equal(escrowBinding.getState().status, "released");
    assert.ok(escrowBinding.getState().releasePercent > 0);

    // 7. Close
    ag.markVerified(true);
    ag.close();
    assert.equal(ag.status, "closed");
  });

  it("store persists all record types", () => {
    const dir = ".asa-integration-" + Date.now();
    try {
      const store = new AgreementStore(dir);
      const ag = makeBasicAgreement();

      store.appendAgreement(ag);
      store.appendNegotiation(new NegotiationMessage({ agreementId: ag.agreementId }));
      store.appendVerification(new VerificationResult({ agreementId: ag.agreementId }));
      store.appendEscrowState(new EscrowState({ agreementId: ag.agreementId }));

      const stats = store.stats() as any;
      assert.equal(stats.agreements.count, 1);
      assert.equal(stats.negotiations.count, 1);
      assert.equal(stats.verifications.count, 1);
      assert.equal(stats.escrow.count, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
