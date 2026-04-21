import {
  DEFAULT_GRADUATED_TIERS,
  EscrowConfig,
  GraduatedTier,
  Identity,
  QualityCriteria,
  QualityDimensionSpec,
  SLO,
  ServiceSpec,
  VerificationConfig,
} from "./schema";
import { Agreement } from "./agreement";

interface TemplateDimension {
  name: string;
  weight: number;
  metric?: string;
  slo?: { operator: string; value: unknown };
}

interface TemplateData {
  description: string;
  deliverable_format: string;
  dimensions: TemplateDimension[];
  composite_threshold: number;
  verification_depth: string;
}

export const TEMPLATES: Record<string, TemplateData> = {
  research: {
    description: "Research synthesis, literature review, or knowledge compilation",
    deliverable_format: "markdown",
    dimensions: [
      { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 85 } },
      { name: "completeness", weight: 0.20, slo: { operator: "gte", value: 80 } },
      { name: "relevance", weight: 0.20, slo: { operator: "gte", value: 90 } },
      { name: "source_quality", weight: 0.15, slo: { operator: "gte", value: 70 } },
      { name: "writing_quality", weight: 0.20, slo: { operator: "gte", value: 75 } },
    ],
    composite_threshold: 75.0,
    verification_depth: "semantic",
  },
  code_generation: {
    description: "Software development, code generation, or tool building",
    deliverable_format: "code",
    dimensions: [
      { name: "correctness", weight: 0.30, slo: { operator: "gte", value: 95 } },
      { name: "performance", weight: 0.20, slo: { operator: "gte", value: 70 } },
      { name: "security", weight: 0.20, slo: { operator: "gte", value: 80 } },
      { name: "maintainability", weight: 0.15, slo: { operator: "gte", value: 70 } },
      { name: "test_coverage", weight: 0.15, slo: { operator: "gte", value: 60 } },
    ],
    composite_threshold: 80.0,
    verification_depth: "composite",
  },
  data_analysis: {
    description: "Data analysis, statistical modeling, or insight generation",
    deliverable_format: "markdown",
    dimensions: [
      { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 90 } },
      { name: "methodology", weight: 0.20, slo: { operator: "gte", value: 75 } },
      { name: "depth", weight: 0.20, slo: { operator: "gte", value: 70 } },
      { name: "clarity", weight: 0.15, slo: { operator: "gte", value: 75 } },
      { name: "actionability", weight: 0.20, slo: { operator: "gte", value: 70 } },
    ],
    composite_threshold: 75.0,
    verification_depth: "composite",
  },
  translation: {
    description: "Language translation with cultural adaptation",
    deliverable_format: "text",
    dimensions: [
      { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 90 } },
      { name: "fluency", weight: 0.25, slo: { operator: "gte", value: 85 } },
      { name: "cultural_fit", weight: 0.15, slo: { operator: "gte", value: 70 } },
      { name: "terminology", weight: 0.20, slo: { operator: "gte", value: 80 } },
      { name: "completeness", weight: 0.15, slo: { operator: "gte", value: 95 } },
    ],
    composite_threshold: 80.0,
    verification_depth: "semantic",
  },
  review: {
    description: "Content review, editing, or quality assessment",
    deliverable_format: "markdown",
    dimensions: [
      { name: "thoroughness", weight: 0.25, slo: { operator: "gte", value: 80 } },
      { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 85 } },
      { name: "actionability", weight: 0.20, slo: { operator: "gte", value: 75 } },
      { name: "tone", weight: 0.10, slo: { operator: "gte", value: 70 } },
      { name: "completeness", weight: 0.20, slo: { operator: "gte", value: 80 } },
    ],
    composite_threshold: 75.0,
    verification_depth: "semantic",
  },
  general: {
    description: "General-purpose task with standard quality dimensions",
    deliverable_format: "text",
    dimensions: [
      { name: "accuracy", weight: 0.25, slo: { operator: "gte", value: 80 } },
      { name: "completeness", weight: 0.20, slo: { operator: "gte", value: 75 } },
      { name: "relevance", weight: 0.20, slo: { operator: "gte", value: 80 } },
      { name: "clarity", weight: 0.20, slo: { operator: "gte", value: 75 } },
      { name: "timeliness", weight: 0.15, metric: "boolean", slo: { operator: "eq", value: true } },
    ],
    composite_threshold: 70.0,
    verification_depth: "structural",
  },
};

export function listTemplates(): string[] {
  return Object.keys(TEMPLATES).sort();
}

export function getTemplate(name: string): TemplateData | null {
  return TEMPLATES[name] ?? null;
}

function defaultTiers(): GraduatedTier[] {
  return DEFAULT_GRADUATED_TIERS.map((t) => GraduatedTier.fromDict(t as any));
}

export function createAgreementFromTemplate(opts: {
  templateName: string;
  client: Identity;
  provider: Identity;
  description?: string;
  escrowAmount?: string;
  escrowCurrency?: string;
  expiresAt?: string;
  evaluator?: Identity;
  sloOverrides?: Record<string, unknown>;
}): Agreement {
  const tmpl = TEMPLATES[opts.templateName];
  if (!tmpl) {
    throw new Error(
      `Unknown template: ${opts.templateName}. Available: ${listTemplates().join(", ")}`,
    );
  }

  const dims: QualityDimensionSpec[] = tmpl.dimensions.map((dimData) => {
    let sloData = dimData.slo;
    if (opts.sloOverrides && dimData.name in opts.sloOverrides) {
      const override = opts.sloOverrides[dimData.name];
      if (typeof override === "object" && override !== null) {
        sloData = override as { operator: string; value: unknown };
      } else {
        sloData = { operator: "gte", value: override };
      }
    }
    return new QualityDimensionSpec(
      dimData.name,
      dimData.weight,
      dimData.metric || "percentage",
      sloData ? SLO.fromDict(sloData) : null,
    );
  });

  const quality = new QualityCriteria(dims, tmpl.composite_threshold);

  const service = new ServiceSpec(
    opts.templateName,
    opts.description || tmpl.description,
    tmpl.deliverable_format,
  );

  const verification = new VerificationConfig({ depth: tmpl.verification_depth });

  let escrow: EscrowConfig | null = null;
  if (opts.escrowAmount) {
    escrow = new EscrowConfig({
      enabled: true,
      amount: opts.escrowAmount,
      currency: opts.escrowCurrency || "USD",
      tiers: defaultTiers(),
    });
  }

  return new Agreement({
    client: opts.client,
    provider: opts.provider,
    evaluator: opts.evaluator,
    service,
    qualityCriteria: quality,
    verification,
    escrow,
    expiresAt: opts.expiresAt,
  });
}
