import { createHash } from "node:crypto";
import {
  DimensionScore,
  Identity,
  QualityCriteria,
  QualityDimensionSpec,
  SLO,
  VerificationResult,
} from "./schema";
import { computeComposite } from "./dimensions";
import { Agreement } from "./agreement";
import { computeReleasePercent } from "./escrow";

// ---------------------------------------------------------------------------
// Standalone defaults
// ---------------------------------------------------------------------------

interface StandaloneDimDef {
  name: string;
  weight: number;
  slo: { operator: string; value: number };
}

const STANDALONE_DEFAULTS: Record<string, StandaloneDimDef[]> = {
  "text/research": [
    { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 70 } },
    { name: "completeness", weight: 0.20, slo: { operator: "gte", value: 60 } },
    { name: "relevance", weight: 0.20, slo: { operator: "gte", value: 70 } },
    { name: "source_quality", weight: 0.15, slo: { operator: "gte", value: 50 } },
    { name: "writing_quality", weight: 0.20, slo: { operator: "gte", value: 60 } },
  ],
  "text/analysis": [
    { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 70 } },
    { name: "methodology", weight: 0.20, slo: { operator: "gte", value: 60 } },
    { name: "depth", weight: 0.20, slo: { operator: "gte", value: 60 } },
    { name: "clarity", weight: 0.15, slo: { operator: "gte", value: 60 } },
    { name: "actionability", weight: 0.20, slo: { operator: "gte", value: 60 } },
  ],
  code: [
    { name: "correctness", weight: 0.30, slo: { operator: "gte", value: 80 } },
    { name: "performance", weight: 0.20, slo: { operator: "gte", value: 60 } },
    { name: "security", weight: 0.20, slo: { operator: "gte", value: 70 } },
    { name: "maintainability", weight: 0.15, slo: { operator: "gte", value: 60 } },
    { name: "documentation", weight: 0.15, slo: { operator: "gte", value: 50 } },
  ],
  data: [
    { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 70 } },
    { name: "completeness", weight: 0.25, slo: { operator: "gte", value: 60 } },
    { name: "consistency", weight: 0.20, slo: { operator: "gte", value: 60 } },
    { name: "format_compliance", weight: 0.15, slo: { operator: "gte", value: 70 } },
    { name: "metadata", weight: 0.15, slo: { operator: "gte", value: 50 } },
  ],
  translation: [
    { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 80 } },
    { name: "fluency", weight: 0.25, slo: { operator: "gte", value: 70 } },
    { name: "terminology", weight: 0.20, slo: { operator: "gte", value: 60 } },
    { name: "cultural_fit", weight: 0.15, slo: { operator: "gte", value: 60 } },
    { name: "completeness", weight: 0.15, slo: { operator: "gte", value: 80 } },
  ],
  general: [
    { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 70 } },
    { name: "completeness", weight: 0.20, slo: { operator: "gte", value: 60 } },
    { name: "relevance", weight: 0.20, slo: { operator: "gte", value: 70 } },
    { name: "clarity", weight: 0.20, slo: { operator: "gte", value: 60 } },
    { name: "timeliness", weight: 0.15, slo: { operator: "gte", value: 60 } },
  ],
};

export function getStandaloneCriteria(deliverableType = "general"): QualityCriteria {
  const dimsData = STANDALONE_DEFAULTS[deliverableType] || STANDALONE_DEFAULTS.general;
  const dims = dimsData.map(
    (dd) => new QualityDimensionSpec(dd.name, dd.weight, "percentage", SLO.fromDict(dd.slo)),
  );
  return new QualityCriteria(dims, 65.0);
}

// ---------------------------------------------------------------------------
// Structural verification
// ---------------------------------------------------------------------------

export function verifyStructural(
  deliverable: unknown,
  criteria: QualityCriteria,
  expectedFormat = "text",
): DimensionScore[] {
  const scores: DimensionScore[] = [];

  if (deliverable === null || deliverable === undefined) {
    for (const dim of criteria.dimensions) {
      scores.push(new DimensionScore({
        name: dim.name,
        score: 0,
        sloTarget: dim.slo?.value ?? null,
        sloMet: false,
        evidence: "Deliverable is None",
      }));
    }
    return scores;
  }

  const content = String(deliverable);
  const isEmpty = content.trim().length === 0;

  for (const dim of criteria.dimensions) {
    let score: number;
    let evidence: string;
    let sloMet: boolean | null;

    if (isEmpty) {
      score = 0;
      evidence = "Deliverable is empty";
      sloMet = false;
    } else if (dim.name === "format_compliance") {
      if (expectedFormat === "json") {
        try {
          JSON.parse(content);
          score = 100.0;
          evidence = "Valid JSON";
        } catch (e) {
          score = 0.0;
          evidence = `Invalid JSON: ${(e as Error).message}`;
        }
      } else if (expectedFormat === "markdown") {
        const hasHeaders = content.includes("#");
        score = hasHeaders ? 80.0 : 50.0;
        evidence = hasHeaders ? "Markdown structure detected" : "Plain text (no markdown headers)";
      } else {
        score = 70.0;
        evidence = "Format check: content present";
      }
      sloMet = dim.slo ? dim.slo.evaluate(score) : true;
    } else if (dim.name === "completeness") {
      const wordCount = content.split(/\s+/).length;
      if (wordCount > 500) score = 80.0;
      else if (wordCount > 100) score = 60.0;
      else if (wordCount > 20) score = 40.0;
      else score = 20.0;
      evidence = `Word count: ${wordCount}`;
      sloMet = dim.slo ? dim.slo.evaluate(score) : true;
    } else {
      score = 50.0;
      evidence = "Structural check only — content present but quality not assessed";
      sloMet = dim.slo ? dim.slo.evaluate(score) : null;
    }

    scores.push(new DimensionScore({
      name: dim.name,
      score,
      sloTarget: dim.slo?.value ?? null,
      sloMet,
      evidence,
    }));
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Semantic verification
// ---------------------------------------------------------------------------

export type SemanticEvaluator = (
  originalRequest: string,
  deliverable: string,
  dimension: QualityDimensionSpec,
) => [number, string];

export function verifySemantic(
  deliverable: string,
  originalRequest: string,
  criteria: QualityCriteria,
  evaluatorFn?: SemanticEvaluator | null,
): DimensionScore[] {
  if (!evaluatorFn) return verifyStructural(deliverable, criteria);

  const scores: DimensionScore[] = [];
  for (const dim of criteria.dimensions) {
    let [score, evidence] = evaluatorFn(originalRequest, deliverable, dim);
    score = Math.max(0, Math.min(100, score));
    const sloMet = dim.slo ? dim.slo.evaluate(score) : null;

    scores.push(new DimensionScore({
      name: dim.name,
      score,
      sloTarget: dim.slo?.value ?? null,
      sloMet,
      evidence,
    }));
  }
  return scores;
}

// ---------------------------------------------------------------------------
// Composite verification
// ---------------------------------------------------------------------------

export function verifyComposite(
  deliverable: string,
  originalRequest: string,
  criteria: QualityCriteria,
  expectedFormat = "text",
  evaluatorFn?: SemanticEvaluator | null,
): DimensionScore[] {
  const structural = verifyStructural(deliverable, criteria, expectedFormat);

  if (!evaluatorFn) return structural;

  return verifySemantic(deliverable, originalRequest, criteria, evaluatorFn);
}

// ---------------------------------------------------------------------------
// VerificationEngine
// ---------------------------------------------------------------------------

export class VerificationEngine {
  private _evaluatorFn: SemanticEvaluator | null;
  private _evaluatorIdentity: Identity | null;

  constructor(
    evaluatorFn?: SemanticEvaluator | null,
    evaluatorIdentity?: Identity | null,
  ) {
    this._evaluatorFn = evaluatorFn ?? null;
    this._evaluatorIdentity = evaluatorIdentity ?? null;
  }

  verify(opts: {
    deliverable: string;
    originalRequest?: string;
    agreement?: Agreement | null;
    deliverableType?: string;
    qualityCriteria?: QualityCriteria | null;
    expectedFormat?: string;
  }): VerificationResult {
    const startMs = performance.now();

    let criteria: QualityCriteria;
    let agreementId = "";
    let depth = this._evaluatorFn ? "semantic" : "structural";
    let expectedFormat = opts.expectedFormat || "text";

    if (opts.agreement?.qualityCriteria) {
      criteria = opts.agreement.qualityCriteria;
      agreementId = opts.agreement.agreementId;
      if (opts.agreement.verification) {
        depth = opts.agreement.verification.depth;
      }
      if (opts.agreement.service) {
        expectedFormat = opts.agreement.service.deliverableFormat;
      }
    } else if (opts.qualityCriteria) {
      criteria = opts.qualityCriteria;
    } else {
      criteria = getStandaloneCriteria(opts.deliverableType || "general");
    }

    let dimScores: DimensionScore[];
    const originalRequest = opts.originalRequest || "";

    if (depth === "composite") {
      dimScores = verifyComposite(
        opts.deliverable, originalRequest, criteria, expectedFormat, this._evaluatorFn,
      );
    } else if (depth === "semantic") {
      dimScores = verifySemantic(
        opts.deliverable, originalRequest, criteria, this._evaluatorFn,
      );
    } else {
      dimScores = verifyStructural(opts.deliverable, criteria, expectedFormat);
    }

    const scoreMap: Record<string, number> = {};
    const weightMap: Record<string, number> = {};
    for (const s of dimScores) scoreMap[s.name] = s.score;
    for (const d of criteria.dimensions) weightMap[d.name] = d.weight;

    const composite = computeComposite(scoreMap, weightMap, criteria.compositeMethod);
    const passed = composite >= criteria.compositeThreshold;

    const allSlosMet = dimScores
      .filter((s) => s.sloMet !== null)
      .every((s) => s.sloMet);

    const elapsedMs = Math.round(performance.now() - startMs);

    let releasePct = 0;
    if (opts.agreement?.escrow) {
      releasePct = computeReleasePercent(composite, opts.agreement.escrow);
    } else if (passed) {
      releasePct = 100.0;
    }

    const dHash = createHash("sha256").update(opts.deliverable, "utf-8").digest("hex");

    const result = new VerificationResult({
      agreementId,
      evaluatorIdentity: this._evaluatorIdentity,
      evaluatorType: this._evaluatorFn ? "agent_as_judge" : "deterministic",
      dimensions: dimScores,
      compositeScore: Math.round(composite * 100) / 100,
      compositeMethod: criteria.compositeMethod,
      compositeThreshold: criteria.compositeThreshold,
      passed,
      determination: passed ? "PASS" : "FAIL",
      paymentReleasePercent: releasePct,
      confidence: this._evaluatorFn ? 0.95 : 0.5,
      notes: this._buildNotes(composite, criteria.compositeThreshold, allSlosMet),
      deliverableHash: dHash,
      evaluationDurationMs: elapsedMs,
    });

    result.computeHash();
    return result;
  }

  private _buildNotes(score: number, threshold: number, allSlosMet: boolean): string {
    const parts: string[] = [];
    if (score >= threshold) {
      parts.push(`Composite ${score.toFixed(1)} meets threshold ${threshold}`);
    } else {
      parts.push(`Composite ${score.toFixed(1)} below threshold ${threshold}`);
    }
    if (!allSlosMet) parts.push("Some individual SLOs not met");
    return parts.join(". ") + ".";
  }
}
