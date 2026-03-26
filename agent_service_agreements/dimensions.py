"""Quality dimensions for Agent Service Agreements.

Defines the standard quality dimensions used for scoring deliverables:
correctness, completeness, coherence, citation_quality, formatting,
plus domain-specific dimensions. Each scored 1-100, weighted composite.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class QualityDimension:
    """A single quality dimension definition with scoring range 1-100."""
    name: str
    description: str
    min_score: float = 0.0
    max_score: float = 100.0
    default_weight: float = 0.20
    default_threshold: float = 60.0
    category: str = "general"

    def validate_score(self, score: float) -> bool:
        return self.min_score <= score <= self.max_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "min_score": self.min_score,
            "max_score": self.max_score,
            "default_weight": self.default_weight,
            "default_threshold": self.default_threshold,
            "category": self.category,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "QualityDimension":
        return cls(
            name=d["name"],
            description=d.get("description", ""),
            min_score=d.get("min_score", 0.0),
            max_score=d.get("max_score", 100.0),
            default_weight=d.get("default_weight", 0.20),
            default_threshold=d.get("default_threshold", 60.0),
            category=d.get("category", "general"),
        )


# ---------------------------------------------------------------------------
# Standard dimensions (protocol defaults)
# ---------------------------------------------------------------------------

CORRECTNESS = QualityDimension(
    name="correctness",
    description="Factual accuracy and technical correctness of the deliverable",
    default_weight=0.25,
    default_threshold=70.0,
    category="core",
)

COMPLETENESS = QualityDimension(
    name="completeness",
    description="Coverage of all required aspects, sections, and requirements",
    default_weight=0.20,
    default_threshold=60.0,
    category="core",
)

COHERENCE = QualityDimension(
    name="coherence",
    description="Logical consistency, clear structure, and readability",
    default_weight=0.15,
    default_threshold=60.0,
    category="core",
)

CITATION_QUALITY = QualityDimension(
    name="citation_quality",
    description="Quality, relevance, and verifiability of cited sources",
    default_weight=0.15,
    default_threshold=50.0,
    category="research",
)

FORMATTING = QualityDimension(
    name="formatting",
    description="Adherence to format requirements, markup quality, visual presentation",
    default_weight=0.10,
    default_threshold=50.0,
    category="presentation",
)

# Domain-specific dimensions

ACCURACY = QualityDimension(
    name="accuracy",
    description="Precision and correctness of facts, data, and claims",
    default_weight=0.25,
    default_threshold=70.0,
    category="core",
)

RELEVANCE = QualityDimension(
    name="relevance",
    description="How well the output addresses the original request",
    default_weight=0.20,
    default_threshold=70.0,
    category="core",
)

SOURCE_QUALITY = QualityDimension(
    name="source_quality",
    description="Quality, diversity, and recency of referenced sources",
    default_weight=0.15,
    default_threshold=50.0,
    category="research",
)

WRITING_QUALITY = QualityDimension(
    name="writing_quality",
    description="Clarity, conciseness, grammar, and style",
    default_weight=0.10,
    default_threshold=60.0,
    category="presentation",
)

TIMELINESS = QualityDimension(
    name="timeliness",
    description="Whether the deliverable was submitted within the deadline",
    default_weight=0.10,
    default_threshold=100.0,
    category="operational",
)

PERFORMANCE = QualityDimension(
    name="performance",
    description="Runtime efficiency, response time, resource usage",
    default_weight=0.20,
    default_threshold=60.0,
    category="code",
)

SECURITY = QualityDimension(
    name="security",
    description="Absence of vulnerabilities, proper input validation, secure patterns",
    default_weight=0.20,
    default_threshold=70.0,
    category="code",
)

MAINTAINABILITY = QualityDimension(
    name="maintainability",
    description="Code readability, modularity, documentation, test coverage",
    default_weight=0.15,
    default_threshold=60.0,
    category="code",
)

TEST_COVERAGE = QualityDimension(
    name="test_coverage",
    description="Percentage of code paths covered by tests",
    default_weight=0.15,
    default_threshold=60.0,
    category="code",
)

METHODOLOGY = QualityDimension(
    name="methodology",
    description="Soundness of analytical approach and statistical methods",
    default_weight=0.20,
    default_threshold=60.0,
    category="analysis",
)

INSIGHT_QUALITY = QualityDimension(
    name="insight_quality",
    description="Depth, novelty, and actionability of insights",
    default_weight=0.15,
    default_threshold=50.0,
    category="analysis",
)

FLUENCY = QualityDimension(
    name="fluency",
    description="Natural language flow in the target language",
    default_weight=0.25,
    default_threshold=70.0,
    category="translation",
)

CULTURAL_APPROPRIATENESS = QualityDimension(
    name="cultural_appropriateness",
    description="Cultural sensitivity and locale-appropriate adaptation",
    default_weight=0.15,
    default_threshold=60.0,
    category="translation",
)

TERMINOLOGY = QualityDimension(
    name="terminology",
    description="Consistent and correct use of domain terminology",
    default_weight=0.20,
    default_threshold=60.0,
    category="translation",
)

THOROUGHNESS = QualityDimension(
    name="thoroughness",
    description="Depth and breadth of review coverage",
    default_weight=0.25,
    default_threshold=60.0,
    category="review",
)

ACTIONABILITY = QualityDimension(
    name="actionability",
    description="How clear and implementable the recommendations are",
    default_weight=0.20,
    default_threshold=60.0,
    category="review",
)

TONE = QualityDimension(
    name="tone",
    description="Constructiveness and professionalism of feedback",
    default_weight=0.10,
    default_threshold=60.0,
    category="review",
)

CLARITY = QualityDimension(
    name="clarity",
    description="How easily the content can be understood by the target audience",
    default_weight=0.20,
    default_threshold=60.0,
    category="general",
)

VISUALIZATION = QualityDimension(
    name="visualization",
    description="Quality and clarity of charts, graphs, and visual elements",
    default_weight=0.15,
    default_threshold=50.0,
    category="analysis",
)

DEPTH = QualityDimension(
    name="depth",
    description="Level of detail and analytical depth",
    default_weight=0.20,
    default_threshold=60.0,
    category="analysis",
)

DOCUMENTATION = QualityDimension(
    name="documentation",
    description="Quality and completeness of code documentation",
    default_weight=0.15,
    default_threshold=50.0,
    category="code",
)

FORMAT_COMPLIANCE = QualityDimension(
    name="format_compliance",
    description="Adherence to specified data format and schema",
    default_weight=0.15,
    default_threshold=70.0,
    category="data",
)

CONSISTENCY = QualityDimension(
    name="consistency",
    description="Internal consistency of data values and relationships",
    default_weight=0.20,
    default_threshold=60.0,
    category="data",
)

METADATA = QualityDimension(
    name="metadata",
    description="Completeness and accuracy of metadata/documentation",
    default_weight=0.15,
    default_threshold=50.0,
    category="data",
)

CULTURAL_FIT = QualityDimension(
    name="cultural_fit",
    description="Appropriateness for target culture and locale",
    default_weight=0.15,
    default_threshold=60.0,
    category="translation",
)


# ---------------------------------------------------------------------------
# Registry: all built-in dimensions by name
# ---------------------------------------------------------------------------

DIMENSION_REGISTRY: Dict[str, QualityDimension] = {
    d.name: d for d in [
        CORRECTNESS, COMPLETENESS, COHERENCE, CITATION_QUALITY, FORMATTING,
        ACCURACY, RELEVANCE, SOURCE_QUALITY, WRITING_QUALITY, TIMELINESS,
        PERFORMANCE, SECURITY, MAINTAINABILITY, TEST_COVERAGE,
        METHODOLOGY, INSIGHT_QUALITY, VISUALIZATION, DEPTH,
        FLUENCY, CULTURAL_APPROPRIATENESS, TERMINOLOGY, CULTURAL_FIT,
        THOROUGHNESS, ACTIONABILITY, TONE,
        CLARITY, DOCUMENTATION, FORMAT_COMPLIANCE, CONSISTENCY, METADATA,
    ]
}


def get_dimension(name: str) -> Optional[QualityDimension]:
    """Look up a built-in dimension by name."""
    return DIMENSION_REGISTRY.get(name)


def list_dimensions(category: Optional[str] = None) -> List[QualityDimension]:
    """List all built-in dimensions, optionally filtered by category."""
    dims = list(DIMENSION_REGISTRY.values())
    if category:
        dims = [d for d in dims if d.category == category]
    return sorted(dims, key=lambda d: d.name)


def compute_weighted_average(
    scores: Dict[str, float],
    weights: Dict[str, float],
) -> float:
    """Compute weighted average of dimension scores.

    Args:
        scores: {dimension_name: score} mapping
        weights: {dimension_name: weight} mapping (should sum to ~1.0)

    Returns:
        Weighted average score (0-100)
    """
    total_weight = 0.0
    weighted_sum = 0.0
    for name, score in scores.items():
        w = weights.get(name, 0.0)
        weighted_sum += score * w
        total_weight += w
    if total_weight == 0:
        return 0.0
    return weighted_sum / total_weight


def compute_geometric_mean(
    scores: Dict[str, float],
    weights: Dict[str, float],
) -> float:
    """Compute weighted geometric mean of dimension scores."""
    total_weight = 0.0
    log_sum = 0.0
    import math
    for name, score in scores.items():
        w = weights.get(name, 0.0)
        if w <= 0:
            continue
        if score <= 0:
            return 0.0
        log_sum += w * math.log(score)
        total_weight += w
    if total_weight == 0:
        return 0.0
    return math.exp(log_sum / total_weight)


def compute_harmonic_mean(
    scores: Dict[str, float],
    weights: Dict[str, float],
) -> float:
    """Compute weighted harmonic mean of dimension scores."""
    total_weight = 0.0
    reciprocal_sum = 0.0
    for name, score in scores.items():
        w = weights.get(name, 0.0)
        if w <= 0:
            continue
        if score <= 0:
            return 0.0
        reciprocal_sum += w / score
        total_weight += w
    if total_weight == 0 or reciprocal_sum == 0:
        return 0.0
    return total_weight / reciprocal_sum


def compute_composite(
    scores: Dict[str, float],
    weights: Dict[str, float],
    method: str = "weighted_average",
) -> float:
    """Compute composite score using the specified method."""
    if method == "geometric_mean":
        return compute_geometric_mean(scores, weights)
    elif method == "harmonic_mean":
        return compute_harmonic_mean(scores, weights)
    return compute_weighted_average(scores, weights)
