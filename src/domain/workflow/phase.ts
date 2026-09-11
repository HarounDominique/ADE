/** The adaptive workflow of SPEC-development-workflow, as domain state.

    Phases are workflow state, never additional `TaskStatus` values: a Task stays
    IN_PROGRESS while the work moves BUILD -> VERIFY -> BUILD, and COMPLETED is
    not a phase. The two axes are persisted separately for that reason.

    The escalation and guard mechanisms follow SEED, the Claude Code plugin this
    implementation takes as its reference (ADR-0056). */

export type WorkflowPhase =
  | "FRAME"
  | "EXPLORE"
  | "DESIGN"
  | "BUILD"
  | "VERIFY"
  | "REVIEW"
  | "RECONCILE"
  | "SHIP";

export type WorkflowMode = "quick" | "standard" | "design-heavy" | "recovery";

export type WorkflowTransition = {
  from: WorkflowPhase | undefined;
  to: WorkflowPhase;
  at: string;
  actor: string;
  reason: string;
  /** True when the move went back to a phase that needs new information. Kept
      apart from a forward move so history reads as what happened, not as
      progress that stuttered. */
  reentry: boolean;
  evidenceIds: readonly string[];
  cycle: number;
};

export type WorkflowSnapshot = {
  taskId: string;
  mode: WorkflowMode;
  phase: WorkflowPhase;
  cycle: number;
  attempts: Readonly<Record<string, number>>;
  transitions: readonly WorkflowTransition[];
};

export type PhaseDispatch = {
  attempt: number;
  /** Raise the model one tier for this one dispatch. */
  escalate: boolean;
  /** Do not dispatch at all: this phase already failed at a higher tier. */
  halt: boolean;
};

/** The routes a mode proposes. They orient the next phase; they do not
    constrain the matrix, which is what actually decides what is legal. */
const ROUTES: Record<WorkflowMode, readonly WorkflowPhase[]> = {
  quick: ["FRAME", "BUILD", "VERIFY"],
  standard: ["FRAME", "EXPLORE", "BUILD", "VERIFY", "REVIEW", "RECONCILE", "SHIP"],
  "design-heavy": ["FRAME", "EXPLORE", "DESIGN", "REVIEW", "BUILD", "VERIFY", "RECONCILE", "SHIP"],
  /** Recovery exists to re-read the evidence that contradicted the plan, so it
      starts where that reading happens rather than at FRAME. */
  recovery: ["EXPLORE", "BUILD", "VERIFY"],
};

const TRANSITIONS: Record<WorkflowPhase, readonly WorkflowPhase[]> = {
  FRAME: ["EXPLORE", "DESIGN", "BUILD"],
  EXPLORE: ["FRAME", "DESIGN", "BUILD"],
  DESIGN: ["FRAME", "BUILD", "REVIEW"],
  BUILD: ["EXPLORE", "VERIFY", "REVIEW"],
  VERIFY: ["BUILD", "REVIEW", "RECONCILE"],
  REVIEW: ["BUILD", "VERIFY", "RECONCILE"],
  RECONCILE: ["FRAME", "BUILD", "SHIP"],
  SHIP: [],
};

/** Two attempts is where a tier goes up; three is where a human decides. Not a
    retry budget to raise -- a failure that already survived a higher tier is
    information about the problem, not about the model. */
const ESCALATE_AT = 2;
const HALT_AT = 3;

export function routeFor(mode: WorkflowMode): readonly WorkflowPhase[] {
  return ROUTES[mode];
}

export function canTransition(from: WorkflowPhase, to: WorkflowPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

export class WorkflowState {
  private constructor(
    readonly taskId: string,
    private mode: WorkflowMode,
    private phase: WorkflowPhase,
    private cycle: number,
    private readonly attempts: Map<WorkflowPhase, number>,
    private readonly transitions: WorkflowTransition[],
  ) {}

  static start(input: { taskId: string; mode: WorkflowMode; reason: string; actor?: string }): WorkflowState {
    requireReason(input.reason);
    const entry = ROUTES[input.mode][0];
    /** Every route in ROUTES is non-empty, but `noUncheckedIndexedAccess` is
        right to make that explicit rather than assumed. */
    if (!entry) throw new Error(`Workflow mode has no route: ${input.mode}`);
    const state = new WorkflowState(input.taskId, input.mode, entry, 1, new Map(), []);
    state.countAttempt(entry);
    state.transitions.push({
      from: undefined,
      to: entry,
      at: new Date().toISOString(),
      actor: input.actor ?? "human",
      reason: input.reason,
      reentry: false,
      evidenceIds: [],
      cycle: 1,
    });
    return state;
  }

  static rehydrate(snapshot: WorkflowSnapshot): WorkflowState {
    const attempts = new Map<WorkflowPhase, number>();
    for (const [phase, count] of Object.entries(snapshot.attempts)) {
      if (isPhase(phase) && Number.isInteger(count) && count > 0) attempts.set(phase, count);
    }
    return new WorkflowState(snapshot.taskId, snapshot.mode, snapshot.phase, snapshot.cycle, attempts, [...snapshot.transitions]);
  }

  get currentPhase(): WorkflowPhase {
    return this.phase;
  }

  get currentMode(): WorkflowMode {
    return this.mode;
  }

  get currentCycle(): number {
    return this.cycle;
  }

  history(): readonly WorkflowTransition[] {
    return [...this.transitions];
  }

  attemptsFor(phase: WorkflowPhase): number {
    return this.attempts.get(phase) ?? 0;
  }

  /** What a dispatcher needs to know before running this phase: which attempt
      this would be, whether to raise the tier, and whether to refuse. */
  dispatchFor(phase: WorkflowPhase): PhaseDispatch {
    const attempt = Math.max(this.attemptsFor(phase), 1);
    return { attempt, escalate: attempt === ESCALATE_AT, halt: attempt >= HALT_AT };
  }

  /** Set when the current phase has exhausted its attempts, so a caller can
      report the stop without recomputing why. */
  haltReason(): string | undefined {
    const attempt = this.attemptsFor(this.phase);
    if (attempt < HALT_AT) return undefined;
    const last = this.transitions.at(-1);
    return `Phase ${this.phase} stopped after ${attempt} attempts (last: ${last?.reason ?? "unknown"}). A human decides what happens next.`;
  }

  advance(to: WorkflowPhase, reason: string, options: { actor?: string; evidenceIds?: readonly string[] } = {}): void {
    this.move(to, reason, false, options);
  }

  /** Going back to the phase that needs new information. Explicit, so history
      records why the work returned instead of showing a phase that simply
      happened twice. */
  reenter(to: WorkflowPhase, reason: string, options: { actor?: string; evidenceIds?: readonly string[] } = {}): void {
    this.move(to, reason, true, options);
  }

  /** A new increment of the same Task: the counters start clean, because the
      next increment is not the previous one's third attempt. */
  newCycle(reason: string, actor = "system"): void {
    requireReason(reason);
    this.cycle += 1;
    this.attempts.clear();
    this.countAttempt(this.phase);
    this.transitions.push({
      from: this.phase,
      to: this.phase,
      at: new Date().toISOString(),
      actor,
      reason,
      reentry: false,
      evidenceIds: [],
      cycle: this.cycle,
    });
  }

  /** Changing the route the work follows, not the progress it made. The phase,
      the cycle and every counter stay exactly where they were. */
  escalateMode(next: WorkflowMode, reason: string, actor = "system"): void {
    requireReason(reason);
    this.mode = next;
    this.transitions.push({
      from: this.phase,
      to: this.phase,
      at: new Date().toISOString(),
      actor,
      reason: `mode -> ${next}: ${reason}`,
      reentry: false,
      evidenceIds: [],
      cycle: this.cycle,
    });
  }

  snapshot(): WorkflowSnapshot {
    return {
      taskId: this.taskId,
      mode: this.mode,
      phase: this.phase,
      cycle: this.cycle,
      attempts: Object.fromEntries(this.attempts),
      transitions: this.history(),
    };
  }

  private move(to: WorkflowPhase, reason: string, reentry: boolean, options: { actor?: string; evidenceIds?: readonly string[] }): void {
    requireReason(reason);
    if (!canTransition(this.phase, to)) {
      throw new Error(`Invalid workflow transition: ${this.phase} -> ${to}`);
    }
    const from = this.phase;
    this.phase = to;
    this.countAttempt(to);
    this.transitions.push({
      from,
      to,
      at: new Date().toISOString(),
      actor: options.actor ?? "system",
      reason,
      reentry,
      evidenceIds: [...(options.evidenceIds ?? [])],
      cycle: this.cycle,
    });
  }

  private countAttempt(phase: WorkflowPhase): void {
    this.attempts.set(phase, this.attemptsFor(phase) + 1);
  }
}

function requireReason(reason: string): void {
  if (!reason.trim()) throw new Error("A workflow transition requires a reason");
}

function isPhase(value: string): value is WorkflowPhase {
  return value in TRANSITIONS;
}
