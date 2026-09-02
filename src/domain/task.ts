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
  type: "task.created" | "task.status_changed";
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
    private status: TaskStatus,
    private readonly events: TaskEvent[],
  ) {}

  static create(input: { id: string; intent: string; actor?: string }): Task {
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
    return new Task(input.id, input.intent, "DRAFT", [event]);
  }

  get currentStatus(): TaskStatus {
    return this.status;
  }

  history(): readonly TaskEvent[] {
    return [...this.events];
  }

  transition(next: TaskStatus, reason: string, actor = "system"): void {
    if (!reason.trim()) throw new Error("Task transition requires a reason");
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
