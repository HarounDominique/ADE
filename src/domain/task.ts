export type TaskStatus =
  | "DRAFT"
  | "READY"
  | "IN_PROGRESS"
  | "IMPLEMENTED"
  | "UNDER_REVIEW"
  | "BLOCKED"
  | "CHANGES_REQUESTED"
  | "READY_FOR_HUMAN"
  | "COMPLETED"
  | "ABORTED";

export type TaskEvent = {
  type: "task.created" | "task.status_changed" | "task.acceptance_changed";
  taskId: string;
  at: string;
  actor: string;
  reason: string;
  status: TaskStatus;
};

export class Task {
  private constructor(
    readonly id: string,
    readonly intent: string,
    readonly projectId: string | undefined,
    readonly repositoryPath: string | undefined,
    private status: TaskStatus,
    private readonly events: TaskEvent[],
    private acceptanceCriteria: string[],
  ) {}

  static create(input: { id: string; intent: string; actor?: string; projectId?: string; repositoryPath?: string; acceptanceCriteria?: readonly string[] }): Task {
    if (!input.intent.trim()) throw new Error("Task intent cannot be empty");
    const at = new Date().toISOString();
    const actor = input.actor ?? "human";
    const event: TaskEvent = {
      type: "task.created",
      taskId: input.id,
      at,
      actor,
      reason: "Task created",
      status: "DRAFT",
    };
    if (input.projectId !== undefined && !input.projectId.trim()) {
      throw new Error("Task project id cannot be empty");
    }
    if (input.repositoryPath !== undefined && !input.repositoryPath.trim()) {
      throw new Error("Task repository path cannot be empty");
    }
    return new Task(input.id, input.intent, input.projectId, input.repositoryPath, "DRAFT", [event], normalizeCriteria(input.acceptanceCriteria));
  }

  static rehydrate(input: {
    id: string;
    intent: string;
    projectId: string | undefined;
    repositoryPath: string | undefined;
    status: TaskStatus;
    events: readonly TaskEvent[];
    acceptanceCriteria?: readonly string[];
  }): Task {
    if (!input.intent.trim()) throw new Error("Task intent cannot be empty");
    if (input.events.length === 0) throw new Error("Task history cannot be empty");
    /** A Task written before acceptance criteria existed simply has none and
        stays readable; it is asked for the next time it moves to READY. */
    return new Task(input.id, input.intent, input.projectId, input.repositoryPath, input.status, [...input.events], normalizeCriteria(input.acceptanceCriteria));
  }

  /** What the human said "done" means. The reviewer judges against this and the
      human approves against it, so it belongs to the Task and not to a prompt
      that scrolled away. */
  acceptance(): readonly string[] {
    return [...this.acceptanceCriteria];
  }

  /** Changing what done means is a decision like any other, so it is recorded
      in the history rather than silently overwritten. */
  setAcceptance(criteria: readonly string[], reason: string, actor = "human"): void {
    if (!reason.trim()) throw new Error("Changing acceptance criteria requires a reason");
    const next = normalizeCriteria(criteria);
    if (!next.length) throw new Error("A Task needs at least one acceptance criterion");
    this.acceptanceCriteria = next;
    this.events.push({
      type: "task.acceptance_changed",
      taskId: this.id,
      at: new Date().toISOString(),
      actor,
      reason,
      status: this.status,
    });
  }

  get currentStatus(): TaskStatus {
    return this.status;
  }

  history(): readonly TaskEvent[] {
    return [...this.events];
  }

  transition(next: TaskStatus, reason: string, actor = "system"): void {
    if (!reason.trim()) throw new Error("Task transition requires a reason");
    /** Work does not start against an unstated definition of done. Everything
        downstream -- the reviewer's judgement, the gates, the human's approval
        -- is a comparison against this, and without it each of them is an
        opinion. */
    if (next === "READY" && !this.acceptanceCriteria.length) {
      throw new Error(`Task ${this.id} needs at least one acceptance criterion before it is READY`);
    }
    if (!canTransition(this.status, next)) {
      throw new Error(`Invalid Task transition: ${this.status} -> ${next}`);
    }
    this.status = next;
    this.events.push({
      type: "task.status_changed",
      taskId: this.id,
      at: new Date().toISOString(),
      actor,
      reason,
      status: next,
    });
  }
}

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  DRAFT: ["READY", "ABORTED"],
  READY: ["IN_PROGRESS", "ABORTED"],
  IN_PROGRESS: ["IMPLEMENTED", "BLOCKED", "ABORTED"],
  IMPLEMENTED: ["UNDER_REVIEW", "BLOCKED", "ABORTED"],
  UNDER_REVIEW: ["CHANGES_REQUESTED", "READY_FOR_HUMAN", "BLOCKED", "ABORTED"],
  BLOCKED: ["READY", "IN_PROGRESS", "ABORTED"],
  CHANGES_REQUESTED: ["IN_PROGRESS", "ABORTED"],
  READY_FOR_HUMAN: ["COMPLETED", "IN_PROGRESS", "ABORTED"],
  COMPLETED: [],
  ABORTED: [],
};

function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return transitions[from].includes(to);
}

/** Criteria are statements, one per line, trimmed and without blanks: the shape
    a human writes and a reviewer can check one by one. */
function normalizeCriteria(criteria: readonly string[] | undefined): string[] {
  return (criteria ?? []).map((criterion) => criterion.trim()).filter(Boolean);
}
