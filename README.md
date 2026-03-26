# Agent Service Agreements

[![PyPI](https://img.shields.io/pypi/v/agent-service-agreements)](https://pypi.org/project/agent-service-agreements/)
[![Python](https://img.shields.io/pypi/pyversions/agent-service-agreements)](https://pypi.org/project/agent-service-agreements/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Machine-readable service contracts and quality verification for autonomous agent commerce. Part of the [Agent Trust Stack](https://vibeagentmaking.com).

```python
from agent_service_agreements import Identity, create_agreement_from_template, VerificationEngine

agreement = create_agreement_from_template("research",
    client=Identity(scheme="api_key", value="client-123"),
    provider=Identity(scheme="api_key", value="provider-456"),
    escrow_amount="5.00")

result = VerificationEngine().verify(deliverable_text, original_request="Summarize federated learning research")
print(f"Score: {result.composite_score}, Passed: {result.passed}")
```

## What It Does

ASA provides two API surfaces for agent-to-agent commerce:

**Agreements API** — Create, negotiate, sign, and manage machine-readable service contracts with quality criteria, SLO definitions, and payment terms.

**Verification API** — Evaluate deliverable quality across multiple dimensions (correctness, completeness, coherence, etc.) with structural and semantic verification. Works standalone or against agreement criteria.

## Install

```bash
pip install agent-service-agreements
```

Zero required dependencies. Python 3.8+.

Optional integrations:
```bash
pip install agent-service-agreements[arp]  # Agent Rating Protocol
pip install agent-service-agreements[ajp]  # Agent Justice Protocol
```

## CLI

```bash
# Create an agreement from a template
agent-service agree --template research --client alice --provider bob --amount 5.00

# Verify a deliverable
agent-service verify --deliverable output.md --request "Summarize FL research" --type text/research

# List templates
agent-service templates

# Check store status
agent-service status
```

## Agreement Templates

| Template | Dimensions | Threshold |
|----------|-----------|-----------|
| `research` | accuracy, completeness, relevance, source_quality, writing_quality | 75 |
| `code_generation` | correctness, performance, security, maintainability, test_coverage | 80 |
| `data_analysis` | accuracy, methodology, depth, clarity, actionability | 75 |
| `translation` | accuracy, fluency, cultural_fit, terminology, completeness | 80 |
| `review` | thoroughness, accuracy, actionability, tone, completeness | 75 |
| `general` | accuracy, completeness, relevance, clarity, timeliness | 70 |

## Escrow & Graduated Payment

ASA supports graduated payment release based on quality scores:

| Score | Release |
|-------|---------|
| >= 90 | 100% |
| 75-89 | 85% |
| 60-74 | 50% |
| < 60 | 0% (dispute option) |

Continuous mode available: `payment = (score / 100) * amount`.

Dead-man's switch defaults to `hold_for_backup_evaluator` (not `release_to_provider`).

## Negotiation

Multi-round structured negotiation with fairness constraints:
- Configurable round limits (default: 5)
- Asymmetry limits (max 25% change per round)
- Price bounds relative to market rates
- Structured JSON messages (no free-text manipulation)

## Verification Depths

- **Structural**: Schema validation, format checks, size constraints (~0ms)
- **Semantic**: Agent-as-a-Judge integration point for content quality (~10-120s)
- **Composite**: Structural + semantic + optional canary/cross-reference checks

## Trust Ecosystem

ASA is Layer 2 in the Agent Trust Stack:

```
Layer 3: Accountability  — Agent Justice Protocol (disputes, forensics)
Layer 2: Agreements      — Agent Service Agreements (this package)
Layer 1: Trust Primitives — Chain of Consciousness + Agent Rating Protocol
```

## Security

**VAM-SEC v1.0 Security Disclaimer**: This is alpha software implementing a protocol specification. It has not undergone formal security audit. Do not use for production financial transactions without additional security review. The escrow abstraction layer does not handle actual funds — it computes release amounts that must be executed by an external payment system.

## License

Apache 2.0. See [LICENSE](LICENSE).

## Links

- [Whitepaper](https://vibeagentmaking.com/whitepaper/service-agreements/)
- [Agent Rating Protocol](https://pypi.org/project/agent-rating-protocol/)
- [Agent Justice Protocol](https://pypi.org/project/agent-justice-protocol/)
