"""CLI entry point for agent-service-agreements.

Commands:
  agree     Create a new agreement from a template
  negotiate Run a negotiation round
  verify    Verify a deliverable's quality
  status    Show local store statistics
"""

import argparse
import json
import sys
from typing import List, Optional

from .schema import Identity, QualityCriteria, QualityDimensionSpec, SLO
from .agreement import Agreement
from .templates import TEMPLATES, create_agreement_from_template, list_templates
from .verification import VerificationEngine, get_standalone_criteria
from .store import AgreementStore


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="agent-service",
        description="Agent Service Agreements — machine-readable contracts "
                    "and quality verification for agent commerce",
    )
    parser.add_argument(
        "--store",
        default=".asa",
        help="Path to the ASA data directory (default: .asa)",
    )

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # agree
    p_agree = sub.add_parser(
        "agree",
        help="Create a new agreement from a template",
    )
    p_agree.add_argument(
        "--template",
        required=True,
        choices=list(TEMPLATES.keys()),
        help="Agreement template type",
    )
    p_agree.add_argument("--client", required=True, help="Client identity value")
    p_agree.add_argument(
        "--client-scheme", default="api_key", help="Client identity scheme (default: api_key)"
    )
    p_agree.add_argument("--provider", required=True, help="Provider identity value")
    p_agree.add_argument(
        "--provider-scheme", default="api_key", help="Provider identity scheme (default: api_key)"
    )
    p_agree.add_argument("--description", default="", help="Service description")
    p_agree.add_argument("--amount", default=None, help="Escrow payment amount")
    p_agree.add_argument("--currency", default="USD", help="Payment currency (default: USD)")
    p_agree.add_argument("--json", action="store_true", help="Output as JSON")

    # negotiate
    p_neg = sub.add_parser("negotiate", help="Submit a negotiation action")
    p_neg.add_argument("--agreement-id", required=True, help="Agreement ID")
    p_neg.add_argument(
        "--action",
        required=True,
        choices=["counter", "accept", "reject"],
        help="Negotiation action",
    )
    p_neg.add_argument("--sender", required=True, help="Sender identity value")
    p_neg.add_argument(
        "--changes",
        default="{}",
        help='JSON dict of proposed changes (for counter action)',
    )
    p_neg.add_argument("--rationale", default="", help="Rationale code")
    p_neg.add_argument("--json", action="store_true", help="Output as JSON")

    # verify
    p_ver = sub.add_parser(
        "verify",
        help="Verify a deliverable's quality",
    )
    p_ver.add_argument(
        "--deliverable",
        required=True,
        help="Path to deliverable file, or '-' for stdin",
    )
    p_ver.add_argument("--request", default="", help="Original request description")
    p_ver.add_argument("--agreement-id", default="", help="Agreement ID (optional)")
    p_ver.add_argument(
        "--type",
        default="general",
        dest="deliverable_type",
        choices=["text/research", "text/analysis", "code", "data", "translation", "general"],
        help="Deliverable type for standalone verification",
    )
    p_ver.add_argument("--json", action="store_true", help="Output as JSON")

    # status
    p_status = sub.add_parser("status", help="Show local store statistics")
    p_status.add_argument("--json", action="store_true", help="Output as JSON")

    # templates
    sub.add_parser("templates", help="List available agreement templates")

    return parser


def _cmd_agree(args: argparse.Namespace) -> int:
    store = AgreementStore(args.store)

    client = Identity(scheme=args.client_scheme, value=args.client)
    provider = Identity(scheme=args.provider_scheme, value=args.provider)

    agreement = create_agreement_from_template(
        template_name=args.template,
        client=client,
        provider=provider,
        description=args.description,
        escrow_amount=args.amount,
        escrow_currency=args.currency,
    )

    agreement.compute_hash()
    store.append_agreement(agreement)

    if args.json:
        print(json.dumps(agreement.to_dict(), indent=2))
    else:
        print(f"Agreement created: {agreement.agreement_id}")
        print(f"  Template: {args.template}")
        print(f"  Client: {args.client}")
        print(f"  Provider: {args.provider}")
        print(f"  Status: {agreement.status}")
        if agreement.quality_criteria:
            dims = ", ".join(d.name for d in agreement.quality_criteria.dimensions)
            print(f"  Dimensions: {dims}")
            print(f"  Threshold: {agreement.quality_criteria.composite_threshold}")
        if args.amount:
            print(f"  Escrow: {args.amount} {args.currency}")
        print(f"  Hash: {agreement.agreement_hash[:16]}...")

    return 0


def _cmd_negotiate(args: argparse.Namespace) -> int:
    store = AgreementStore(args.store)

    agreement = store.get_agreement(args.agreement_id)
    if agreement is None:
        print(f"Error: Agreement {args.agreement_id} not found", file=sys.stderr)
        return 1

    from .negotiation import NegotiationSession
    from .schema import NegotiationMessage

    sender = Identity(scheme="api_key", value=args.sender)

    if args.action == "accept":
        msg = NegotiationMessage(
            agreement_id=args.agreement_id,
            action="accept",
            sender=sender,
        )
        msg.compute_hash()
        agreement.status = "proposed"  # Ready for signing
    elif args.action == "reject":
        msg = NegotiationMessage(
            agreement_id=args.agreement_id,
            action="reject",
            sender=sender,
            rationale_code=args.rationale,
        )
        msg.compute_hash()
        agreement.status = "rejected"
    else:
        try:
            changes = json.loads(args.changes)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in --changes argument: {e}", file=sys.stderr)
            return 1
        msg = NegotiationMessage(
            agreement_id=args.agreement_id,
            action="counter",
            sender=sender,
            proposed_changes=changes,
            rationale_code=args.rationale,
        )
        msg.compute_hash()
        agreement.status = "negotiating"

    store.append_negotiation(msg)
    store.append_agreement(agreement)

    if args.json:
        print(json.dumps(msg.to_dict(), indent=2))
    else:
        print(f"Negotiation: {msg.action}")
        print(f"  Agreement: {args.agreement_id}")
        print(f"  Sender: {args.sender}")
        if args.action == "counter":
            print(f"  Changes: {args.changes}")
        print(f"  Message hash: {msg.message_hash[:16]}...")

    return 0


def _cmd_verify(args: argparse.Namespace) -> int:
    store = AgreementStore(args.store)

    # Read deliverable
    if args.deliverable == "-":
        deliverable = sys.stdin.read()
    else:
        try:
            with open(args.deliverable, "r", encoding="utf-8") as f:
                deliverable = f.read()
        except (FileNotFoundError, IsADirectoryError, PermissionError) as e:
            print(f"Error reading deliverable: {e}", file=sys.stderr)
            return 1

    # Look up agreement if specified
    agreement = None
    if args.agreement_id:
        agreement = store.get_agreement(args.agreement_id)
        if agreement is None:
            print(f"Warning: Agreement {args.agreement_id} not found, using standalone mode",
                  file=sys.stderr)

    engine = VerificationEngine()
    result = engine.verify(
        deliverable=deliverable,
        original_request=args.request,
        agreement=agreement,
        deliverable_type=args.deliverable_type,
    )

    store.append_verification(result)

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print(f"Verification: {result.verification_id}")
        print(f"  Result: {result.determination}")
        print(f"  Composite: {result.composite_score:.1f} "
              f"(threshold: {result.composite_threshold})")
        print(f"  Dimensions:")
        for dim in result.dimensions:
            slo_str = ""
            if dim.slo_met is not None:
                slo_str = f" [SLO {'MET' if dim.slo_met else 'MISSED'}]"
            print(f"    {dim.name}: {dim.score:.1f}{slo_str}")
        if result.payment_release_percent > 0:
            print(f"  Payment release: {result.payment_release_percent:.0f}%")
        print(f"  Hash: {result.result_hash[:16]}...")

    return 0


def _cmd_status(args: argparse.Namespace) -> int:
    store = AgreementStore(args.store)
    stats = store.stats()

    if args.json:
        print(json.dumps(stats, indent=2))
    else:
        print("Agent Service Agreements — Store Status")
        print(f"  Directory: {stats['directory']}")
        print(f"  Agreements: {stats['agreements']['count']} "
              f"({stats['agreements']['file_size_bytes']} bytes)")
        print(f"  Negotiations: {stats['negotiations']['count']} "
              f"({stats['negotiations']['file_size_bytes']} bytes)")
        print(f"  Verifications: {stats['verifications']['count']} "
              f"({stats['verifications']['file_size_bytes']} bytes)")
        print(f"  Escrow states: {stats['escrow']['count']} "
              f"({stats['escrow']['file_size_bytes']} bytes)")

    return 0


def _cmd_templates(args: argparse.Namespace) -> int:
    print("Available agreement templates:\n")
    for name in sorted(TEMPLATES.keys()):
        tmpl = TEMPLATES[name]
        dims = [d["name"] for d in tmpl["dimensions"]]
        print(f"  {name}")
        print(f"    {tmpl['description']}")
        print(f"    Dimensions: {', '.join(dims)}")
        print(f"    Threshold: {tmpl['composite_threshold']}")
        print()
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 0

    handlers = {
        "agree": _cmd_agree,
        "negotiate": _cmd_negotiate,
        "verify": _cmd_verify,
        "status": _cmd_status,
        "templates": _cmd_templates,
    }

    handler = handlers.get(args.command)
    if handler is None:
        parser.print_help()
        return 1

    return handler(args)


if __name__ == "__main__":
    sys.exit(main())
