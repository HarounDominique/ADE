import { GateSet } from "../../domain/gate.js";
import { AdeStore } from "../../persistence/sqlite-store.js";
import { getChangeReview } from "../change-review-read-model.js";
import { getTask } from "./task-commands.js";

export function approveTaskFromStore(store: AdeStore, input: { id: string; reason: string; actor?: string }): void {
  const task = getTask(store, input.id);
  if (task.currentStatus !== "READY_FOR_HUMAN") throw new Error(`Task must be READY_FOR_HUMAN before approval, got ${task.currentStatus}`);
  const review = getChangeReview(store, input.id);
  new GateSet(review.gates.filter((gate) => gate.id !== "human-approval")).assertCanShip();
  task.transition("COMPLETED", input.reason, input.actor ?? "human");
  store.saveTask(task);
  store.saveApproval({ taskId: task.id, actor: input.actor ?? "human", reason: input.reason });
}
