import { Identity, uuid } from "./schema";

export class EvaluatorRecord {
  identity: Identity;
  domains: string[];
  totalEvaluations: number;
  canaryPassRate: number;
  calibrationDeviation: number;
  available: boolean;
  costPerEvalUsd: number;

  constructor(opts: {
    identity: Identity;
    domains?: string[];
    totalEvaluations?: number;
    canaryPassRate?: number;
    calibrationDeviation?: number;
    available?: boolean;
    costPerEvalUsd?: number;
  }) {
    this.identity = opts.identity;
    this.domains = opts.domains || [];
    this.totalEvaluations = opts.totalEvaluations ?? 0;
    this.canaryPassRate = opts.canaryPassRate ?? 1.0;
    this.calibrationDeviation = opts.calibrationDeviation ?? 0.0;
    this.available = opts.available ?? true;
    this.costPerEvalUsd = opts.costPerEvalUsd ?? 0.0;
  }

  isQualified(
    minEvaluations = 50,
    minCanaryRate = 0.9,
    maxCalibrationDeviation = 0.15,
  ): boolean {
    return (
      this.totalEvaluations >= minEvaluations &&
      this.canaryPassRate >= minCanaryRate &&
      this.calibrationDeviation <= maxCalibrationDeviation &&
      this.available
    );
  }

  toDict(): Record<string, unknown> {
    return {
      identity: this.identity.toDict(),
      domains: this.domains,
      total_evaluations: this.totalEvaluations,
      canary_pass_rate: this.canaryPassRate,
      calibration_deviation: this.calibrationDeviation,
      available: this.available,
      cost_per_eval_usd: this.costPerEvalUsd,
    };
  }

  static fromDict(d: Record<string, unknown>): EvaluatorRecord {
    return new EvaluatorRecord({
      identity: Identity.fromDict(d.identity as any),
      domains: (d.domains as string[]) || [],
      totalEvaluations: (d.total_evaluations as number) ?? 0,
      canaryPassRate: (d.canary_pass_rate as number) ?? 1.0,
      calibrationDeviation: (d.calibration_deviation as number) ?? 0.0,
      available: (d.available as boolean) ?? true,
      costPerEvalUsd: (d.cost_per_eval_usd as number) ?? 0.0,
    });
  }
}

export class CanaryTask {
  taskId: string;
  deliverable: string;
  expectedScores: Record<string, number>;
  tolerance: number;

  constructor(opts: {
    taskId?: string;
    deliverable?: string;
    expectedScores?: Record<string, number>;
    tolerance?: number;
  } = {}) {
    this.taskId = opts.taskId || `canary-${uuid().slice(0, 8)}`;
    this.deliverable = opts.deliverable || "";
    this.expectedScores = opts.expectedScores || {};
    this.tolerance = opts.tolerance ?? 10.0;
  }

  checkResult(actualScores: Record<string, number>): boolean {
    for (const [dimName, expected] of Object.entries(this.expectedScores)) {
      const actual = actualScores[dimName];
      if (actual === undefined) return false;
      if (Math.abs(actual - expected) > this.tolerance) return false;
    }
    return true;
  }

  toDict(): Record<string, unknown> {
    return {
      task_id: this.taskId,
      expected_scores: this.expectedScores,
      tolerance: this.tolerance,
    };
  }
}

export class EvaluatorRegistry {
  private _evaluators: Map<string, EvaluatorRecord> = new Map();
  private _assignmentHistory: Map<string, string[]> = new Map();
  private _canaryTasks: CanaryTask[] = [];

  register(evaluator: EvaluatorRecord): void {
    this._evaluators.set(evaluator.identity.value, evaluator);
  }

  remove(evaluatorId: string): void {
    this._evaluators.delete(evaluatorId);
  }

  get(evaluatorId: string): EvaluatorRecord | null {
    return this._evaluators.get(evaluatorId) ?? null;
  }

  listQualified(
    domain?: string,
    minEvaluations = 50,
    minCanaryRate = 0.9,
  ): EvaluatorRecord[] {
    const qualified: EvaluatorRecord[] = [];
    for (const ev of this._evaluators.values()) {
      if (!ev.isQualified(minEvaluations, minCanaryRate)) continue;
      if (domain && !ev.domains.includes(domain)) continue;
      qualified.push(ev);
    }
    return qualified;
  }

  selectRandom(
    clientId: string,
    providerId: string,
    domain?: string,
    excludedIds?: Set<string>,
  ): EvaluatorRecord | null {
    const excluded = new Set(excludedIds || []);
    excluded.add(clientId);
    excluded.add(providerId);

    const recent = (this._assignmentHistory.get(providerId) || []).slice(-5);
    for (const r of recent) excluded.add(r);

    const qualified = this.listQualified(domain).filter(
      (ev) => !excluded.has(ev.identity.value),
    );
    if (qualified.length === 0) return null;

    const selected = qualified[Math.floor(Math.random() * qualified.length)];
    this._trackAssignment(providerId, selected.identity.value);
    return selected;
  }

  selectMutual(
    clientProposals: string[],
    providerProposals: string[],
    clientId: string,
    providerId: string,
    domain?: string,
    _maxRounds = 3,
  ): EvaluatorRecord | null {
    const excluded = new Set([clientId, providerId]);
    const common = new Set(
      clientProposals.filter((id) => providerProposals.includes(id) && !excluded.has(id)),
    );

    for (const eid of common) {
      const ev = this._evaluators.get(eid);
      if (ev && ev.isQualified()) {
        this._trackAssignment(providerId, eid);
        return ev;
      }
    }
    return this.selectRandom(clientId, providerId, domain);
  }

  selectMarketplace(
    clientId: string,
    providerId: string,
    domain?: string,
    maxCostUsd?: number,
    minEvaluations = 50,
  ): EvaluatorRecord | null {
    const excluded = new Set([clientId, providerId]);
    let candidates = this.listQualified(domain, minEvaluations).filter(
      (ev) => !excluded.has(ev.identity.value),
    );

    if (maxCostUsd !== undefined) {
      candidates = candidates.filter((c) => c.costPerEvalUsd <= maxCostUsd);
    }
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      if (b.canaryPassRate !== a.canaryPassRate) return b.canaryPassRate - a.canaryPassRate;
      if (b.totalEvaluations !== a.totalEvaluations) return b.totalEvaluations - a.totalEvaluations;
      return a.costPerEvalUsd - b.costPerEvalUsd;
    });

    const selected = candidates[0];
    this._trackAssignment(providerId, selected.identity.value);
    return selected;
  }

  checkConflictOfInterest(
    evaluatorId: string,
    clientId: string,
    providerId: string,
  ): boolean {
    return evaluatorId === clientId || evaluatorId === providerId;
  }

  addCanaryTask(task: CanaryTask): void {
    this._canaryTasks.push(task);
  }

  getCanaryTask(): CanaryTask | null {
    if (this._canaryTasks.length === 0) return null;
    return this._canaryTasks[Math.floor(Math.random() * this._canaryTasks.length)];
  }

  updateEvaluatorStats(
    evaluatorId: string,
    canaryPassed?: boolean,
  ): void {
    const ev = this._evaluators.get(evaluatorId);
    if (!ev) return;
    ev.totalEvaluations += 1;
    if (canaryPassed !== undefined) {
      const alpha = 0.1;
      const newVal = canaryPassed ? 1.0 : 0.0;
      ev.canaryPassRate = (1 - alpha) * ev.canaryPassRate + alpha * newVal;
    }
  }

  toDict(): Record<string, unknown> {
    const evaluators: Record<string, unknown> = {};
    for (const [k, v] of this._evaluators) {
      evaluators[k] = v.toDict();
    }
    const history: Record<string, string[]> = {};
    for (const [k, v] of this._assignmentHistory) {
      history[k] = v;
    }
    return {
      evaluators,
      assignment_history: history,
      canary_tasks_count: this._canaryTasks.length,
    };
  }

  private _trackAssignment(providerId: string, evaluatorId: string): void {
    if (!this._assignmentHistory.has(providerId)) {
      this._assignmentHistory.set(providerId, []);
    }
    this._assignmentHistory.get(providerId)!.push(evaluatorId);
  }
}
