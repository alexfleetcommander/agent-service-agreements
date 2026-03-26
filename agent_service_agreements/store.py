"""Local append-only JSONL store for ASA records.

Stores agreements, negotiations, verifications, and escrow states.
Same pattern as Chain of Consciousness and Agent Rating Protocol:
one JSON record per line, append-only, no deletion.
"""

import json
import os
import threading
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar

from .schema import (
    EscrowState,
    NegotiationMessage,
    VerificationResult,
)
from .agreement import Agreement

T = TypeVar("T")


class AgreementStore:
    """Append-only local store backed by JSONL files.

    Maintains separate files for each record type:
    - agreements.jsonl — Agreement records
    - negotiations.jsonl — NegotiationMessage records
    - verifications.jsonl — VerificationResult records
    - escrow.jsonl — EscrowState records
    """

    def __init__(self, directory: str = ".asa") -> None:
        self.directory = Path(directory)
        self._lock = threading.Lock()
        self.directory.mkdir(parents=True, exist_ok=True)

    def _file_path(self, record_type: str) -> Path:
        return self.directory / f"{record_type}.jsonl"

    def _append(self, record_type: str, data: Dict[str, Any]) -> None:
        path = self._file_path(record_type)
        line = json.dumps(data, separators=(",", ":"), ensure_ascii=True)
        with self._lock:
            with open(path, "a", encoding="utf-8") as f:
                f.write(line + "\n")

    def _read_all_raw(self, record_type: str) -> List[Dict[str, Any]]:
        path = self._file_path(record_type)
        if not path.exists():
            return []
        records: List[Dict[str, Any]] = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return records

    def _read_all(
        self,
        record_type: str,
        from_dict: Callable[[Dict[str, Any]], T],
    ) -> List[T]:
        records: List[T] = []
        for d in self._read_all_raw(record_type):
            try:
                records.append(from_dict(d))
            except (KeyError, ValueError):
                continue
        return records

    # -- Agreements --

    def append_agreement(self, agreement: Agreement) -> str:
        if not agreement.agreement_hash:
            agreement.compute_hash()
        self._append("agreements", agreement.to_dict())
        return agreement.agreement_id

    def get_agreements(self) -> List[Agreement]:
        return self._read_all("agreements", Agreement.from_dict)

    def get_agreement(self, agreement_id: str) -> Optional[Agreement]:
        for a in self.get_agreements():
            if a.agreement_id == agreement_id:
                return a
        return None

    def get_agreements_for(self, party_id: str) -> List[Agreement]:
        """Get agreements where party_id is client or provider."""
        results = []
        for a in self.get_agreements():
            if a.client and a.client.value == party_id:
                results.append(a)
            elif a.provider and a.provider.value == party_id:
                results.append(a)
        return results

    # -- Negotiations --

    def append_negotiation(self, msg: NegotiationMessage) -> str:
        if not msg.message_hash:
            msg.compute_hash()
        self._append("negotiations", msg.to_dict())
        return msg.negotiation_id

    def get_negotiations(self) -> List[NegotiationMessage]:
        return self._read_all("negotiations", NegotiationMessage.from_dict)

    def get_negotiations_for(self, agreement_id: str) -> List[NegotiationMessage]:
        return [
            n for n in self.get_negotiations()
            if n.agreement_id == agreement_id
        ]

    # -- Verifications --

    def append_verification(self, result: VerificationResult) -> str:
        if not result.result_hash:
            result.compute_hash()
        self._append("verifications", result.to_dict())
        return result.verification_id

    def get_verifications(self) -> List[VerificationResult]:
        return self._read_all("verifications", VerificationResult.from_dict)

    def get_verification(self, verification_id: str) -> Optional[VerificationResult]:
        for v in self.get_verifications():
            if v.verification_id == verification_id:
                return v
        return None

    def get_verifications_for(self, agreement_id: str) -> List[VerificationResult]:
        return [
            v for v in self.get_verifications()
            if v.agreement_id == agreement_id
        ]

    # -- Escrow --

    def append_escrow_state(self, state: EscrowState) -> str:
        if not state.state_hash:
            state.compute_hash()
        self._append("escrow", state.to_dict())
        return state.agreement_id

    def get_escrow_states(self) -> List[EscrowState]:
        return self._read_all("escrow", EscrowState.from_dict)

    def get_latest_escrow(self, agreement_id: str) -> Optional[EscrowState]:
        states = [s for s in self.get_escrow_states() if s.agreement_id == agreement_id]
        if not states:
            return None
        return states[-1]

    # -- Statistics --

    def stats(self) -> Dict[str, Any]:
        def _file_size(name: str) -> int:
            p = self._file_path(name)
            return p.stat().st_size if p.exists() else 0

        return {
            "directory": str(self.directory),
            "agreements": {
                "count": len(self.get_agreements()),
                "file_size_bytes": _file_size("agreements"),
            },
            "negotiations": {
                "count": len(self.get_negotiations()),
                "file_size_bytes": _file_size("negotiations"),
            },
            "verifications": {
                "count": len(self.get_verifications()),
                "file_size_bytes": _file_size("verifications"),
            },
            "escrow": {
                "count": len(self.get_escrow_states()),
                "file_size_bytes": _file_size("escrow"),
            },
        }
