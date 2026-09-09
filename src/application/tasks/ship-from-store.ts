import { GateSet } from "../../domain/gate.js";
import { AdeStore } from "../../persistence/sqlite-store.js";
import { createCommit } from "../git/git-mutations.js";
import { executeGit } from "../../adapters/git-command.js";
import { getChangeReview } from "../change-review-read-model.js";
import { getTask } from "./task-commands.js";

/** What the flow refuses to do, told apart from what it failed to do: a blocked
    ship is the pipeline working, not an error to retry. */
export class ShipBlockedError extends Error {}

/** Approving a Task used to be where the trail ended: the work stayed
    uncommitted and nothing linked the eventual commit to the Task, the review
    or the gates that authorised it. Shipping is that last link. */
export async function shipTaskFromStore(
  store: AdeStore,
  input: { taskId: string; message: string; body?: string; actor: string; reason: string },
): Promise<{ operation: string; commit: string; taskId: string; message: string }> {
  const task = getTask(store, input.taskId);
  if (!task.repositoryPath) throw new ShipBlockedError(`Task ${input.taskId} has no repository to commit into`);
  if (!store.getApproval(input.taskId)) throw new ShipBlockedError("Human approval is required before shipping");
  const review = getChangeReview(store, input.taskId);
  const failures = new GateSet(review.gates).requiredFailures();
  if (failures.length) throw new ShipBlockedError(`Required gates are not passed: ${failures.map((gate) => gate.id).join(", ")}`);
  const { stdout } = await executeGit(["status", "--short"], { cwd: task.repositoryPath });
  if (!stdout.trim()) throw new ShipBlockedError("There is nothing to commit for this Task");
  const commit = await createCommit({
    directory: task.repositoryPath,
    actor: input.actor,
    reason: input.reason,
    confirmed: true,
    message: input.message,
    ...(input.body ? { body: input.body } : {}),
  });
  /** The commit is recorded against the Task, so the trail from intent to
      published change survives outside ADE's own memory. */
  store.saveGitOperation({
    id: `git-ship-${input.taskId}-${commit.commit.slice(0, 12)}`,
    taskId: input.taskId,
    operation: commit.operation,
    reference: commit.commit,
    actor: input.actor,
    reason: input.reason,
    metadata: JSON.stringify({ ...commit, gates: review.gates.map((gate) => ({ id: gate.id, status: gate.status })) }),
  });
  return { operation: commit.operation, commit: commit.commit, taskId: input.taskId, message: input.message };
}
