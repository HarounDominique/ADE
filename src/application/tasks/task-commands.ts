import { Task, type TaskStatus } from "../../domain/task.js";
import { AdeStore } from "../../persistence/sqlite-store.js";

export function createTask(
  store: AdeStore,
  input: { id: string; intent: string; projectId?: string; repositoryPath?: string; actor?: string },
): Task {
  const task = Task.create(input);
  store.saveTask(task);
  return task;
}

export function getTask(store: AdeStore, id: string): Task {
  const task = store.rehydrateTask(id);
  if (!task) throw new Error(`Task not found: ${id}`);
  return task;
}

export function advanceTask(
  store: AdeStore,
  input: { id: string; next: TaskStatus; reason: string; actor?: string },
): Task {
  const task = getTask(store, input.id);
  task.transition(input.next, input.reason, input.actor);
  store.saveTask(task);
  return task;
}
