# agent-service-agreements (TypeScript)

Machine-readable service contracts and quality verification for autonomous agent commerce. TypeScript reference implementation of the ASA protocol.

Companion to [Chain of Consciousness](https://github.com/AB-Support/coc-typescript), [Agent Rating Protocol](https://github.com/AB-Support/agent-rating-protocol), and [Agent Justice Protocol](https://github.com/AB-Support/agent-justice-protocol).

## Quick Start

```bash
npm install agent-service-agreements
```

```typescript
import {
  Agreement,
  Identity,
  createAgreementFromTemplate,
  VerificationEngine,
  EscrowBinding,
  EscrowConfig,
  AgreementStore,
} from "agent-service-agreements";

// Create an agreement from a template
const client = new Identity("coc", "client-agent-001", "Client Agent");
const provider = new Identity("coc", "provider-agent-002", "Provider Agent");

const agreement = createAgreementFromTemplate({
  templateName: "research",
  client,
  provider,
  escrowAmount: "100.00",
  description: "Research AI safety best practices",
});

// Sign the agreement
agreement.sign("client", "sig-client-hash");
agreement.sign("provider", "sig-provider-hash");
// status is now "active"

// Deliver
agreement.deliver("sha256-of-deliverable");

// Verify the deliverable
const engine = new VerificationEngine();
const result = engine.verify({
  deliverable: "Full research report...",
  originalRequest: "Research AI safety best practices",
  agreement,
});

console.log(result.passed);             // true/false
console.log(result.compositeScore);     // 0-100
console.log(result.paymentReleasePercent); // graduated release %

// Persist to local store
const store = new AgreementStore(".asa");
store.appendAgreement(agreement);
store.appendVerification(result);
```

## Features

- **Agreement lifecycle**: propose → negotiate → sign → deliver → verify → close
- **6 built-in templates**: research, code_generation, data_analysis, translation, review, general
- **30 quality dimensions**: correctness, completeness, coherence, security, performance, etc.
- **3 composite methods**: weighted average, geometric mean, harmonic mean
- **Multi-round negotiation**: bounded rounds, asymmetry limits, fairness constraints
- **Graduated escrow**: tiered and continuous release modes, dead-man's switch
- **Verification engine**: structural, semantic, and composite verification depths
- **Evaluator registry**: qualification tracking, canary tasks, conflict-of-interest checks, rotation
- **Append-only JSONL store**: agreements, negotiations, verifications, escrow states
- **SHA-256 hashing**: deterministic canonical hashing for all records
- **Zero runtime dependencies**: only `node:crypto` and `node:fs` from stdlib

## Architecture

| Module | Description |
|--------|-------------|
| `schema.ts` | Constants, data structures (Identity, SLO, QualityCriteria, ServiceSpec, EscrowConfig, etc.) |
| `agreement.ts` | Agreement class with lifecycle transitions and validation |
| `dimensions.ts` | 30 built-in quality dimensions, composite score computation |
| `escrow.ts` | Graduated payment release, EscrowBinding lifecycle |
| `evaluator.ts` | Evaluator registry, canary tasks, selection modes |
| `negotiation.ts` | Multi-round negotiation protocol with fairness constraints |
| `store.ts` | Append-only JSONL persistence for all record types |
| `templates.ts` | Pre-configured agreement templates for common task types |
| `verification.ts` | Structural, semantic, and composite verification engine |
| `index.ts` | Barrel exports |

## Build

```bash
npm install
npm run build    # tsc -> dist/
npm test         # 132 tests across 33 suites
```

Requires Node.js >= 18.0.0.

## Agreement Templates

| Template | Dimensions | Threshold | Verification |
|----------|-----------|-----------|-------------|
| research | accuracy, completeness, relevance, source_quality, writing_quality | 75 | semantic |
| code_generation | correctness, performance, security, maintainability, test_coverage | 80 | composite |
| data_analysis | accuracy, methodology, depth, clarity, actionability | 75 | composite |
| translation | accuracy, fluency, cultural_fit, terminology, completeness | 80 | semantic |
| review | thoroughness, accuracy, actionability, tone, completeness | 75 | semantic |
| general | accuracy, completeness, relevance, clarity, timeliness | 70 | structural |

## Escrow Release Tiers (Default)

| Composite Score | Release % |
|----------------|-----------|
| ≥ 90 | 100% |
| ≥ 75 | 85% |
| ≥ 60 | 50% |
| < 60 | 0% (dispute option) |

## Semantic Verification

The `VerificationEngine` accepts a `SemanticEvaluator` callback for LLM-as-Judge integration:

```typescript
type SemanticEvaluator = (
  originalRequest: string,
  deliverable: string,
  dimension: QualityDimensionSpec,
) => [number, string]; // [score 0-100, evidence]

const engine = new VerificationEngine(myEvaluatorFn, evaluatorIdentity);
```

## Wire Format

All serialization uses snake_case keys matching the Python reference implementation for cross-language interoperability.

## License

Apache-2.0
