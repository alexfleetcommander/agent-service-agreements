import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EscrowState,
  NegotiationMessage,
  VerificationResult,
} from "./schema";
import { Agreement } from "./agreement";

export class AgreementStore {
  readonly directory: string;

  constructor(directory = ".asa") {
    this.directory = directory;
    mkdirSync(directory, { recursive: true });
  }

  private filePath(recordType: string): string {
    return join(this.directory, `${recordType}.jsonl`);
  }

  private append(recordType: string, data: Record<string, unknown>): void {
    const path = this.filePath(recordType);
    const line = JSON.stringify(data) + "\n";
    writeFileSync(path, line, { flag: "a", encoding: "utf-8" });
  }

  private readAllRaw(recordType: string): Array<Record<string, unknown>> {
    const path = this.filePath(recordType);
    if (!existsSync(path)) return [];
    const content = readFileSync(path, "utf-8");
    const records: Array<Record<string, unknown>> = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed));
      } catch {
        continue;
      }
    }
    return records;
  }

  // -- Agreements --

  appendAgreement(agreement: Agreement): string {
    if (!agreement.agreementHash) agreement.computeHash();
    this.append("agreements", agreement.toDict() as unknown as Record<string, unknown>);
    return agreement.agreementId;
  }

  getAgreements(): Agreement[] {
    return this.readAllRaw("agreements").map((d) => {
      try { return Agreement.fromDict(d); } catch { return null; }
    }).filter((a): a is Agreement => a !== null);
  }

  getAgreement(agreementId: string): Agreement | null {
    for (const a of this.getAgreements()) {
      if (a.agreementId === agreementId) return a;
    }
    return null;
  }

  getAgreementsFor(partyId: string): Agreement[] {
    return this.getAgreements().filter(
      (a) => a.client?.value === partyId || a.provider?.value === partyId,
    );
  }

  // -- Negotiations --

  appendNegotiation(msg: NegotiationMessage): string {
    if (!msg.messageHash) msg.computeHash();
    this.append("negotiations", msg.toDict() as unknown as Record<string, unknown>);
    return msg.negotiationId;
  }

  getNegotiations(): NegotiationMessage[] {
    return this.readAllRaw("negotiations").map((d) => {
      try { return NegotiationMessage.fromDict(d as any); } catch { return null; }
    }).filter((n): n is NegotiationMessage => n !== null);
  }

  getNegotiationsFor(agreementId: string): NegotiationMessage[] {
    return this.getNegotiations().filter((n) => n.agreementId === agreementId);
  }

  // -- Verifications --

  appendVerification(result: VerificationResult): string {
    if (!result.resultHash) result.computeHash();
    this.append("verifications", result.toDict() as unknown as Record<string, unknown>);
    return result.verificationId;
  }

  getVerifications(): VerificationResult[] {
    return this.readAllRaw("verifications").map((d) => {
      try { return VerificationResult.fromDict(d as any); } catch { return null; }
    }).filter((v): v is VerificationResult => v !== null);
  }

  getVerification(verificationId: string): VerificationResult | null {
    for (const v of this.getVerifications()) {
      if (v.verificationId === verificationId) return v;
    }
    return null;
  }

  getVerificationsFor(agreementId: string): VerificationResult[] {
    return this.getVerifications().filter((v) => v.agreementId === agreementId);
  }

  // -- Escrow --

  appendEscrowState(state: EscrowState): string {
    if (!state.stateHash) state.computeHash();
    this.append("escrow", state.toDict() as unknown as Record<string, unknown>);
    return state.agreementId;
  }

  getEscrowStates(): EscrowState[] {
    return this.readAllRaw("escrow").map((d) => {
      try { return EscrowState.fromDict(d as any); } catch { return null; }
    }).filter((s): s is EscrowState => s !== null);
  }

  getLatestEscrow(agreementId: string): EscrowState | null {
    const states = this.getEscrowStates().filter((s) => s.agreementId === agreementId);
    return states.length > 0 ? states[states.length - 1] : null;
  }

  // -- Statistics --

  stats(): Record<string, unknown> {
    const fileSize = (name: string): number => {
      const p = this.filePath(name);
      return existsSync(p) ? statSync(p).size : 0;
    };
    return {
      directory: this.directory,
      agreements: {
        count: this.getAgreements().length,
        file_size_bytes: fileSize("agreements"),
      },
      negotiations: {
        count: this.getNegotiations().length,
        file_size_bytes: fileSize("negotiations"),
      },
      verifications: {
        count: this.getVerifications().length,
        file_size_bytes: fileSize("verifications"),
      },
      escrow: {
        count: this.getEscrowStates().length,
        file_size_bytes: fileSize("escrow"),
      },
    };
  }
}
