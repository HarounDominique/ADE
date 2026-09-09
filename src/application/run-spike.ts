import { Task } from "../domain/task.js";
import { captureGitChanges, type GitChanges } from "../adapters/git-changes.js";
import type { AgentPermission, AgentRuntimePort, RuntimeEvent } from "../ports/agent-runtime.js";
import { createChangeSet, type ChangeSet } from "../domain/change-set.js";
import { AdeStore } from "../persistence/sqlite-store.js";
import { createTask, getTask } from "./tasks/task-commands.js";

export type SpikeResult = {
  task: Task;
  taskId: string;
  sessionId: string;
  events: readonly RuntimeEvent[];
  diff: readonly unknown[];
  git: GitChanges;
  changeSet: ChangeSet;
  taskStatus: Task["currentStatus"];
};

export async function runSpike(
  runtime: AgentRuntimePort,
  input: { taskId: string; directory: string; intent: string; acceptanceCriteria?: readonly string[]; agent?: string; grantedPermissions?: readonly AgentPermission[]; signal?: AbortSignal; store?: AdeStore; existingTask?: boolean; onEvent?: (event: RuntimeEvent) => void },
): Promise<SpikeResult> {
  const task = input.store && input.existingTask
    ? getTask(input.store, input.taskId)
    : input.store
      ? createTask(input.store, { id: input.taskId, intent: input.intent, repositoryPath: input.directory, ...(input.acceptanceCriteria ? { acceptanceCriteria: input.acceptanceCriteria } : {}) })
      /** A Task this run invents still has to say what done means before it is
          READY; the caller states it rather than the runner inventing a bar. */
      : Task.create({ id: input.taskId, intent: input.intent, repositoryPath: input.directory, ...(input.acceptanceCriteria ? { acceptanceCriteria: input.acceptanceCriteria } : {}) });
  if (!input.existingTask) task.transition("READY", "Spike accepted", "human");
  if (!(["READY", "CHANGES_REQUESTED", "BLOCKED"] as const).includes(task.currentStatus as "READY" | "CHANGES_REQUESTED" | "BLOCKED")) {
    throw new Error(`Task cannot start from ${task.currentStatus}`);
  }
  input.store?.saveTask(task);
  const session = await runtime.createSession({ directory: input.directory, title: input.taskId });
  task.transition("IN_PROGRESS", "OpenCode session created", "ade");
  input.store?.saveTask(task);

  const eventPromise = collectUntilIdle(runtime.events(input.signal), input.signal, input.onEvent);
  await runtime.prompt(session, {
    text: input.intent,
    ...(input.agent ? { agent: input.agent } : {}),
    /** A CLI runtime writes nothing without permission, so an Implementer run
        that is not told what it may do can only read. */
    ...(input.grantedPermissions ? { grantedPermissions: input.grantedPermissions } : {}),
  });
  const events = await eventPromise;
  const diff = await runtime.diff(session);
  const git = await captureGitChanges(input.directory);
  const changeSet = createChangeSet({
    id: `changeset-${input.taskId}`,
    taskId: task.id,
    sessionId: session.id,
    directory: input.directory,
    runtimeDiff: diff,
    git,
  });
  task.transition("IMPLEMENTED", "OpenCode prompt completed and diff captured", "ade");
  input.store?.saveTask(task);
  input.store?.saveChangeSet(changeSet);
  return { task, taskId: task.id, sessionId: session.id, events, diff, git, changeSet, taskStatus: task.currentStatus };
}

async function collectUntilIdle(
  source: AsyncIterable<RuntimeEvent>,
  signal?: AbortSignal,
  onEvent?: (event: RuntimeEvent) => void,
): Promise<RuntimeEvent[]> {
  const events: RuntimeEvent[] = [];
  for await (const event of source) {
    events.push(event);
    onEvent?.(event);
    const payload = event.payload as { type?: string; properties?: { sessionID?: string } };
    if (payload.type === "session.idle") break;
    if (signal?.aborted) break;
  }
  return events;
}
