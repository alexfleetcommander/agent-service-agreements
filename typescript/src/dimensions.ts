export interface QualityDimensionDef {
  name: string;
  description: string;
  minScore: number;
  maxScore: number;
  defaultWeight: number;
  defaultThreshold: number;
  category: string;
}

export class QualityDimension {
  name: string;
  description: string;
  minScore: number;
  maxScore: number;
  defaultWeight: number;
  defaultThreshold: number;
  category: string;

  constructor(opts: {
    name: string;
    description: string;
    minScore?: number;
    maxScore?: number;
    defaultWeight?: number;
    defaultThreshold?: number;
    category?: string;
  }) {
    this.name = opts.name;
    this.description = opts.description;
    this.minScore = opts.minScore ?? 0.0;
    this.maxScore = opts.maxScore ?? 100.0;
    this.defaultWeight = opts.defaultWeight ?? 0.20;
    this.defaultThreshold = opts.defaultThreshold ?? 60.0;
    this.category = opts.category || "general";
  }

  validateScore(score: number): boolean {
    return score >= this.minScore && score <= this.maxScore;
  }

  toDict(): QualityDimensionDef {
    return {
      name: this.name,
      description: this.description,
      minScore: this.minScore,
      maxScore: this.maxScore,
      defaultWeight: this.defaultWeight,
      defaultThreshold: this.defaultThreshold,
      category: this.category,
    };
  }

  static fromDict(d: Record<string, unknown>): QualityDimension {
    return new QualityDimension({
      name: d.name as string,
      description: (d.description as string) || "",
      minScore: (d.minScore as number) ?? (d.min_score as number) ?? 0.0,
      maxScore: (d.maxScore as number) ?? (d.max_score as number) ?? 100.0,
      defaultWeight: (d.defaultWeight as number) ?? (d.default_weight as number) ?? 0.20,
      defaultThreshold: (d.defaultThreshold as number) ?? (d.default_threshold as number) ?? 60.0,
      category: (d.category as string) || "general",
    });
  }
}

// ---------------------------------------------------------------------------
// Standard dimensions
// ---------------------------------------------------------------------------

const CORRECTNESS = new QualityDimension({
  name: "correctness",
  description: "Factual accuracy and technical correctness of the deliverable",
  defaultWeight: 0.25, defaultThreshold: 70.0, category: "core",
});
const COMPLETENESS = new QualityDimension({
  name: "completeness",
  description: "Coverage of all required aspects, sections, and requirements",
  defaultWeight: 0.20, defaultThreshold: 60.0, category: "core",
});
const COHERENCE = new QualityDimension({
  name: "coherence",
  description: "Logical consistency, clear structure, and readability",
  defaultWeight: 0.15, defaultThreshold: 60.0, category: "core",
});
const CITATION_QUALITY = new QualityDimension({
  name: "citation_quality",
  description: "Quality, relevance, and verifiability of cited sources",
  defaultWeight: 0.15, defaultThreshold: 50.0, category: "research",
});
const FORMATTING = new QualityDimension({
  name: "formatting",
  description: "Adherence to format requirements, markup quality, visual presentation",
  defaultWeight: 0.10, defaultThreshold: 50.0, category: "presentation",
});
const ACCURACY = new QualityDimension({
  name: "accuracy",
  description: "Precision and correctness of facts, data, and claims",
  defaultWeight: 0.25, defaultThreshold: 70.0, category: "core",
});
const RELEVANCE = new QualityDimension({
  name: "relevance",
  description: "How well the output addresses the original request",
  defaultWeight: 0.20, defaultThreshold: 70.0, category: "core",
});
const SOURCE_QUALITY = new QualityDimension({
  name: "source_quality",
  description: "Quality, diversity, and recency of referenced sources",
  defaultWeight: 0.15, defaultThreshold: 50.0, category: "research",
});
const WRITING_QUALITY = new QualityDimension({
  name: "writing_quality",
  description: "Clarity, conciseness, grammar, and style",
  defaultWeight: 0.10, defaultThreshold: 60.0, category: "presentation",
});
const TIMELINESS = new QualityDimension({
  name: "timeliness",
  description: "Whether the deliverable was submitted within the deadline",
  defaultWeight: 0.10, defaultThreshold: 100.0, category: "operational",
});
const PERFORMANCE = new QualityDimension({
  name: "performance",
  description: "Runtime efficiency, response time, resource usage",
  defaultWeight: 0.20, defaultThreshold: 60.0, category: "code",
});
const SECURITY = new QualityDimension({
  name: "security",
  description: "Absence of vulnerabilities, proper input validation, secure patterns",
  defaultWeight: 0.20, defaultThreshold: 70.0, category: "code",
});
const MAINTAINABILITY = new QualityDimension({
  name: "maintainability",
  description: "Code readability, modularity, documentation, test coverage",
  defaultWeight: 0.15, defaultThreshold: 60.0, category: "code",
});
const TEST_COVERAGE = new QualityDimension({
  name: "test_coverage",
  description: "Percentage of code paths covered by tests",
  defaultWeight: 0.15, defaultThreshold: 60.0, category: "code",
});
const METHODOLOGY = new QualityDimension({
  name: "methodology",
  description: "Soundness of analytical approach and statistical methods",
  defaultWeight: 0.20, defaultThreshold: 60.0, category: "analysis",
});
const INSIGHT_QUALITY = new QualityDimension({
  name: "insight_quality",
  description: "Depth, novelty, and actionability of insights",
  defaultWeight: 0.15, defaultThreshold: 50.0, category: "analysis",
});
const FLUENCY = new QualityDimension({
  name: "fluency",
  description: "Natural language flow in the target language",
  defaultWeight: 0.25, defaultThreshold: 70.0, category: "translation",
});
const CULTURAL_APPROPRIATENESS = new QualityDimension({
  name: "cultural_appropriateness",
  description: "Cultural sensitivity and locale-appropriate adaptation",
  defaultWeight: 0.15, defaultThreshold: 60.0, category: "translation",
});
const TERMINOLOGY = new QualityDimension({
  name: "terminology",
  description: "Consistent and correct use of domain terminology",
  defaultWeight: 0.20, defaultThreshold: 60.0, category: "translation",
});
const THOROUGHNESS = new QualityDimension({
  name: "thoroughness",
  description: "Depth and breadth of review coverage",
  defaultWeight: 0.25, defaultThreshold: 60.0, category: "review",
});
const ACTIONABILITY = new QualityDimension({
  name: "actionability",
  description: "How clear and implementable the recommendations are",
  defaultWeight: 0.20, defaultThreshold: 60.0, category: "review",
});
const TONE = new QualityDimension({
  name: "tone",
  description: "Constructiveness and professionalism of feedback",
  defaultWeight: 0.10, defaultThreshold: 60.0, category: "review",
});
const CLARITY = new QualityDimension({
  name: "clarity",
  description: "How easily the content can be understood by the target audience",
  defaultWeight: 0.20, defaultThreshold: 60.0, category: "general",
});
const VISUALIZATION = new QualityDimension({
  name: "visualization",
  description: "Quality and clarity of charts, graphs, and visual elements",
  defaultWeight: 0.15, defaultThreshold: 50.0, category: "analysis",
});
const DEPTH = new QualityDimension({
  name: "depth",
  description: "Level of detail and analytical depth",
  defaultWeight: 0.20, defaultThreshold: 60.0, category: "analysis",
});
const DOCUMENTATION = new QualityDimension({
  name: "documentation",
  description: "Quality and completeness of code documentation",
  defaultWeight: 0.15, defaultThreshold: 50.0, category: "code",
});
const FORMAT_COMPLIANCE = new QualityDimension({
  name: "format_compliance",
  description: "Adherence to specified data format and schema",
  defaultWeight: 0.15, defaultThreshold: 70.0, category: "data",
});
const CONSISTENCY = new QualityDimension({
  name: "consistency",
  description: "Internal consistency of data values and relationships",
  defaultWeight: 0.20, defaultThreshold: 60.0, category: "data",
});
const METADATA = new QualityDimension({
  name: "metadata",
  description: "Completeness and accuracy of metadata/documentation",
  defaultWeight: 0.15, defaultThreshold: 50.0, category: "data",
});
const CULTURAL_FIT = new QualityDimension({
  name: "cultural_fit",
  description: "Appropriateness for target culture and locale",
  defaultWeight: 0.15, defaultThreshold: 60.0, category: "translation",
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ALL_DIMENSIONS: QualityDimension[] = [
  CORRECTNESS, COMPLETENESS, COHERENCE, CITATION_QUALITY, FORMATTING,
  ACCURACY, RELEVANCE, SOURCE_QUALITY, WRITING_QUALITY, TIMELINESS,
  PERFORMANCE, SECURITY, MAINTAINABILITY, TEST_COVERAGE,
  METHODOLOGY, INSIGHT_QUALITY, VISUALIZATION, DEPTH,
  FLUENCY, CULTURAL_APPROPRIATENESS, TERMINOLOGY, CULTURAL_FIT,
  THOROUGHNESS, ACTIONABILITY, TONE,
  CLARITY, DOCUMENTATION, FORMAT_COMPLIANCE, CONSISTENCY, METADATA,
];

export const DIMENSION_REGISTRY: Map<string, QualityDimension> = new Map(
  ALL_DIMENSIONS.map((d) => [d.name, d]),
);

export function getDimension(name: string): QualityDimension | null {
  return DIMENSION_REGISTRY.get(name) ?? null;
}

export function listDimensions(category?: string): QualityDimension[] {
  let dims = Array.from(DIMENSION_REGISTRY.values());
  if (category) {
    dims = dims.filter((d) => d.category === category);
  }
  return dims.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Composite score computation
// ---------------------------------------------------------------------------

export function computeWeightedAverage(
  scores: Record<string, number>,
  weights: Record<string, number>,
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [name, score] of Object.entries(scores)) {
    const w = weights[name] ?? 0;
    weightedSum += score * w;
    totalWeight += w;
  }
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}

export function computeGeometricMean(
  scores: Record<string, number>,
  weights: Record<string, number>,
): number {
  let totalWeight = 0;
  let logSum = 0;
  for (const [name, score] of Object.entries(scores)) {
    const w = weights[name] ?? 0;
    if (w <= 0) continue;
    if (score <= 0) return 0;
    logSum += w * Math.log(score);
    totalWeight += w;
  }
  return totalWeight === 0 ? 0 : Math.exp(logSum / totalWeight);
}

export function computeHarmonicMean(
  scores: Record<string, number>,
  weights: Record<string, number>,
): number {
  let totalWeight = 0;
  let reciprocalSum = 0;
  for (const [name, score] of Object.entries(scores)) {
    const w = weights[name] ?? 0;
    if (w <= 0) continue;
    if (score <= 0) return 0;
    reciprocalSum += w / score;
    totalWeight += w;
  }
  if (totalWeight === 0 || reciprocalSum === 0) return 0;
  return totalWeight / reciprocalSum;
}

export function computeComposite(
  scores: Record<string, number>,
  weights: Record<string, number>,
  method = "weighted_average",
): number {
  if (method === "geometric_mean") return computeGeometricMean(scores, weights);
  if (method === "harmonic_mean") return computeHarmonicMean(scores, weights);
  return computeWeightedAverage(scores, weights);
}
