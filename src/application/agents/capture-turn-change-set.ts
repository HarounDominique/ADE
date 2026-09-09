import { createChangeSet, type ChangeSet } from "../../domain/change-set.js";
import { createRuntimeEvidence } from "../../domain/runtime-evidence.js";
import type { Task, TaskStatus } from "../../domain/task.js";
import { captureGitChanges } from "../../adapters/git-changes.js";
import type { FileDiff } from "../../ports/agent-runtime.js";
import { AdeStore } from "../../persistence/sqlite-store.js";
import { loadGatePolicy } from "../change-review/gate-policy.js";

export type TurnCapture = {
  changeSet: ChangeSet;
  taskStatus: TaskStatus;
};

/** A turn that changed the repository is the pipeline's entry point, whichever
    provider ran it. Until now only `task.run` produced a ChangeSet, and only
    with OpenCode, so the surface the operator actually works in left nothing
    to review. */
export async function captureTurnChangeSet(
  store: AdeStore,
  input: { taskId: string; sessionId: string; directory: string; turnId: string; provider: string; model?: string; runtimeDiff: readonly FileDiff[] },
): Promise<TurnCapture | undefined> {
  const task = store.rehydrateTask(input.taskId);
  if (!task?.repositoryPath) return undefined;
  const git = await captureGitChanges(input.directory);
  /** A conversation that only read the repository has nothing to review, and a
      ChangeSet with no change would make the `build` gate pass for free. */
  if (!git.status.trim() && !git.untracked.length && !input.runtimeDiff.length) return undefined;
  const changeSet = createChangeSet({
    id: `changeset-${input.taskId}-${input.turnId}`,
    taskId: input.taskId,
    sessionId: input.sessionId,
    directory: input.directory,
    runtimeDiff: input.runtimeDiff,
    git,
  });
  store.saveChangeSet(changeSet);
  const policy = loadGatePolicy(task.repositoryPath);
  store.saveRuntimeEvidence(createRuntimeEvidence({
    id: `runtime-${input.taskId}-${input.turnId}-turn`,
    taskId: input.taskId,
    sessionId: input.sessionId,
    type: "agent.turn",
    summary: turnSummary(input.provider, input.model, git, input.runtimeDiff),
    ...(git.status.trim() ? { details: git.status.trim() } : {}),
    policy: policy.evidence,
  }));
  store.pruneRuntimeEvidence(input.taskId, policy.evidence.maxItems);
  const taskStatus = advanceToImplemented(store, task, input.provider);
  return { changeSet, taskStatus };
}

function turnSummary(provider: string, model: string | undefined, git: { status: string; untracked: readonly string[] }, runtimeDiff: readonly FileDiff[]): string {
  const tracked = git.status.split("\n").filter((line) => line.trim()).length;
  const files = tracked || runtimeDiff.length;
  const agent = model ? `${provider} (${model})` : provider;
  return `${agent} changed ${files} file${files === 1 ? "" : "s"}${git.untracked.length ? `, ${git.untracked.length} untracked` : ""}`;
}

/** ADE walks the Task to `IMPLEMENTED` only along transitions the workflow
    already allows, and leaves it where it is when there is no legal path --
    a second turn on a Task already implemented, or one under review. Recording
    the change never depends on being able to move the Task. */
function advanceToImplemented(store: AdeStore, task: Task, provider: string): TaskStatus {
  const reason = `Agent turn captured a ChangeSet (${provider})`;
  const path: readonly TaskStatus[] = ["READY", "CHANGES_REQUESTED", "BLOCKED"].includes(task.currentStatus)
    ? ["IN_PROGRESS", "IMPLEMENTED"]
    : task.currentStatus === "IN_PROGRESS" ? ["IMPLEMENTED"] : [];
  for (const next of path) {
    try { task.transition(next, reason, "ade"); } catch { break; }
  }
  if (path.length) store.saveTask(task);
  return task.currentStatus;
}
