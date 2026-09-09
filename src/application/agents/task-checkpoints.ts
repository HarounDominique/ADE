import { createRuntimeEvidence } from "../../domain/runtime-evidence.js";
import { AdeStore, type TaskCheckpoint } from "../../persistence/sqlite-store.js";
import { loadGatePolicy } from "../change-review/gate-policy.js";
import { createTurnCheckpoint, restoreTurnCheckpoint, turnWrites } from "./turn-checkpoint.js";

/** What the restore refuses to do, told apart from what it failed to do: going
    back without an explicit confirmation is the guard working. */
export class CheckpointBlockedError extends Error {}

/** A turn allowed to write gets its way back before it runs, not after. The
    checkpoint belongs to the Task, so the operator finds it where the work is
    judged rather than having to know a Git incantation. A turn that only reads
    leaves none: there would be nothing to go back from. */
export async function captureTurnCheckpoint(
  store: AdeStore,
  input: { taskId: string; sessionId?: string; provider: string; directory: string; turnId: string; grantedPermissions?: readonly string[] },
): Promise<TaskCheckpoint | undefined> {
  if (!turnWrites(input.grantedPermissions)) return undefined;
  if (!store.rehydrateTask(input.taskId)) return undefined;
  const label = `${input.provider} turn ${input.turnId}`;
  const id = `checkpoint-${input.taskId}-${input.turnId}`;
  const checkpoint = await createTurnCheckpoint({ directory: input.directory, label, id });
  const record: TaskCheckpoint = {
    id,
    taskId: input.taskId,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    provider: input.provider,
    directory: checkpoint.directory,
    ref: checkpoint.ref,
    commit: checkpoint.commit,
    label,
    files: checkpoint.files,
    createdAt: new Date().toISOString(),
  };
  store.saveTaskCheckpoint(record);
  return record;
}

/** Restoring is destructive by definition -- it throws away whatever the turn
    wrote -- so it happens only on an explicit confirmation, and it leaves its
    own checkpoint behind so the operator can undo the undo. */
export async function restoreTaskCheckpoint(
  store: AdeStore,
  input: { checkpointId: string; actor: string; reason: string; confirmed: boolean },
): Promise<{ checkpoint: TaskCheckpoint; removed: readonly string[]; restored: number; previousCommit: string }> {
  const checkpoint = store.getTaskCheckpoint(input.checkpointId);
  if (!checkpoint) throw new CheckpointBlockedError(`No checkpoint matches ${input.checkpointId}`);
  if (!input.confirmed) throw new CheckpointBlockedError("Restoring a checkpoint discards the current working tree and needs an explicit confirmation");
  const result = await restoreTurnCheckpoint({
    directory: checkpoint.directory,
    commit: checkpoint.commit,
    label: `before restoring ${checkpoint.label}`,
  });
  const restoredAt = new Date().toISOString();
  store.markTaskCheckpointRestored(checkpoint.id, restoredAt);
  /** The way back from the restore is a checkpoint like any other, so it is
      listed beside the rest instead of living only in the reflog. */
  store.saveTaskCheckpoint({
    id: `checkpoint-${checkpoint.taskId}-undo-${result.previous.commit.slice(0, 12)}`,
    taskId: checkpoint.taskId,
    ...(checkpoint.sessionId ? { sessionId: checkpoint.sessionId } : {}),
    directory: result.previous.directory,
    ref: result.previous.ref,
    commit: result.previous.commit,
    label: `Before restoring ${checkpoint.label}`,
    files: result.previous.files,
    createdAt: restoredAt,
  });
  store.saveGitOperation({
    id: `git-checkpoint-${checkpoint.id}-${result.previous.commit.slice(0, 12)}`,
    taskId: checkpoint.taskId,
    operation: "checkpoint.restore",
    reference: checkpoint.commit,
    actor: input.actor,
    reason: input.reason,
    metadata: JSON.stringify({ checkpointId: checkpoint.id, removed: result.removed, undoCommit: result.previous.commit }),
  });
  const policy = loadGatePolicy(checkpoint.directory);
  store.saveRuntimeEvidence(createRuntimeEvidence({
    id: `runtime-${checkpoint.taskId}-restore-${result.previous.commit.slice(0, 12)}`,
    taskId: checkpoint.taskId,
    ...(checkpoint.sessionId ? { sessionId: checkpoint.sessionId } : {}),
    type: "checkpoint.restore",
    summary: `Restored the working tree to ${checkpoint.label}${result.removed.length ? `, removing ${result.removed.length} file${result.removed.length === 1 ? "" : "s"}` : ""}`,
    at: restoredAt,
    policy: policy.evidence,
  }));
  store.pruneRuntimeEvidence(checkpoint.taskId, policy.evidence.maxItems);
  return { checkpoint, removed: result.removed, restored: result.restored, previousCommit: result.previous.commit };
}
