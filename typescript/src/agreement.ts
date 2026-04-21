import {
  ASA_VERSION,
  AGREEMENT_STATUSES,
  AgreementStatus,
  EscrowConfig,
  Identity,
  QualityCriteria,
  ServiceSpec,
  VerificationConfig,
  hashDict,
  nowIso,
  uuid,
} from "./schema";

export interface AgreementDict {
  asa_version: string;
  agreement_id: string;
  created_at: string;
  status: string;
  expires_at?: string;
  parties?: Record<string, unknown>;
  service?: Record<string, unknown>;
  quality_criteria?: Record<string, unknown>;
  verification?: Record<string, unknown>;
  escrow?: Record<string, unknown>;
  dispute: { protocol: string; auto_file_threshold: number };
  signatures?: Record<string, string>;
  deliverable_hash?: string;
  delivered_at?: string;
  agreement_hash?: string;
}

export class Agreement {
  agreementId: string;
  asaVersion: string;
  createdAt: string;
  expiresAt: string;
  status: string;

  client: Identity | null;
  provider: Identity | null;
  evaluator: Identity | null;
  evaluatorType: string;

  service: ServiceSpec | null;
  qualityCriteria: QualityCriteria | null;
  verification: VerificationConfig | null;
  escrow: EscrowConfig | null;

  disputeProtocol: string;
  disputeAutoFileThreshold: number;

  clientSignature: string;
  providerSignature: string;

  deliverableHash: string;
  deliveredAt: string;
  agreementHash: string;

  constructor(opts: {
    agreementId?: string;
    asaVersion?: string;
    createdAt?: string;
    expiresAt?: string;
    status?: string;
    client?: Identity | null;
    provider?: Identity | null;
    evaluator?: Identity | null;
    evaluatorType?: string;
    service?: ServiceSpec | null;
    qualityCriteria?: QualityCriteria | null;
    verification?: VerificationConfig | null;
    escrow?: EscrowConfig | null;
    disputeProtocol?: string;
    disputeAutoFileThreshold?: number;
    clientSignature?: string;
    providerSignature?: string;
    deliverableHash?: string;
    deliveredAt?: string;
    agreementHash?: string;
  } = {}) {
    this.agreementId = opts.agreementId || `asa-${uuid().slice(0, 12)}`;
    this.asaVersion = opts.asaVersion || ASA_VERSION;
    this.createdAt = opts.createdAt || nowIso();
    this.expiresAt = opts.expiresAt || "";
    this.status = opts.status || "proposed";
    this.client = opts.client ?? null;
    this.provider = opts.provider ?? null;
    this.evaluator = opts.evaluator ?? null;
    this.evaluatorType = opts.evaluatorType || "agent_as_judge";
    this.service = opts.service ?? null;
    this.qualityCriteria = opts.qualityCriteria ?? null;
    this.verification = opts.verification ?? null;
    this.escrow = opts.escrow ?? null;
    this.disputeProtocol = opts.disputeProtocol || "ajp";
    this.disputeAutoFileThreshold = opts.disputeAutoFileThreshold ?? 60.0;
    this.clientSignature = opts.clientSignature || "";
    this.providerSignature = opts.providerSignature || "";
    this.deliverableHash = opts.deliverableHash || "";
    this.deliveredAt = opts.deliveredAt || "";
    this.agreementHash = opts.agreementHash || "";
  }

  computeHash(): string {
    const d = this._canonicalDict();
    this.agreementHash = hashDict(d);
    return this.agreementHash;
  }

  private _canonicalDict(): Record<string, unknown> {
    const d: Record<string, unknown> = {
      agreement_id: this.agreementId,
      asa_version: this.asaVersion,
      created_at: this.createdAt,
    };
    if (this.client) d.client = this.client.toDict();
    if (this.provider) d.provider = this.provider.toDict();
    if (this.service) d.service = this.service.toDict();
    if (this.qualityCriteria) d.quality_criteria = this.qualityCriteria.toDict();
    if (this.escrow) d.escrow = this.escrow.toDict();
    return d;
  }

  validate(): string[] {
    const errors: string[] = [];
    if (!this.client) errors.push("Agreement must have a client identity");
    if (!this.provider) errors.push("Agreement must have a provider identity");
    if (!this.service) errors.push("Agreement must specify a service");
    if (!this.qualityCriteria) {
      errors.push("Agreement must have quality criteria");
    } else {
      if (!this.qualityCriteria.dimensions.length) {
        errors.push("Quality criteria must include at least one dimension");
      } else {
        const totalWeight = this.qualityCriteria.dimensions.reduce((s, d) => s + d.weight, 0);
        if (Math.abs(totalWeight - 1.0) > 0.05) {
          errors.push(`Dimension weights should sum to ~1.0, got ${totalWeight.toFixed(2)}`);
        }
      }
    }
    if (!(AGREEMENT_STATUSES as readonly string[]).includes(this.status)) {
      errors.push(`Invalid status: ${this.status}`);
    }
    return errors;
  }

  isValid(): boolean {
    return this.validate().length === 0;
  }

  sign(party: "client" | "provider", signature: string): void {
    if (party === "client") {
      this.clientSignature = signature;
    } else if (party === "provider") {
      this.providerSignature = signature;
    }
    if (this.clientSignature && this.providerSignature) {
      this.status = "active";
      this.computeHash();
    }
  }

  deliver(deliverableHash: string): void {
    if (this.status !== "active") {
      throw new Error(`Cannot deliver in status '${this.status}', must be 'active'`);
    }
    this.deliverableHash = deliverableHash;
    this.deliveredAt = nowIso();
    this.status = "delivered";
  }

  markVerified(_passed: boolean): void {
    if (this.status !== "delivered") {
      throw new Error(`Cannot verify in status '${this.status}', must be 'delivered'`);
    }
    this.status = "verified";
  }

  close(): void {
    if (this.status !== "verified" && this.status !== "disputed") {
      throw new Error(`Cannot close in status '${this.status}'`);
    }
    this.status = "closed";
  }

  dispute(): void {
    if (this.status !== "verified" && this.status !== "delivered") {
      throw new Error(`Cannot dispute in status '${this.status}'`);
    }
    this.status = "disputed";
  }

  expire(): void {
    this.status = "expired";
  }

  reject(): void {
    if (this.status !== "proposed" && this.status !== "negotiating") {
      throw new Error(`Cannot reject in status '${this.status}'`);
    }
    this.status = "rejected";
  }

  toDict(): AgreementDict {
    const d: Record<string, unknown> = {
      asa_version: this.asaVersion,
      agreement_id: this.agreementId,
      created_at: this.createdAt,
      status: this.status,
    };
    if (this.expiresAt) d.expires_at = this.expiresAt;

    const parties: Record<string, unknown> = {};
    if (this.client) parties.client = this.client.toDict();
    if (this.provider) parties.provider = this.provider.toDict();
    if (this.evaluator) {
      const evDict = { ...this.evaluator.toDict(), type: this.evaluatorType };
      parties.evaluator = evDict;
    }
    if (Object.keys(parties).length > 0) d.parties = parties;

    if (this.service) d.service = this.service.toDict();
    if (this.qualityCriteria) d.quality_criteria = this.qualityCriteria.toDict();
    if (this.verification) d.verification = this.verification.toDict();
    if (this.escrow) d.escrow = this.escrow.toDict();

    d.dispute = {
      protocol: this.disputeProtocol,
      auto_file_threshold: this.disputeAutoFileThreshold,
    };

    const sigs: Record<string, string> = {};
    if (this.clientSignature) sigs.client = this.clientSignature;
    if (this.providerSignature) sigs.provider = this.providerSignature;
    if (Object.keys(sigs).length > 0) d.signatures = sigs;

    if (this.deliverableHash) d.deliverable_hash = this.deliverableHash;
    if (this.deliveredAt) d.delivered_at = this.deliveredAt;
    if (this.agreementHash) d.agreement_hash = this.agreementHash;

    return d as unknown as AgreementDict;
  }

  static fromDict(d: Record<string, unknown>): Agreement {
    const parties = (d.parties || {}) as Record<string, Record<string, unknown>>;
    const clientD = parties.client as Record<string, string> | undefined;
    const providerD = parties.provider as Record<string, string> | undefined;
    const evaluatorD = parties.evaluator as Record<string, string> | undefined;
    const sigs = (d.signatures || {}) as Record<string, string>;
    const dispute = (d.dispute || {}) as Record<string, unknown>;

    let evaluatorType = "agent_as_judge";
    let evaluatorForParse: Record<string, string> | undefined;
    if (evaluatorD) {
      evaluatorType = (evaluatorD.type as string) || "agent_as_judge";
      evaluatorForParse = { ...evaluatorD };
      delete evaluatorForParse.type;
    }

    return new Agreement({
      agreementId: (d.agreement_id as string) || "",
      asaVersion: (d.asa_version as string) || ASA_VERSION,
      createdAt: (d.created_at as string) || "",
      expiresAt: (d.expires_at as string) || "",
      status: (d.status as string) || "proposed",
      client: clientD ? Identity.fromDict(clientD as any) : null,
      provider: providerD ? Identity.fromDict(providerD as any) : null,
      evaluator: evaluatorForParse ? Identity.fromDict(evaluatorForParse as any) : null,
      evaluatorType,
      service: d.service ? ServiceSpec.fromDict(d.service as any) : null,
      qualityCriteria: d.quality_criteria ? QualityCriteria.fromDict(d.quality_criteria as any) : null,
      verification: d.verification ? VerificationConfig.fromDict(d.verification as any) : null,
      escrow: d.escrow ? EscrowConfig.fromDict(d.escrow as any) : null,
      disputeProtocol: (dispute.protocol as string) || "ajp",
      disputeAutoFileThreshold: (dispute.auto_file_threshold as number) ?? 60.0,
      clientSignature: sigs.client || "",
      providerSignature: sigs.provider || "",
      deliverableHash: (d.deliverable_hash as string) || "",
      deliveredAt: (d.delivered_at as string) || "",
      agreementHash: (d.agreement_hash as string) || "",
    });
  }

  toJson(indent = 2): string {
    return JSON.stringify(this.toDict(), null, indent);
  }

  static fromJson(s: string): Agreement {
    return Agreement.fromDict(JSON.parse(s));
  }
}
