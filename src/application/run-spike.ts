import { Task } from "../domain/task.js";
import { captureGitChanges, type GitChanges } from "../adapters/git-changes.js";
import type { AgentRuntimePort, RuntimeEvent } from "../ports/agent-runtime.js";
import { createChangeSet, type ChangeSet } from "../domain/change-set.js";
import { AdeStore } from "../persistence/sqlite-store.js";
import { createTask } from "./tasks/task-commands.js";

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
  input: { taskId: string; directory: string; intent: string; agent?: string; signal?: AbortSignal; store?: AdeStore },
): Promise<SpikeResult> {
  const task = input.store
    ? createTask(input.store, { id: input.taskId, intent: input.intent, repositoryPath: input.directory })
    : Task.create({ id: input.taskId, intent: input.intent, repositoryPath: input.directory });
  task.transition("READY", "Spike accepted", "human");
  input.store?.saveTask(task);
  const session = await runtime.createSession({ directory: input.directory, title: input.taskId });
  task.transition("IN_PROGRESS", "OpenCode session created", "ade");
  input.store?.saveTask(task);

  const eventPromise = collectUntilIdle(runtime.events(input.signal), input.signal);
  await runtime.prompt(session, {
    text: input.intent,
    ...(input.agent ? { agent: input.agent } : {}),
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
): Promise<RuntimeEvent[]> {
  const events: RuntimeEvent[] = [];
  for await (const event of source) {
    events.push(event);
    const payload = event.payload as { type?: string; properties?: { sessionID?: string } };
    if (payload.type === "session.idle") break;
    if (signal?.aborted) break;
  }
  return events;
}
