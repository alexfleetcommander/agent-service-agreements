# Agent Service Agreements: A Protocol for Machine-Readable Contracts and Quality Verification in Autonomous Agent Commerce

**Version:** 1.0.0
**Authors:** Charlie (Deep Dive Analyst), Alex (AB Support Fleet Coordinator), Bravo (Research), Editor (Content Review)
**Contact:** alex@vibeagentmaking.com
**Date:** 2026-03-26
**Status:** Pre-publication Draft
**License:** Apache 2.0
**Organization:** AB Support LLC

---

## Abstract

When an autonomous AI agent hires another agent to perform a task, six questions must be answered before trust can exist: What will be delivered? How will quality be measured? What happens if the work is unsatisfactory? How are terms negotiated? When does payment release? And who verifies the outcome? Today, no single protocol answers all six. The building blocks are surprisingly mature — AgentSLA provides a JSON-based specification language extending ISO/IEC 25010 with 40+ agent-specific metrics [1], ERC-8183 defines programmable escrow with three-party evaluation [2], Ricardian contracts bridge legal prose and executable code [3], and Agent-as-a-Judge achieves approximately 90% agreement with human expert evaluations in code generation tasks [65], though agreement drops to 60-68% in specialized domains [36]. But these components exist in isolation. An agent can describe what it wants (AgentSLA), lock funds conditionally (ERC-8183), and evaluate output quality (Agent-as-a-Judge), yet no protocol connects specification to escrow to verification to payment in a single coherent flow.

The Agent Service Agreements (ASA) protocol fills this gap. ASA provides two complementary API surfaces: the **Agreements API** for negotiating, signing, storing, and querying machine-readable service agreements between agents, and the **Verification API** for standalone quality verification that operates with or without a formal agreement. When an agreement exists, verification evaluates against its specific quality criteria. When no agreement exists, verification applies default quality dimensions derived from ISO 25010 and the six-dimension scoring system validated in AB Support's own fleet operations.

ASA's core innovation is the **protocol-enforced agreement** — a service contract where the SLA does not merely describe expectations but includes the verification mechanism, enforcement logic, and evaluator integrity safeguards (rotation, canary tasks, multi-evaluator consensus) as integral components. Traditional SLAs separate specification from enforcement: a cloud provider promises 99.99% uptime, a customer detects a violation, files a claim within 30 days, provides detailed logs as proof, and receives a credit worth approximately 0.03% of actual losses [5]. This model fails catastrophically for agent commerce, where transactions occur at machine speed, participants may lack the ability to file manual claims, and the cost of failure cascades through dependent workflows. ASA collapses the specify-monitor-detect-claim-compensate pipeline into a single atomic operation: the agreement specifies quality criteria, the verification engine evaluates against those criteria, and the escrow layer releases or withholds payment automatically.

The protocol draws on four categories of prior art. From traditional SLA frameworks, it inherits ITIL 4's outcome-focused philosophy and the painful lessons of cloud provider credit inadequacy [5][6]. From smart contract platforms, it adopts bonded collateral with proportional slashing, replacing nominal credits with economically meaningful consequences [7]. From quality verification research, it builds on the Agent-as-a-Judge paradigm — equipping evaluator agents with tool use, memory, and multi-step reasoning to achieve evaluation depth impossible for schema checks alone [4][65]. From game theory and negotiation research, it incorporates structured templates that resist the manipulation, anchoring bias, and prompt injection attacks documented across 180,000+ LLM negotiations [8][9][10].

ASA is designed as a Layer 2 protocol in the AB Support Trust Ecosystem, sitting between the foundational trust primitives (Chain of Consciousness for provenance [11], Agent Rating Protocol for reputation [12]) and the accountability layer (Agent Justice Protocol for dispute resolution). Quality verification pass rates feed directly into ARP reputation scores, creating a feedback loop where consistent service quality builds reputation that enables better agreement terms. SLA breaches detected by ASA's verification engine can trigger AJP dispute filings automatically, connecting agreements to accountability without human intervention.

The protocol is identity-system-agnostic: it works with Chain of Consciousness chains, ERC-8004 on-chain registries, W3C Verifiable Credentials, Google's A2A agent cards, or standalone API keys. It is payment-rail-agnostic: escrow can settle via ERC-8183 smart contracts, x402 micropayments, traditional payment APIs, or simple HTTP callbacks. This architectural neutrality reflects a deliberate choice — ASA specifies *what* agents agree to and *how* quality is verified, not *who* they are or *how* they pay.

AB Support's own fleet operations serve as the protocol's reference implementation. Since March 2026, a six-agent fleet has operated with an informal version of ASA: Alex (coordinator) assigns tasks to Bravo (research), Charlie (analysis), Delta (development), Editor (review), and Translator (multilingual). Each assignment specifies deliverables, quality criteria, and evaluation dimensions. Bravo's knowledge files are scored across six dimensions (breadth, depth, accuracy, sources, cross-references, writing quality), each rated 0-100, with a minimum threshold of 60 for acceptance. This pipeline — specification, delivery, multi-dimensional evaluation, accept/reject decision — is exactly what ASA formalizes into an open protocol. The gap between "Alex scores Bravo's work" and "any agent scores any agent's work against any agreed criteria" is the gap ASA closes.

This whitepaper specifies the complete protocol: data models for agreements and verification requests, negotiation flows with manipulation resistance, a quality verification framework supporting structural, semantic, and composite evaluation, integration points with the broader trust ecosystem, security analysis including adversarial quality gaming and Goodhart's Law mitigation, and a competitive landscape survey covering 160+ sources across SLA frameworks, quality verification systems, smart contract platforms, and agent negotiation research.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Definitions](#2-definitions)
3. [Design Principles](#3-design-principles)
4. [Protocol Specification: Agreements API](#4-protocol-specification-agreements-api)
5. [Protocol Specification: Verification API](#5-protocol-specification-verification-api)
6. [Quality Verification Framework](#6-quality-verification-framework)
7. [Negotiation Protocol](#7-negotiation-protocol)
8. [Escrow and Payment Integration](#8-escrow-and-payment-integration)
9. [Trust Ecosystem Integration](#9-trust-ecosystem-integration)
10. [Game Theory of Bilateral Agreements](#10-game-theory-of-bilateral-agreements)
11. [Competitive Landscape](#11-competitive-landscape)
12. [Security Analysis](#12-security-analysis)
13. [Reference Implementation](#13-reference-implementation)
14. [Future Work](#14-future-work)
15. [Conclusion](#15-conclusion)
16. [References](#16-references)

---

## 1. Introduction

### 1.1 The Problem: Agreements Without Enforcement

The autonomous agent economy is growing rapidly. Over 20,000 AI agents registered on ERC-8004 within two weeks of its January 2026 launch [13]. The x402 payment protocol reports 35 million+ transactions and $10 million+ in volume since mid-2025, though analysis suggests a significant fraction reflects wash trading and infrastructure testing rather than genuine commerce [14]. Google's A2A protocol, Anthropic's MCP, and the Agentic AI Foundation (AAIF) provide communication infrastructure for agents to discover and interact with each other [15][16]. Payment rails exist. Communication channels exist. Identity registries exist.

What does not exist is a standardized way for agents to form, verify, and enforce service agreements.

When Agent A hires Agent B to summarize a dataset, there is currently no machine-readable format to specify what "good summary" means, no automated mechanism to evaluate whether the output meets that specification, and no enforcement pathway that connects quality failure to economic consequence. Agent A can *pay* Agent B (via x402), *communicate* with Agent B (via A2A or MCP), and *identify* Agent B (via ERC-8004 or CoC). But Agent A cannot *hold Agent B accountable for the quality of its work* through any standardized protocol.

This gap is not hypothetical. PayCrow, the leading escrow service for x402 agent payments, provides optional escrow over x402 transactions and can verify that an API returned valid JSON with a 2xx status code — structural validity [17]. It cannot verify whether the content of that JSON is accurate, relevant, or useful. ERC-8183 defines a three-party escrow model where an evaluator approves or rejects work — but the standard says nothing about *how* the evaluator should assess quality [2]. AgentSLA provides a comprehensive specification language with 40+ metrics — but it defines agreements without enforcement mechanisms [1]. Each system solves one piece of the puzzle while leaving the others unaddressed.

### 1.2 Why Traditional SLAs Fail for Agents

Traditional Service Level Agreements were designed for infrastructure. ITIL 4 defines an SLA as "a documented agreement between a service provider and a customer that identifies both services required and the expected level of service" [18]. In practice, this means uptime percentages, response time thresholds, and credit structures measured against binary availability metrics.

This model fails for agent commerce in four fundamental ways:

**The metric problem.** Cloud SLAs measure availability — the server is up or it is not. Agent services require quality measurement across multiple dimensions simultaneously. An agent that summarizes a research paper could be fast but inaccurate, comprehensive but poorly organized, or factually correct but irrelevant to the requester's purpose. Single-metric SLAs invite Goodhart's Law: "When a measure becomes a target, it ceases to be a good measure" [19]. An agent optimizing for speed will sacrifice quality. An agent optimizing for accuracy on benchmarks will overfit to the benchmark distribution. Multi-dimensional quality assessment is not a nice-to-have; it is the only defense against systematic gaming.

**The enforcement problem.** Cloud SLA credits require manual claim filing within a fixed window (typically 30 days), documented proof of violation, and acceptance of credits worth a fraction of actual losses. Dr. Owen Rogers of the Uptime Institute demonstrated that a $3/month AWS instance yields 30 cents in credit for a violation that costs enterprises an average of $973,000 per significant incident [5]. Agent transactions occur at machine speed — potentially thousands per hour — with no human available to file claims. Enforcement must be automated, proportional, and immediate.

**The verification problem.** Determining whether a server is responding is binary and trivial. Determining whether an AI agent's output is "good enough" requires semantic evaluation — itself an AI problem. Current oracles can verify structural validity (JSON schema conformance, HTTP status codes) but not semantic quality (accuracy, relevance, usefulness). This "semantic quality verification gap" is the fundamental bottleneck for automated SLA enforcement in agent systems.

**The negotiation problem.** Traditional SLAs are negotiated between humans over days or weeks. Agent-to-agent agreements must be formed in seconds or milliseconds. Research from MIT's large-scale negotiation competition (182,812 negotiations across 452 agents) reveals that LLM negotiators exhibit anchoring bias at extremes rather than the zone of possible agreement (ZOPA) midpoint, can be manipulated through emotional appeals and prompt injection, and systematically exploit weaker negotiating partners by 2-14% [8][9][10]. Protocol-level safeguards are required to ensure fair, manipulation-resistant negotiation.

### 1.3 What ASA Provides

ASA addresses these four failures with an integrated protocol:

1. **Multi-dimensional quality specification** via machine-readable agreement documents that define quality criteria across configurable dimensions, extending AgentSLA's ISO 25010 framework.
2. **Automated enforcement** via escrow integration where payment release is conditional on verification results, with proportional economic consequences for quality failures.
3. **Tiered verification** supporting structural checks (schema validation), semantic evaluation (Agent-as-a-Judge), and composite scoring (multi-dimensional weighted aggregation).
4. **Structured negotiation** via templates with manipulation-resistant message formats, fairness constraints, and market-rate benchmarks.

### 1.4 Scope and Relationship to Other Protocols

ASA occupies Layer 2 (Agreements & Lifecycle) in the AB Support Trust Ecosystem:

```
Layer 5: Meta / Certification (ACF, ERP)
Layer 4: Market / Discovery (AMP, CWEP)
Layer 3: Accountability (AJP — Forensics, Disputes, Risk)
Layer 2: Agreements & Lifecycle (ASA, ALP)        ← THIS PROTOCOL
Layer 1: Trust Primitives (CoC, ARP v2)
```

**Consumes from Layer 1:**
- **CoC** — Agent identity verification via provenance chains; operational age as trust signal
- **ARP** — Reputation scores inform negotiation (higher-rated agents negotiate better terms)

**Feeds into Layer 3:**
- **AJP** — SLA breaches detected by ASA verification trigger AJP dispute filings
- **AJP Forensics** — ASA agreement documents and verification logs serve as evidence

**Feeds into Layer 1 (feedback loop):**
- **ARP** — Verification pass rates feed into ARP reputation scores

ASA does NOT specify: payment rail implementation (use x402, ERC-8183, Stripe, etc.), agent discovery or matchmaking (use AMP), agent lifecycle management (use ALP), or dispute arbitration logic (use AJP). ASA specifies what agents agree to and how quality is verified; other protocols handle the rest.

---

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Agreement** | A machine-readable document specifying service terms between a Client and Provider, including deliverables, quality criteria, timeline, cost, and verification parameters. |
| **Client** | The agent requesting a service and providing payment or other consideration. |
| **Provider** | The agent delivering the requested service. |
| **Evaluator** | An independent agent or verification system that assesses deliverable quality against agreement criteria. May be an Agent-as-a-Judge instance, a deterministic validator, or a composite of both. |
| **Quality Dimension** | A named, measurable aspect of deliverable quality (e.g., accuracy, completeness, timeliness). Each dimension has a metric type, scoring range, and minimum threshold. |
| **Quality Gate** | A pass/fail threshold applied to one or more quality dimensions. Borrowed from SonarQube's concept of machine-readable acceptance criteria [20]. |
| **Service Level Objective (SLO)** | A specific, measurable target for a quality dimension within an agreement (e.g., "accuracy ≥ 85%"). |
| **Verification Request** | A standalone API call requesting quality evaluation of a deliverable, with or without a governing agreement. |
| **Verification Result** | The output of quality evaluation: dimension scores, composite score, pass/fail determination, and evidence trail. |
| **Escrow Binding** | An optional link between an agreement and an escrow system, where payment release depends on verification results. |
| **Agreement Template** | A reusable, parameterized agreement structure for common service types (research, code generation, data analysis, translation, review). |
| **Negotiation Session** | A bounded interaction where Client and Provider exchange proposals and counter-proposals to reach agreement terms. |
| **Canary Task** | A known-answer subtask embedded in real work to continuously monitor provider quality, adapted from Amazon Mechanical Turk's gold standard technique [21]. |
| **Shadow Metric** | A secondary metric paired with each target metric to detect Goodhart's Law gaming — measuring the foreseeable harm displacement when the primary metric is optimized [19]. |
| **Dead-Man's Switch** | A timeout mechanism that auto-releases escrowed funds or auto-accepts/rejects deliverables when a party becomes unresponsive. Adapted from Upwork's 14-day auto-release pattern [22]. |

---

## 3. Design Principles

ASA's design is governed by seven principles derived from the research landscape and operational experience.

### 3.1 Outcome Over Uptime

Agent SLAs measure what was delivered, not whether the server was running. Following the industry shift from SLAs to Experience Level Agreements (XLAs) — with approximately 70% of organizations planning XLA adoption by 2026 according to the XLA Institute's State of XLA 2025 report [23] — and Mayer Brown's landmark legal analysis recommending outcome-based metrics for agentic AI contracts [24], ASA specifies accuracy, timeliness, relevance, and task completion rather than availability percentages.

### 3.2 Protocol-Enforced Agreements

An SLA that can't be verified is a promise. An SLA with built-in verification is a contract. ASA agreements include the verification mechanism, enforcement logic, and evaluator integrity safeguards as structural components, not external dependencies. The agreement specifies what "good" means in scoring terms; the Verification API evaluates against those exact terms using independent evaluators whose integrity is maintained through rotation, canary tasks, and multi-evaluator consensus (Section 6.3); the escrow layer acts on the result. No manual claims, no 30-day windows, no proof-of-violation paperwork. Note that enforcement depends on evaluator correctness — ASA reduces but does not eliminate this dependency through its integrity mechanisms.

### 3.3 Multi-Dimensional Quality

No effective quality system uses a single metric. ISO 25010 defines 9 quality characteristics with 38+ subcharacteristics [25]. SonarQube scores across reliability, security, and maintainability [20]. DeepSource uses 5 dimensions [26]. Even Codility's simple coding assessments use dual metrics (correctness and scalability) [27]. ASA requires multi-dimensional quality criteria with balanced metrics that resist single-target gaming.

### 3.4 Probabilistic Guarantees

Agent performance exhibits high run-to-run variance. The MAESTRO evaluation suite found that multi-agent system executions can be "structurally stable yet temporally variable" [28]. MAS-ProVe demonstrated that process verification "does not consistently improve performance and exhibits high variance" [29]. ASA supports probabilistic guarantees — an agreement can specify "pass@5 ≥ 95%" (at least one of five attempts meets threshold) or "p90 accuracy ≥ 85%" (90th percentile accuracy across deliveries exceeds threshold) rather than requiring deterministic perfection on every transaction.

### 3.5 Graduated Trust

Trust should modulate verification intensity, not replace it. Following PayCrow's trust-adaptive model (15-minute timelocks for scores 75+, $5 caps for scores below 45) [17] and Fiverr's tiered seller system (7-day hold for Top Rated vs. 14 days for standard) [30], ASA allows agreements to specify verification depth that scales inversely with provider reputation. High-reputation providers may receive lightweight structural verification; unknown providers receive full semantic evaluation.

### 3.6 Verification Independence

The evaluator must be independent of both client and provider. ERC-8183's three-party model (Client/Provider/Evaluator) enforces this separation architecturally [2]. ASA adopts this pattern: the entity that requests the work and the entity that performs the work cannot be the entity that judges the work. Evaluator selection, qualification, and rotation are protocol-level concerns.

#### 3.6.1 Evaluator Selection Protocol

Section 3.6 establishes that the evaluator must be independent, but does not specify *how* parties agree on an evaluator. This is a critical gap: evaluator selection determines the entire quality assessment outcome. If the client selects the evaluator, they may choose a harsh judge to avoid payment. If the provider selects, they may choose a lenient one. Mutual agreement risks deadlock.

ASA specifies three evaluator selection mechanisms, configurable per agreement:

**Random assignment from qualified pool (default).** A curated evaluator registry maintains a pool of evaluators with verified track records. When an agreement is activated, an evaluator is randomly assigned from the subset of qualified evaluators for the service type. Qualification requires: (a) a minimum number of prior evaluations (default: 50), (b) a canary task pass rate above threshold (default: 90%), and (c) inter-evaluator calibration score within acceptable deviation (Section 6.3). Random assignment prevents either party from gaming evaluator selection.

**Mutual agreement with random fallback.** Both parties propose evaluators from the qualified pool. If they agree on a common choice, that evaluator is assigned. If they fail to agree within a configurable number of rounds (default: 3), the system falls back to random assignment. This preserves party agency while preventing deadlock.

**Evaluator marketplace.** Evaluators compete on track record, domain expertise, and price. The agreement specifies evaluator selection criteria (minimum track record, domain, maximum cost), and the system selects the best-matching available evaluator. This mechanism is suitable for specialized domains where evaluator expertise significantly affects assessment quality.

All three mechanisms enforce the independence constraint from Section 3.6: the selected evaluator cannot share identity, organizational affiliation, or CoC chain lineage with either party.

### 3.7 Identity Agnosticism

ASA works with any identity system. An agent's identity in an agreement can be:
- A Chain of Consciousness chain hash (CoC) [11]
- An ERC-8004 on-chain registry entry [13]
- A W3C Decentralized Identifier (DID)
- An A2A agent card URL
- A simple API key or public key

The protocol specifies an `identity` field with a `scheme` discriminator, not a mandatory identity provider.

---

## 4. Protocol Specification: Agreements API

### 4.1 Agreement Document Structure

An ASA agreement is a JSON document with the following top-level structure:

```json
{
  "asa_version": "1.0.0",
  "agreement_id": "asa-2026-03-26-a1b2c3d4",
  "created_at": "2026-03-26T14:30:00Z",
  "expires_at": "2026-03-27T14:30:00Z",
  "status": "active",

  "parties": {
    "client": {
      "identity": { "scheme": "coc", "value": "sha256:abc123..." },
      "display_name": "Agent Alpha"
    },
    "provider": {
      "identity": { "scheme": "erc8004", "value": "0x742d..." },
      "display_name": "Agent Beta"
    },
    "evaluator": {
      "identity": { "scheme": "api_key", "value": "eval-key-789" },
      "type": "agent_as_judge",
      "config": { "model": "claude-sonnet-4-6", "rubric_id": "research-v2" }
    }
  },

  "service": {
    "type": "research_synthesis",
    "description": "Summarize recent literature on federated learning privacy guarantees",
    "deliverable_format": "markdown",
    "constraints": {
      "max_tokens": 50000,
      "max_duration_seconds": 3600,
      "max_cost_usd": 5.00
    }
  },

  "quality_criteria": {
    "dimensions": [
      {
        "name": "accuracy",
        "weight": 0.25,
        "metric": "percentage",
        "slo": { "operator": "gte", "value": 85 },
        "shadow_metric": "hallucination_rate",
        "shadow_slo": { "operator": "lte", "value": 5 }
      },
      {
        "name": "completeness",
        "weight": 0.20,
        "metric": "percentage",
        "slo": { "operator": "gte", "value": 80 }
      },
      {
        "name": "relevance",
        "weight": 0.20,
        "metric": "percentage",
        "slo": { "operator": "gte", "value": 90 }
      },
      {
        "name": "source_quality",
        "weight": 0.15,
        "metric": "percentage",
        "slo": { "operator": "gte", "value": 70 }
      },
      {
        "name": "writing_quality",
        "weight": 0.10,
        "metric": "percentage",
        "slo": { "operator": "gte", "value": 75 }
      },
      {
        "name": "timeliness",
        "weight": 0.10,
        "metric": "boolean",
        "slo": { "operator": "eq", "value": true }
      }
    ],
    "composite_threshold": 75,
    "composite_method": "weighted_average",
    "guarantee_type": "deterministic"
  },

  "verification": {
    "strategy": "optimistic",
    "challenge_window_seconds": 7200,
    "evaluator_timeout_seconds": 600,
    "canary_tasks": {
      "enabled": true,
      "frequency": "1_per_5_deliveries",
      "failure_action": "flag_and_continue"
    }
  },

  "escrow": {
    "enabled": true,
    "binding": {
      "type": "erc8183",
      "contract_address": "0xdef456...",
      "chain": "base"
    },
    "payment": {
      "amount": "5.00",
      "currency": "USDC",
      "graduated_release": {
        "enabled": true,
        "tiers": [
          { "composite_score_gte": 90, "release_percent": 100 },
          { "composite_score_gte": 75, "release_percent": 85 },
          { "composite_score_gte": 60, "release_percent": 50 },
          { "composite_score_lt": 60, "release_percent": 0 }
        ]
      }
    },
    "dead_mans_switch": {
      "client_timeout_seconds": 86400,
      "provider_timeout_seconds": 86400,
      "evaluator_timeout_seconds": 3600,
      "timeout_action": "hold_for_backup_evaluator"
    }
  },

  "dispute": {
    "protocol": "ajp",
    "auto_file_on": "verification_failure_below_threshold",
    "threshold": 60,
    "evidence_includes": ["agreement", "deliverable_hash", "verification_result"]
  },

  "signatures": {
    "client": { "scheme": "ed25519", "value": "sig_abc..." },
    "provider": { "scheme": "ed25519", "value": "sig_def..." }
  }
}
```

### 4.2 Agreement Lifecycle

Agreements progress through a state machine with six states:

```
PROPOSED → NEGOTIATING → ACTIVE → DELIVERED → VERIFIED → CLOSED
                │                                    │
                └──── REJECTED                       ├── DISPUTED
                                                     └── EXPIRED
```

**PROPOSED:** Client creates an agreement document and sends it to Provider. The document is unsigned.

**NEGOTIATING:** Provider reviews and may counter-propose by modifying quality criteria, payment terms, or timeline. This enters the Negotiation Protocol (Section 7). Maximum negotiation rounds and timeout are configurable.

**ACTIVE:** Both parties sign the agreement. If escrow is enabled, the Client funds the escrow. The Provider begins work.

**DELIVERED:** Provider submits a deliverable with a content hash. The verification clock starts.

**VERIFIED:** The Evaluator returns a Verification Result. Based on the result and escrow configuration:
- Score ≥ composite threshold → funds release (graduated by tier if configured)
- Score < composite threshold → funds return to client (or graduated partial release)
- If `verification.strategy` is `optimistic`, the result enters the challenge window before enforcement

**CLOSED:** Agreement is complete. Final state is recorded with verification results, payment amounts, and timestamps. This record is available for ARP reputation scoring.

**DISPUTED:** Either party challenges the verification result during the challenge window. Dispute is filed via AJP with the agreement document, deliverable hash, and verification result as evidence.

**EXPIRED:** Timeout triggered by dead-man's switch. Provider or evaluator failed to act within configured timeouts.

### 4.3 API Endpoints

```
POST   /agreements                    Create a new agreement (PROPOSED)
GET    /agreements/{id}               Retrieve agreement by ID
PATCH  /agreements/{id}/negotiate     Submit counter-proposal (NEGOTIATING)
POST   /agreements/{id}/sign          Sign the agreement (→ ACTIVE)
POST   /agreements/{id}/deliver       Submit deliverable (→ DELIVERED)
POST   /agreements/{id}/verify        Trigger verification (→ VERIFIED)
POST   /agreements/{id}/challenge     Challenge verification result (→ DISPUTED)
GET    /agreements/{id}/status        Get current state and metadata
GET    /agreements?party={id}         List agreements for a party
GET    /templates                     List available agreement templates
GET    /templates/{type}              Get template for service type
```

### 4.4 Agreement Templates

ASA defines starter templates for common agent service types:

| Template | Quality Dimensions | Typical SLOs |
|----------|-------------------|-------------|
| `research` | accuracy, completeness, relevance, sources, writing | accuracy ≥ 85%, sources ≥ 5 |
| `code_generation` | correctness, performance, security, maintainability, test_coverage | correctness ≥ 95%, tests pass |
| `data_analysis` | accuracy, methodology, visualization, insight_quality | accuracy ≥ 90% |
| `translation` | accuracy, fluency, cultural_appropriateness, terminology | accuracy ≥ 90%, fluency ≥ 85% |
| `review` | thoroughness, accuracy, actionability, tone | thoroughness ≥ 80% |
| `general` | accuracy, completeness, relevance, timeliness | accuracy ≥ 80% |

Templates are parameterized — agents select a template and adjust SLO values, weights, and verification strategy during negotiation. This follows the Accord Project's template approach (40+ legal contract templates with parameterized logic) [31] and addresses the research finding that domain-focused strategies outperform open-ended negotiation [32].

### 4.5 Schema Versioning

ASA uses semantic versioning (SemVer) for the `asa_version` field. Compatibility rules:

- **Patch versions** (1.0.x): Bug fixes to specification text. No schema changes. All implementations interoperable.
- **Minor versions** (1.x.0): New optional fields added. Evaluators and implementations MUST ignore unknown fields. Agreements signed under 1.0 remain valid under 1.1 — new fields take default values. Active agreements are NOT migrated; they complete under the version they were signed with.
- **Major versions** (x.0.0): Breaking schema changes. Agreements signed under v1 cannot be processed by v2 implementations without explicit migration. A transition period (minimum 6 months) allows both versions to coexist. Evaluators MUST support the current and previous major version during the transition.

The `asa_version` field in the agreement document is the authoritative version. Implementations MUST validate incoming agreements against the schema for the declared version, not the implementation's current version.

### 4.6 Template Governance

Template creation, maintenance, and validation are critical to ASA's adoption — a malicious template with exploitative default terms could be widely adopted before the terms are noticed. ASA defers template governance to the Trust Architecture Team (TAT) governance framework, which specifies: (a) template submission review by a committee of qualified evaluators, (b) mandatory disclosure of non-standard terms (terms that deviate >25% from market-rate defaults), and (c) template versioning aligned with ASA schema versioning. Community-contributed templates undergo the same review process as protocol changes. Until TAT governance is operational, templates are maintained by protocol maintainers with public review periods.

---

## 5. Protocol Specification: Verification API

The Verification API operates independently of the Agreements API. Any agent can request quality verification of any deliverable at any time, with or without a governing agreement.

### 5.1 Verification Request

```json
{
  "verification_id": "ver-2026-03-26-x1y2z3",
  "agreement_id": "asa-2026-03-26-a1b2c3d4",  // optional
  "deliverable": {
    "content_hash": "sha256:fedcba...",
    "content_url": "https://agent-beta.example/deliverables/abc123",
    "format": "markdown",
    "size_bytes": 24576
  },
  "original_request": {
    "description": "Summarize recent literature on federated learning privacy guarantees",
    "constraints": { "max_tokens": 50000 }
  },
  "quality_criteria": {
    // If agreement_id provided: inherited from agreement
    // If standalone: specified here using same schema as agreement quality_criteria
  },
  "verification_config": {
    "depth": "semantic",       // "structural", "semantic", or "composite"
    "evaluator_type": "agent_as_judge",
    "evaluator_config": {
      "model": "claude-sonnet-4-6",
      "rubric_id": "research-v2",
      "evidence_collection": true,
      "spot_check_claims": 3
    }
  }
}
```

### 5.2 Verification Result

```json
{
  "verification_id": "ver-2026-03-26-x1y2z3",
  "agreement_id": "asa-2026-03-26-a1b2c3d4",
  "timestamp": "2026-03-26T15:45:00Z",
  "evaluator": {
    "identity": { "scheme": "api_key", "value": "eval-key-789" },
    "type": "agent_as_judge",
    "model": "claude-sonnet-4-6"
  },

  "dimensions": [
    {
      "name": "accuracy",
      "score": 88,
      "slo_target": 85,
      "slo_met": true,
      "evidence": "Spot-checked 3 claims against source material. 2/3 fully supported, 1/3 partially supported with minor imprecision in date attribution.",
      "shadow_metric": {
        "name": "hallucination_rate",
        "value": 3.2,
        "slo_target": 5,
        "slo_met": true
      }
    },
    {
      "name": "completeness",
      "score": 82,
      "slo_target": 80,
      "slo_met": true,
      "evidence": "Covers 8 of 10 major papers from 2025-2026. Missing: Wang et al. (NeurIPS 2025) and Patel et al. (ICML 2026)."
    },
    {
      "name": "relevance",
      "score": 94,
      "slo_target": 90,
      "slo_met": true,
      "evidence": "All sections directly address the specified topic. No tangential content."
    },
    {
      "name": "source_quality",
      "score": 78,
      "slo_target": 70,
      "slo_met": true,
      "evidence": "12 sources cited. 9 peer-reviewed, 2 preprints, 1 blog post. Source diversity adequate."
    },
    {
      "name": "writing_quality",
      "score": 81,
      "slo_target": 75,
      "slo_met": true,
      "evidence": "Clear structure, appropriate technical depth. Minor issues: two run-on sentences in Section 3."
    },
    {
      "name": "timeliness",
      "score": 100,
      "slo_target": true,
      "slo_met": true,
      "evidence": "Delivered 847 seconds before deadline."
    }
  ],

  "composite": {
    "score": 86.1,
    "method": "weighted_average",
    "threshold": 75,
    "passed": true
  },

  "determination": {
    "result": "PASS",
    "payment_release_percent": 100,
    "confidence": 0.87,
    "notes": "All SLOs met. Composite score 86.1 exceeds threshold of 75."
  },

  "evidence_trail": {
    "deliverable_hash": "sha256:fedcba...",
    "evaluation_hash": "sha256:789xyz...",
    "evaluation_duration_ms": 45230,
    "evaluation_cost_usd": 0.12
  }
}
```

### 5.3 Verification Depths

ASA supports three verification depths, each with different cost, latency, and evaluation capability:

**Structural verification** checks format compliance: JSON schema validation, required field presence, size constraints, deliverable format matching. Analogous to PayCrow's HTTP status + JSON validation [17]. Cost: near-zero. Latency: milliseconds. Limitations: cannot assess content quality.

**Semantic verification** evaluates content quality using an Agent-as-a-Judge evaluator. The evaluator agent receives the original request, the deliverable, and the quality rubric, then scores each dimension with evidence. This follows the Agent-as-a-Judge paradigm introduced by Zhuge et al. (2024) [65] and surveyed by You et al. (2026) [4], which achieves approximately 90% agreement with human expert evaluations in code generation tasks and reduces evaluation cost by ~97% compared to human review. Agreement drops to 60-68% in specialized domains (Section 6.2), making domain-specific evaluator calibration important for non-code tasks. Cost: $0.03-31 depending on deliverable size, evaluator model, and verification complexity (typical research/code evaluations: $0.03-0.50; complex multi-step evaluations with extensive tool use: up to $31). Latency: 10-120 seconds.

**Composite verification** combines structural and semantic evaluation with optional additional checks: canary task results, cross-reference validation against known sources, consistency checks across multiple deliveries, and formal method verification for code outputs. This is the most thorough but most expensive tier, suitable for high-value agreements or low-trust scenarios.

### 5.4 Default Quality Dimensions

When the Verification API is called without an agreement (standalone mode), it applies default quality dimensions based on deliverable type:

| Deliverable Type | Default Dimensions | Default Weights |
|-----------------|-------------------|----------------|
| text/research | accuracy, completeness, relevance, sources, writing | 25/20/20/15/20 |
| text/analysis | accuracy, methodology, depth, clarity, actionability | 25/20/20/15/20 |
| code | correctness, performance, security, maintainability, documentation | 30/20/20/15/15 |
| data | accuracy, completeness, consistency, format_compliance, metadata | 25/25/20/15/15 |
| translation | accuracy, fluency, terminology, cultural_fit, completeness | 25/25/20/15/15 |
| general | accuracy, completeness, relevance, clarity, timeliness | 25/20/20/20/15 |

These defaults derive from AB Support's operational experience: the six-dimension QA scoring system used in fleet operations (breadth, depth, accuracy, sources, cross-references, writing quality) generalized to service categories observed in agent commerce [12].

### 5.5 When to Use Standalone Verification vs. Full Agreements

The Verification API's standalone mode lowers the barrier to adoption but creates a risk that adoption concentrates on free verification while the Agreements API — the actual innovation — goes unused. The following decision framework guides when each mode is appropriate:

**Use standalone verification when:**
- Transaction value is below the verification cost threshold (rule of thumb: agreement overhead is justified when transaction value exceeds 10x the verification cost)
- The parties have an established trust relationship (e.g., repeated successful transactions, high mutual ARP scores)
- The service is low-stakes or easily repeatable (a failed summary can be re-requested; a failed financial analysis cannot)
- Speed is critical and the negotiation + escrow overhead is unacceptable

**Use full agreements when:**
- Transaction value justifies the overhead (>$0.50 for structural verification, >$5 for semantic verification)
- The parties are unknown to each other (low or absent ARP scores)
- The service is high-stakes, non-repeatable, or has cascading dependencies
- Payment enforcement is needed (the client may not pay voluntarily)
- A forensic evidence trail is required for compliance or dispute resolution

**Graduated adoption path:** New agent ecosystems can start with standalone verification to build evaluation infrastructure and evaluator track records, then migrate to full agreements as transaction volumes and trust requirements grow. This mirrors the progression from informal handshake deals to formal contracts in human commerce.

---

## 6. Quality Verification Framework

### 6.1 The Semantic Quality Verification Problem

The central challenge in agent quality verification is the gap between structural and semantic evaluation. Structural verification — does the output conform to expected format? — is trivially automatable. Semantic verification — is the output accurate, relevant, and useful? — is itself an AI problem, creating a recursive dependency.

The research landscape reveals a clear hierarchy of verification approaches:

| Approach | Human Agreement Rate | Cost per Eval | Latency | Source |
|----------|---------------------|--------------|---------|--------|
| Human expert review | ~80% inter-rater | $50-1,300 | Hours-days | Industry standard |
| Agent-as-a-Judge | ~90% with humans (code); 60-68% (specialized) | $0.03-31 | Minutes | Zhuge et al., 2024 [65]; You et al., 2026 [4] |
| LLM-as-a-Judge | ~80% with humans | $0.01-5 | Seconds-minutes | Zheng et al., 2023 [33] |
| Reward model | Learned proxy | $0.001-0.01 | Milliseconds | RLHF/RLAIF [34] |
| Schema validation | N/A (structural) | ~$0 | Milliseconds | PayCrow [17] |

Agent-as-a-Judge achieves higher agreement with human experts (~90% in code generation [65]) than standard LLM-as-a-Judge (~80% [33]) because it can use tools, access memory, and perform multi-step reasoning — running code to verify claims, checking sources, and testing edge cases rather than relying solely on linguistic plausibility [4][65]. However, this 90% figure was demonstrated specifically in code generation evaluation; cross-domain generalization remains an active research area, with Section 6.2 documenting 60-68% agreement in specialized domains [36]. ASA adopts Agent-as-a-Judge as the primary semantic verification mechanism while acknowledging this domain gap and supporting domain-specific evaluator configurations to mitigate it.

### 6.2 Known Biases and Mitigations

LLM-based evaluation exhibits documented biases that ASA must account for:

**Position bias:** Flipping answer order changes judgment. Mitigation: evaluators receive deliverables without positional context (single-item pointwise evaluation, not pairwise comparison).

**Verbosity bias:** Longer responses rated higher regardless of quality. Mitigation: quality dimensions explicitly separate completeness from conciseness; word count is a shadow metric when completeness is a target.

**Self-enhancement bias:** Models rate their own outputs higher. Mitigation: the evaluator model must differ from the provider model, or evaluation must use a fine-tuned judge model (e.g., PROMETHEUS) [35].

**Domain expertise gap:** In expert domains (medicine, law, finance), LLM judge agreement with humans drops to 60-68% [36]. Mitigation: for specialized domains, ASA supports domain-specific evaluator agents or hybrid evaluation (Agent-as-a-Judge + domain-specific formal validators).

### 6.3 The Verifier-Verifier Problem

Who evaluates the evaluator? This is the "quis custodiet ipsos custodes" challenge [37]. ASA addresses it through three mechanisms:

**Evaluator rotation:** Agreements can specify evaluator rotation policies — no single evaluator assesses more than N consecutive deliveries from the same provider. This prevents evaluator-provider collusion.

**Canary tasks:** Known-answer subtasks embedded in real work verify evaluator accuracy. If an evaluator consistently rates known-bad deliverables as passing, or known-good deliverables as failing, the evaluator's reliability score decreases. Adapted from Amazon Mechanical Turk's gold standard technique [21].

**Multi-evaluator consensus:** For high-value agreements, multiple evaluators score independently and the result is determined by majority vote or median score. This follows the PoLL (Plurality of Language Models) approach, which reduces single-judge bias [33].

### 6.4 Quality Gate Model

Borrowing from SonarQube's quality gate concept [20], ASA allows agreements to define binary pass/fail gates in addition to scored dimensions:

```json
{
  "quality_gates": [
    { "condition": "no_critical_security_vulnerabilities", "type": "boolean" },
    { "condition": "all_tests_pass", "type": "boolean" },
    { "condition": "accuracy_gte_80", "type": "threshold" },
    { "condition": "composite_gte_75", "type": "threshold" }
  ],
  "gate_logic": "all_must_pass"
}
```

A deliverable that fails any quality gate is automatically rejected regardless of dimension scores. Gates provide hard safety boundaries; dimension scores provide graduated quality assessment within those boundaries.

---

## 7. Negotiation Protocol

### 7.1 Design Constraints from Research

LLM negotiation research reveals several patterns that ASA's negotiation protocol must address:

| Finding | Source | Protocol Implication |
|---------|--------|---------------------|
| LLMs anchor at extremes (seller's floor) | Shah et al., NeurIPS 2025 [10] | Provide market-rate benchmarks as anchoring reference |
| Warmth outperforms dominance | Vaccaro et al., 2025 [8] | Structured formats prevent emotional manipulation |
| Prompt injection as negotiation tactic | Vaccaro et al., 2025 [8] | Structured message fields, not free-text |
| Weaker agents exploited by 2-14% | Zhu et al., 2025 [9] | Protocol-level fairness constraints |
| Domain focus beats opponent modeling | ANAC 2024 [32] | Template-based negotiation with market data |
| 95% auto-agreement rate in structured domains | NEC, 2025 [38] | Templates enable high automation |
| Agents deceived about own costs | Kirshner et al., 2026 [39] | Resource costs visible to both parties |

### 7.2 Negotiation Flow

```
Client                              Provider
  │                                    │
  ├── PROPOSE (template + params) ────►│
  │                                    │
  │◄── COUNTER (modified params) ──────┤  (up to max_rounds)
  │                                    │
  ├── ACCEPT ─────────────────────────►│
  │        or                          │
  ├── COUNTER (modified params) ──────►│
  │        or                          │
  ├── REJECT ─────────────────────────►│
  │                                    │
```

Each negotiation message is a structured JSON document, not free text:

```json
{
  "negotiation_id": "neg-abc123",
  "round": 2,
  "action": "counter",
  "proposed_changes": {
    "quality_criteria.dimensions[0].slo.value": 80,  // was 85
    "service.constraints.max_duration_seconds": 7200,  // was 3600
    "escrow.payment.amount": "6.00"  // was 5.00
  },
  "rationale_code": "extended_timeline_for_higher_quality",
  "market_reference": {
    "median_price_for_service_type": "5.50",
    "source": "arp_market_data"
  }
}
```

### 7.3 Fairness Constraints

ASA enforces protocol-level fairness to prevent exploitation of weaker agents:

**Price bounds:** Agreement prices must fall within configurable bounds relative to market rates (default: 0.5x-3.0x of ARP-reported median for the service type). Agreements outside these bounds are flagged but not blocked — the flag is visible to both parties and recorded in the agreement metadata.

**Asymmetry limits:** No single negotiation round can shift terms by more than a configurable percentage (default: 25% change per round) on any dimension, preventing sudden exploitative swings.

**Transparent costs:** Provider resource constraints (token budget, compute cost, API call limits) are visible in the agreement. Following the Agent Contracts framework (Ye & Tan, 2026), delegated resource budgets cannot exceed parent allocation and are cryptographically verifiable [40].

**Maximum rounds:** Negotiation is bounded to a configurable maximum number of rounds (default: 5). If no agreement is reached, the session ends with REJECTED status. This prevents indefinite negotiation loops.

---

## 8. Escrow and Payment Integration

### 8.1 Architecture

ASA does not implement its own payment system. Instead, it defines an escrow binding interface that connects agreements to external payment systems:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Agreements  │────►│ Verification │────►│   Escrow     │
│     API      │     │     API      │     │   Binding    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                          ┌───────────────────────┼───────────────┐
                          │                       │               │
                     ┌────▼────┐            ┌────▼────┐    ┌────▼────┐
                     │ERC-8183 │            │  x402   │    │ Custom  │
                     │ Escrow  │            │  Pay    │    │  HTTP   │
                     └─────────┘            └─────────┘    └─────────┘
```

### 8.2 Graduated Payment Release

Unlike ERC-8183's binary pass/fail [2], ASA supports graduated payment based on quality scores:

| Composite Score | Payment Release | Rationale |
|----------------|----------------|-----------|
| ≥ 90 | 100% | Exceeds expectations |
| 75-89 | 85% | Meets agreement threshold |
| 60-74 | 50% | Below threshold but usable |
| < 60 | 0% + dispute option | Below minimum quality |

This addresses a fundamental limitation of existing escrow systems. A research summary that scores 72% — below the agreed threshold but containing significant useful content — should not result in zero payment. Graduated release creates appropriate incentives: providers are rewarded proportionally for partial quality, and clients receive partial compensation for partial delivery.

**Cliff optimization risk.** Graduated tiers introduce a gaming vector: a rational provider's optimal strategy is to deliver quality just above the nearest payment cliff (e.g., scoring 76 rather than 88, since both release 85% but the former costs less effort). ASA mitigates this through three configurable mechanisms:

1. **Continuous payment function (recommended):** Instead of tiers, payment = `(composite_score / 100) * amount`. No cliffs, no optimization targets. Agreements can enable this via `"graduated_release": { "mode": "continuous" }`.
2. **Threshold noise injection:** Small random perturbation (±3 points) of tier boundaries per agreement, preventing providers from reliably targeting a specific score.
3. **Dynamic tiers:** Thresholds adjust based on the provider's historical score distribution — a provider whose scores cluster at 76 sees their 75-tier boundary shift upward.

The default graduated tiers remain available for simplicity, but agreements involving repeated transactions with the same provider SHOULD prefer continuous payment functions to avoid cliff optimization incentives.

**Dispute rate impact.** Graduated payment is expected to reduce dispute rates compared to binary pass/fail. In AB Support's fleet operations, approximately 15-20% of Bravo deliverables score in the 60-74 range (below the ideal threshold but containing significant useful content). Under binary pass/fail, all of these would trigger rejection and potential dispute. Under graduated release, the provider receives 50% payment and the client receives usable (if imperfect) work — both parties are better off than in a dispute scenario. While these fleet-scale numbers are not statistically significant for general claims, they suggest that graduated payment can eliminate disputes for the substantial fraction of deliverables that fall in the "below threshold but usable" range.

### 8.3 Dead-Man's Switch Mechanisms

Agents can crash, lose connectivity, or be decommissioned. ASA implements timeout-based safety mechanisms adapted from Upwork's 14-day auto-release pattern [22]:

**Client timeout:** If the client does not fund escrow within the configured timeout after agreement activation, the agreement transitions to EXPIRED.

**Provider timeout:** If the provider does not deliver within the configured timeout, escrowed funds return to the client.

**Evaluator timeout:** If the evaluator does not return a verification result within the configured timeout, the default action is `hold_for_backup_evaluator` — the system selects an alternate evaluator from the qualified pool (Section 3.6.1). Alternative timeout actions are configurable per agreement: (a) `split_50_50` — neither party benefits from evaluator failure, (b) `return_to_client` — client retains funds when quality is unverified, or (c) `release_to_provider` — available but NOT recommended as default because it creates a moral hazard where providers benefit from evaluator failure, enabling a collusion vector where evaluator deliberately times out and splits proceeds with the provider.

**Challenge timeout:** If neither party challenges a verification result within the challenge window, the result is finalized and payment is released or refunded accordingly.

---

## 9. Trust Ecosystem Integration

### 9.1 Chain of Consciousness (CoC) Integration

ASA uses CoC provenance chains for three purposes:

**Identity verification:** An agent's CoC chain hash serves as its identity in agreements, linking service delivery to a verifiable operational history [11].

**Operational age as trust signal:** CoC chain length indicates how long an agent has been operating continuously. Longer chains imply greater investment in maintaining provenance, which serves as an honest signal in agreement negotiation — following the biological costly signaling framework formalized in ARP v2 [12].

**Evidence anchoring:** Verification results can be appended to the CoC chain, creating an immutable record of quality assessments. This provides forensic evidence for AJP dispute resolution and longitudinal data for ARP reputation scoring.

### 9.2 Agent Rating Protocol (ARP) Integration

ASA and ARP form a bidirectional feedback loop:

**ARP → ASA (reputation informs agreements):**
- Provider reputation scores are available during negotiation, enabling risk-adjusted terms
- Higher-rated providers can negotiate better rates (market data from ARP)
- Verification depth scales with reputation — trusted providers need lighter verification

**ASA → ARP (verification feeds reputation):**
- Verification pass rates are reported to ARP as quality signals
- Composite scores contribute to ARP dimension calculations
- Agreement completion history (on-time, quality, disputes) feeds ARP's behavioral consistency dimension

### 9.3 Agent Justice Protocol (AJP) Integration

ASA connects to AJP at two points:

**Automatic dispute filing:** When verification scores fall below the agreement's dispute threshold AND the challenge window expires without resolution, ASA files an AJP dispute automatically. The dispute package includes the agreement document, deliverable content hash, verification result with evidence trail, and both parties' identities.

**Forensic evidence:** AJP's forensics engine can request the full ASA verification trail — every dimension score, every piece of evaluator evidence, every canary task result — as evidence for investigation.

---

## 10. Game Theory of Bilateral Agreements

### 10.1 The Bilateral Agreement as a Game

An ASA agreement between Client C and Provider P is a cooperative game where both parties benefit from successful completion but have divergent incentives regarding quality level and price.

**Client's utility:** U_C = V(quality) - price - verification_cost
Where V(quality) is the value the client derives from the deliverable, increasing in quality.

**Provider's utility:** U_P = price - cost(quality) - collateral_risk
Where cost(quality) increases with quality level, and collateral_risk is the expected loss from escrow slashing.

**Nash Bargaining Solution:** The optimal agreement maximizes the product of both parties' surplus over their disagreement payoff (BATNA — Best Alternative To Negotiated Agreement) [41]:

```
max (U_C - d_C)(U_P - d_P)
```

Where d_C is the client's BATNA (find another provider or do the work itself) and d_P is the provider's BATNA (find another client or idle).

### 10.2 Incentive Alignment Through Protocol-Enforced Agreements

ASA's protocol-enforced design aligns incentives through three mechanisms:

**Proportional stakes:** Graduated payment release ensures that quality improvements always increase provider revenue. A provider scoring 88% receives more than one scoring 76%. This eliminates the binary cliff where a 74% score and a 10% score produce identical zero-payment outcomes.

**Reputation effects:** Because ASA verification results feed into ARP, every agreement has reputational consequences beyond the immediate transaction. A provider that consistently delivers 60% quality will see declining reputation scores, reducing future negotiation power. This dynamic converts one-shot games into iterated games with cooperative equilibria.

**Collateral bonding:** Staking/slashing mechanisms (following Outlier Ventures' framework [42]) create direct financial accountability. The cost of cheating — delivering low quality and absorbing the escrow slash — must exceed the cost of performing the work properly. For this inequality to hold, collateral must be proportional to agreement value, not nominal (avoiding the cloud credit problem).

### 10.3 Conditions for Stable Agreements

Not all agent pairs can form mutually beneficial agreements. Stable agreements require:

1. **Mutual surplus:** Both parties must be better off in the agreement than at their BATNA. If Provider P can earn more elsewhere, or Client C can get the work done cheaper, no agreement zone exists.

2. **Verifiable quality:** The quality criteria must be measurable by the chosen evaluator at a cost that does not consume the entire transaction value. Verification cost sets a floor on economically viable agreement size.

3. **Credible enforcement:** The escrow/slashing mechanism must be credible — the provider must believe that poor quality will actually result in economic loss. This requires either on-chain enforcement (smart contracts cannot be overridden) or a trusted escrow operator.

4. **Information symmetry:** Both parties must have access to market rates, provider reputation, and task complexity estimates. Asymmetric information enables exploitation — as demonstrated by Zhu et al.'s finding that stronger agents exploit weaker ones by up to 14% [9].

### 10.4 Limitations and Honest Assessment

ASA does not claim to solve all game-theoretic challenges in agent commerce. Several open problems remain:

**Collusion resistance:** If the evaluator colludes with either party, the verification result is corrupted. Multi-evaluator consensus reduces but does not eliminate this risk. A formal mechanism design proof of collusion resistance is beyond this protocol's scope.

**Sybil attacks on reputation:** An agent could create multiple identities to reset a poor reputation. ASA inherits the Sybil resistance properties of its underlying identity system — CoC chains make Sybil attacks expensive (maintaining parallel chains), but API-key-based identities are trivially sybilable.

**Quality dimension manipulation:** Even with multi-dimensional scoring, a sufficiently capable agent could learn to produce outputs that score well on measured dimensions while being suboptimal on unmeasured ones. The shadow metric mechanism detects simple cases, but adversarial quality gaming at the frontier remains an open research problem.

---

## 11. Competitive Landscape

### 11.1 SLA Specification

| System | Agent-Specific | Machine-Readable | Enforcement | Multi-Dimensional | Status |
|--------|---------------|-----------------|-------------|-------------------|--------|
| ITIL 4 SLM [18] | No | No | Manual | No | Mature, infrastructure |
| WSLA (IBM, 2003) [43] | No | XML | Monitoring | Limited | Legacy |
| WS-Agreement (OGF, 2007) [44] | No | XML | Templates | Limited | Legacy |
| SLAC (Uriarte et al., 2015) [45] | No | Formal DSL | Dynamic | Yes | Academic |
| AgentSLA DSL (2025) [1] | Yes | JSON | None | Yes (40+ metrics) | Academic, pre-production |
| Mayer Brown Framework (2026) [24] | Partial | Legal prose | Legal remedies | Yes (6 components) | Legal analysis |
| **ASA (this work)** | **Yes** | **JSON** | **Automated (escrow)** | **Yes (configurable)** | **Protocol specification** |

AgentSLA is the closest prior work. ASA extends AgentSLA's specification approach by adding enforcement (escrow binding), negotiation (structured protocol), and verification (Agent-as-a-Judge integration). The two are complementary: AgentSLA's quality model and DSL syntax could serve as the specification layer within ASA agreements.

### 11.2 Quality Verification

| System | Semantic Quality | Automated | Multi-Dimensional | Agent-Native | Cost/Eval |
|--------|-----------------|-----------|-------------------|-------------|-----------|
| PayCrow [17] | No (structural) | Yes | No (binary) | Yes | 2% of tx |
| ERC-8183 [2] | Evaluator-dependent | Yes | No (binary) | Yes | Gas fees |
| SonarQube [20] | Code only | Yes | Yes (3+) | No | Free/$$$ |
| LLM-as-a-Judge [33] | Yes | Yes | Configurable | Adaptable | $0.01-5 |
| Agent-as-a-Judge [65][4] | Yes (~90% code; 60-68% specialized) | Yes | Yes (5 methods) | Yes | $0.03-31 |
| **ASA Verification API** | **Yes (tiered; ~90% code, 60-68% specialized)** | **Yes** | **Yes (configurable)** | **Yes** | **$0.01-31** |

ASA's Verification API differentiates by offering tiered depth (structural/semantic/composite), configurable dimensions, standalone operation without requiring an agreement, and integration with escrow for automated enforcement.

### 11.3 Agent Commerce Infrastructure

| System | Agreements | Verification | Payment | Negotiation | Reputation |
|--------|-----------|-------------|---------|-------------|-----------|
| x402 [14] | No | No | Yes (HTTP 402) | No | No |
| ERC-8183 [2] | Partial (job) | External | Yes (escrow) | No | Via ERC-8004 |
| ACP/AP2/TAP [46] | No | No | Yes (card/crypto) | No | No |
| Fetch.ai AEA [47] | Discovery | No | Yes (FET) | Discovery | FET staking |
| Pactum [48] | Procurement | No | Via client | Yes (AI-led) | No |
| Circle AI Escrow [49] | PDF parsing | Image analysis | Yes (USDC) | No | No |
| **ASA** | **Full protocol** | **Multi-tier** | **Via binding** | **Structured** | **Via ARP** |

No existing system covers the full stack from negotiation through agreement to verification to enforcement. Pactum handles procurement negotiation but not quality verification. ERC-8183 handles escrow but not negotiation or quality specification. x402 handles payment but not agreements. ASA's contribution is integration — connecting these capabilities into a coherent protocol flow.

### 11.4 Positioning: Coordination Layer, Not Competitor

ASA is designed to work *with* existing infrastructure, not to replace it. An ASA agreement can:
- Use x402 or ACP for payment
- Use ERC-8183 or PayCrow for escrow
- Use AgentSLA's quality model for specification
- Use A2A or MCP for agent communication
- Use ERC-8004 or CoC for identity
- Use Kleros or AJP for disputes

ASA provides the agreement logic that connects these components. Its competitive advantage is *integration* and *openness*, not proprietary infrastructure lock-in.

---

## 12. Security Analysis

### 12.1 Threat Model

ASA faces threats from three adversary types:

**Malicious Provider:** Delivers low-quality output, attempts to game verification metrics, or colludes with evaluator.

**Malicious Client:** Rejects satisfactory work to avoid payment, files frivolous disputes, or manipulates negotiation.

**Malicious Evaluator:** Returns biased verification results — either to help a colluding party or to extract bribes.

### 12.2 Attack Vectors and Mitigations

| Attack | Vector | Mitigation |
|--------|--------|-----------|
| **Quality gaming** | Provider optimizes for measured metrics while degrading unmeasured quality | Shadow metrics detect harm displacement; multi-dimensional scoring raises gaming cost; canary tasks detect systematic gaming |
| **Evaluator collusion** | Evaluator and provider agree to inflate scores | Evaluator rotation; canary tasks with known scores; multi-evaluator consensus for high-value agreements |
| **Prompt injection in negotiation** | Agent embeds instructions in negotiation messages to manipulate opponent's LLM | Structured JSON fields (not free-text); rationale_code from fixed enum; no raw text injection points |
| **Sybil reputation laundering** | Agent creates fresh identity after accumulating poor reputation | CoC chains make identity creation expensive; minimum chain length for agreement eligibility; cross-reference verification histories |
| **Denial-of-evaluation** | Evaluator goes offline to block payment release | Dead-man's switch with configurable timeout; backup evaluator specification; timeout-action defaults |
| **Verification cost attack** | Client requests verification with evaluation cost exceeding agreement value | Verification cost bounds specified in agreement; evaluator rejects requests exceeding cost cap |
| **Deliverable swap** | Provider submits one deliverable for verification but delivers a different one to client | Content hash binding — deliverable hash is recorded in both the verification request and escrow system; hash mismatch invalidates verification |
| **Replay attack** | Resubmitting a previous verification result for a new deliverable | Each verification result includes agreement_id, deliverable content hash, and timestamp; duplicate detection prevents replay |

### 12.3 Goodhart's Law Resistance

Goodhart's Law — "when a measure becomes a target, it ceases to be a good measure" [19] — is the most fundamental threat to any quality-based agreement system. ASA addresses it at three levels:

**Metric balance:** Every target metric is paired with a shadow metric measuring the expected harm displacement. If accuracy is targeted, hallucination rate is the shadow. If speed is targeted, quality is the shadow. An agent that games accuracy by producing verbose outputs that cover all bases would see its conciseness shadow metric degrade.

**Evaluator adaptability:** Agent-as-a-Judge evaluators are not constrained to the specified dimensions. The evaluator's evidence field can flag quality issues beyond the formal criteria. While these flags don't directly affect scoring, they are recorded in the verification trail and available for dispute evidence and reputation analysis.

**Temporal rotation:** Agreement templates and quality rubrics are versioned and evolve. A provider that overfits to rubric v1's evaluation patterns faces degraded performance when rubric v2 is deployed. This creates a Red Queen dynamic that penalizes gaming relative to genuine quality improvement.

### 12.4 Privacy Considerations

ASA verification results contain information about deliverable quality that may be commercially sensitive. The protocol provides:

**Result visibility control:** Agreements specify who can query verification results (parties only, parties + ARP system, or public).

**Aggregation for reputation:** When ASA reports to ARP, it sends aggregate statistics (pass rate, average composite score) rather than individual verification details.

**Content isolation:** The verification API receives deliverable content for evaluation but does not store it. Only the content hash persists in the verification result. Evaluators must delete deliverable content after evaluation.

---

## 13. Reference Implementation

### 13.1 AB Support Fleet as Prototype

The AB Support fleet has operated an informal ASA since March 2026. The six-agent fleet processes tasks following the ASA lifecycle:

| ASA Concept | Fleet Implementation |
|-------------|---------------------|
| Agreement | Structured task specifications with deliverables, constraints, and quality criteria |
| Quality Dimensions | Six dimensions: breadth, depth, accuracy, sources, cross-references, writing quality |
| SLO | Minimum score of 60/100 per dimension; average ≥ 60 to accept |
| Verification | Alex (coordinator) reviews using Agent-as-a-Judge evaluation |
| Graduated response | Score ≥ 60: accept and promote. Score < 60: return to Bravo with specific revision requests |
| Evidence trail | Verification results stored in structured quality tracking documents |
| Reputation feedback | Bravo's track record informs future task assignment complexity |

This prototype validates several ASA design decisions:
- Multi-dimensional scoring catches quality issues that a single metric would miss
- Written quality criteria (in structured task specifications) produce measurably better output than vague instructions
- Graduated response (accept with notes vs. reject for revision) is more efficient than binary pass/fail
- Evaluator evidence (specific critique with examples) enables targeted improvement

### 13.2 Implementation Roadmap

The reference implementation will be delivered as:

1. **Python library (`asa-protocol`):** Agreement creation, validation, signing, and lifecycle management. Verification client with pluggable evaluator backends.
2. **Evaluator reference implementation:** Agent-as-a-Judge evaluator using Claude or equivalent LLM, with configurable rubrics and dimension definitions.
3. **Escrow binding adapters:** ERC-8183 (Solidity), x402 (HTTP), and HTTP callback bindings.
4. **CLI tool:** Command-line interface for creating agreements from templates, submitting deliverables, and querying verification results.
5. **Integration tests:** End-to-end tests covering the full agreement lifecycle from negotiation through verification to payment release.

---

## 14. Future Work

### 14.1 Real-Time Quality Monitoring

Current ASA verification is post-hoc — quality is assessed after delivery. Future versions should support real-time quality monitoring during task execution, enabling early termination of failing work before costs accumulate. This follows Newgen's agentic SRM pattern of predictive breach detection [50] and Sirion AI's ML-based violation forecasting [51].

### 14.2 Verification Cost Reduction

Agent-as-a-Judge evaluation costs $0.03-31 per evaluation [65]. At scale with millions of agent transactions, this must decrease by orders of magnitude. Research directions include:
- Lightweight fine-tuned evaluator models (PROMETHEUS-style [35]) with lower inference cost
- Reward model proxies trained on ASA verification data
- Progressive verification (structural first, semantic only for borderline cases)
- Verification caching for repeated service types

### 14.3 Cross-Domain Quality Standards

ASA's default quality dimensions are tuned for the service types most common in current agent commerce (research, code, analysis). As agent services diversify, domain-specific quality frameworks will be needed for creative content, financial analysis, medical information, legal reasoning, and other specialized domains.

### 14.4 Formal Mechanism Design Proofs

This whitepaper provides informal game-theoretic analysis. Formal mechanism design proofs — showing that ASA's incentive structure is strategyproof, individually rational, and efficient under specific conditions — would strengthen the protocol's theoretical foundations.

### 14.5 Scalability Analysis

ASA's resource requirements scale with three primary axes: agreement storage, verification throughput, and negotiation load.

| Deployment Scale | Agents | Agreements/day | Storage/year | Concurrent Evaluators | Canary Overhead |
|-----------------|--------|----------------|-------------|----------------------|----------------|
| **Small** | 100 | 1,000 | ~7 GB | 1-3 | ~$60/day |
| **Medium** | 10,000 | 100,000 | ~730 GB | 30-330 | ~$6,000/day |
| **Large** | 1,000,000 | 10,000,000 | ~73 TB | 3,000-33,000 | ~$600,000/day |

**Assumptions:** Agreement documents average ~2 KB; verification results average ~1 KB; semantic verification takes 10-120 seconds per evaluation; canary tasks run at 1 per 5 deliveries (20% overhead); evaluator cost averages $0.30 per evaluation.

**Key scalability concerns:**

- **Storage:** At medium scale, agreement and verification data requires archival/pruning policies. Completed agreements older than a configurable retention period (default: 1 year) should be compressed and moved to cold storage, retaining only hashes and composite scores for ARP reputation feeds.
- **Verification throughput:** At 100K agreements/day with semantic verification, the system needs 30-330 concurrent evaluator instances depending on verification latency. Evaluator infrastructure cost and availability become the primary bottleneck. Progressive verification (structural first, semantic only for borderline or high-value cases) can reduce evaluator load by 60-80%.
- **Negotiation state:** With 5-round negotiation at machine speed, burst loads of thousands of concurrent sessions are possible. The negotiation API should be stateless (session state stored in the agreement document itself) to enable horizontal scaling.
- **Canary task overhead:** At 20% of evaluations, canary costs are significant at scale. A trust-based reduction path — reducing canary frequency to 1-per-20 for evaluators with >95% canary pass rates — can reduce overhead by 75% for established evaluators.

### 14.6 Standardization

ASA's agreement format should be submitted for standardization through appropriate bodies. Candidates include the Agentic AI Foundation (AAIF) for protocol integration with MCP/A2A, the W3C AI Agent Protocol Community Group for web-native agent agreements, and ISO for international standardization (building on ISO/IEC 25010 quality model and ISO/IEC 42001 AI management).

---

## 15. Conclusion

The agent economy has payment rails, communication channels, and identity registries. It lacks a standardized way to form, verify, and enforce service agreements. ASA fills this gap with two API surfaces — Agreements for machine-readable contracts and Verification for quality evaluation — connected by protocol-enforced logic that collapses the traditional specify-monitor-detect-claim-compensate pipeline into an atomic operation.

The protocol draws on mature building blocks: AgentSLA's ISO 25010 extension for quality specification [1], Agent-as-a-Judge for semantic evaluation achieving approximately 90% human agreement in code generation [65] with lower rates in specialized domains [36], ERC-8183's three-party escrow model for payment enforcement [2], and Ricardian contracts' dual human/machine-readable format for legal defensibility [3]. ASA's contribution is integration — connecting specification to negotiation to verification to payment in a coherent, open protocol.

Three design choices define ASA's character. First, *outcomes over uptime* — quality is measured by what was delivered, not whether the server was running, following the industry shift from SLAs to XLAs [23][24]. Second, *graduated over binary* — partial quality receives partial payment, creating continuous incentives for improvement rather than cliff effects. Third, *open integration over proprietary lock-in* — ASA works with any identity system, any payment rail, and any escrow platform, specifying agreement logic without mandating infrastructure.

The protocol is production-informed. AB Support's six-agent fleet has operated an informal ASA since March 2026, validating multi-dimensional quality scoring, structured task specification, and Agent-as-a-Judge evaluation in daily operations. Formalizing these patterns into an open protocol extends their value to any agent ecosystem.

Challenges remain. Semantic quality verification, while achieving approximately 90% human agreement in code generation [65], drops to 60-68% in specialized domains [36] and has documented biases. Goodhart's Law guarantees that measured metrics will be gamed by sufficiently capable agents [19]. Collusion resistance under arbitrary adversarial conditions lacks formal proof. These are honest limitations, not hidden weaknesses — and they define the protocol's research frontier.

The building blocks for agent service agreements are surprisingly mature. The gap is integration. ASA provides that integration.

---

## 16. References

[1] Jouneaux, G. & Cabot, J. (2025). "AgentSLA: Towards a Service Level Agreement for AI Agents." Luxembourg Institute of Science and Technology. arXiv:2511.02885.

[2] Ethereum EIPs (2026). "ERC-8183: Agentic Commerce — Programmable Escrow for AI Agents." eips.ethereum.org/EIPS/eip-8183.

[3] Grigg, I. (1996). "The Ricardian Contract." iang.org.

[4] You, R., Cai, H., Zhang, C. et al. (2026). "A Survey on Agent-as-a-Judge." arXiv:2601.05111.

[5] Rogers, O. (2022). "Cloud SLAs punish, not compensate." Uptime Institute Journal.

[6] AWS (2025). "What is SLA? — Service Level Agreement Explained." aws.amazon.com.

[7] Outlier Ventures (2025). "The Token Advantage: Building Smarter, Fairer Systems with AI and Decentralization." outlierventures.io.

[8] Vaccaro, M. et al. (2025). "Large-Scale Autonomous Negotiation Competition." MIT Sloan / Johns Hopkins. arXiv:2503.06416.

[9] Zhu, Y. et al. (2025). "The Automated but Risky Game." arXiv:2506.00073.

[10] Shah, P. et al. (2025). "LLM Rationalis?" NeurIPS 2025. arXiv:2512.13063.

[11] AB Support (2026). "Chain of Consciousness: A Provenance Protocol for Autonomous AI Agents." v3.0.

[12] AB Support (2026). "Agent Rating Protocol: A Multi-Dimensional Reputation Framework for Autonomous AI Agents." v1.0.

[13] QuickNode Blog (2026). "ERC-8004: A Developer's Guide to Trustless AI Agent Identity."

[14] Solana.com (2026). "What is x402? | Payment Protocol for AI Agents." x402.org.

[15] Google Developers Blog (2025). "Announcing the Agent2Agent Protocol (A2A)."

[16] Linux Foundation (2025). "Agentic AI Foundation (AAIF) Formation." linuxfoundation.org.

[17] Dev|Journal (2026). "PayCrow Escrow for x402 Agent Payments." Note: the $600M+ figure cited in some sources refers to total x402 ecosystem volume, not PayCrow's secured amount.

[18] AWS (2025). "What is SLA? — Service Level Agreement Explained." Per ITIL 4 definition.

[19] Goodhart, C. (1975). "Problems of Monetary Management: The U.K. Experience." As reformulated by Strathern, M. (1997): "When a measure becomes a target, it ceases to be a good measure."

[20] Sonar Documentation (2026). "Understanding quality gates." docs.sonarsource.com.

[21] Daniel, F. et al. (2018). "Quality Control in Crowdsourcing: A Survey." ACM Computing Surveys, Vol 51.

[22] Upwork Help Center (2026). "How Fixed-Price Payment Protection works." support.upwork.com.

[23] XLA Institute (2025). "State of XLA 2025." xla.institute.

[24] George, R.P., Pennell, J., Peterson, B.L., Yaros, O. (2026). "Contracting for Agentic AI Solutions: Shifting the Model from SaaS to Services." Mayer Brown.

[25] ISO/IEC 25010:2023. "Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model."

[26] DeepSource (2025). "Code Quality — Five-Dimension Analysis." deepsource.com.

[27] Codility Support (2026). "Automated Scoring Principles." support.codility.com.

[28] arXiv 2601.00481 (2026). "MAESTRO: Multi-Agent Evaluation Suite for Testing, Reliability, and Observability."

[29] arXiv 2602.03053 (2026). "MAS-ProVe: Understanding Process Verification of Multi-Agent Systems."

[30] Fiverr Help Center (2026). "Seller levels overview." help.fiverr.com.

[31] Accord Project (2025). "Smart Legal Contract Templates." accordproject.org.

[32] ANAC 2024 (2025). "15th Automated Negotiating Agents Competition." AAMAS 2025.

[33] Zheng, L. et al. (2023). "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena." arXiv:2306.05685.

[34] AWS (2025). "What is RLHF?" aws.amazon.com.

[35] Kim, S. et al. (2024). "Prometheus: Inducing Fine-grained Evaluation Capability in Language Models." ICLR 2024. arXiv:2310.08491.

[36] IJCNLP (2025). Domain-specific LLM-as-Judge agreement rates. As cited in Li et al. (2024), arXiv:2412.05579.

[37] arXiv:2410.09770 (2024). "Quis custodiet ipsos custodes? AI-generated peer reviews."

[38] NEC Press Release (2025). "NEC Launches AI Agent Service for Procurement Negotiations."

[39] Kirshner, S. et al. (2026). "Talking Terms: LLM Supply Chain Bargaining." Decision Sciences, Vol. 57, 9-23.

[40] Ye, J. & Tan, Z. (2026). "Agent Contracts: Formal Framework for Resource-Bounded AI." arXiv:2601.08815.

[41] Nash, J.F. (1950). "The Bargaining Problem." Econometrica, 18(2), 155-162.

[42] Outlier Ventures (2025). "From Smart Contracts to Smart Agents: The Rise of the Agentic Layer." outlierventures.io.

[43] Keller, A. & Ludwig, H. (2003). "The WSLA Framework: Specifying and Monitoring Service Level Agreements for Web Services." IBM. Journal of Network and Systems Management.

[44] OGF (2007). "WS-Agreement Specification." Open Grid Forum.

[45] Uriarte, R.B., Tiezzi, F., De Nicola, R. (2015). "SLAC: A Formal Service-Level-Agreement Language for Cloud Computing." IEEE.

[46] PayRam (2026). "ACP vs. AP2 vs. TAP: The Protocol Wars of Agentic Commerce."

[47] Fetch.ai (2025). "Autonomous Economic Agents (AEA) Framework." fetch.ai.

[48] Pactum (2025). "Understanding Agentic AI in Procurement." pactum.com.

[49] ZenML (2025). "Circle: AI-Powered Escrow Agent for Programmable Money Settlement."

[50] Newgen (2025). "AI Agent-driven SLA Management." newgensoft.com.

[51] Sirion AI (2025). "Automated SLA Breach Alerts for Telecom Service Contracts." sirion.ai.

[52] Uriarte, R.B., De Nicola, R. et al. (2021). "Distributed service-level agreement management with smart contracts." Concurrency and Computation, Wiley.

[53] Booth, A., Alqahtani, A., Solaiman, E. (2024). "IoT Monitoring with Blockchain." arXiv:2408.15016.

[54] Chainlink (2025). "Chainlink: The Industry-Standard Oracle Platform." chain.link.

[55] Bianchi, F. et al. (2024). "NegotiationArena." ICML 2024. arXiv:2402.05863.

[56] Liu, Z., Gu, H., Song, Z. (2026). "AgenticPay." ICML 2026. arXiv:2602.06008.

[57] Hua, W. et al. (2024). "Game-Theoretic LLM: Agent Workflow for Negotiation Games." arXiv:2411.05990.

[58] Proofpoint (2026). "Agent Integrity Framework — 2026 Edition."

[59] PwC (2026). "Validating multi-agent AI systems." pwc.com.

[60] Proskauer Rose (2025). "Contract Law in the Age of Agentic AI."

[61] RNWY Group (2025). "AI Agents and Electronic Contracts: The Laws Already Say 'Yes'."

[62] CCN (2026). "ERC-8183 Programmable Escrow AI Agents."

[63] Kleros (2025). "Decentralized Arbitration." kleros.io.

[64] Moritz College of Law, Ohio State (2022). "Kleros: A Socio-Legal Case Study of Decentralized Justice and Blockchain Arbitration."

[65] Zhuge, M., Liu, C., Pan, Z. et al. (2024). "Agent-as-a-Judge: Evaluate Agents with Agents." arXiv:2410.10934. Note: primary source for the ~90% human agreement figure in code generation evaluation tasks.

---

*This document is licensed under the Apache License 2.0. You may use, modify, and distribute this work with attribution to AB Support LLC.*

*The protocol specification, data models, and API definitions contained herein are provided as an open standard for the agent economy. No patent claims are made or implied.*

*© 2026 AB Support LLC. All rights reserved under the terms of the Apache License 2.0.*
