import { createInterface } from "node:readline";
import { isSea } from "node:sea";
import { advanceTask, createTask } from "./application/tasks/task-commands.js";
import type { TaskStatus } from "./domain/task.js";
import { AdeStore } from "./persistence/sqlite-store.js";
import { getProjectSnapshot } from "./application/project-snapshot.js";
import { OpenCodeHttpRuntime } from "./adapters/opencode-http-runtime.js";
import { runSpike } from "./application/run-spike.js";

export type DesktopRequest = {
  id: string | number;
  method: string;
  params?: { projectId?: string; taskId?: string; intent?: string; repositoryPath?: string; next?: TaskStatus; reason?: string; actor?: string };
};

export type DesktopResponse = {
  id: string | number;
  result?: unknown;
  error?: { code: string; message: string };
};

export type RuntimeStatus = {
  sidecar: "READY";
  agentRuntime: "DISCONNECTED" | "RUNNING" | "CONNECTED" | "FAILED";
  activeTaskId: string | null;
  lastEventAt: string | null;
  lastError: string | null;
};

const runtimeStatus: RuntimeStatus = {
  sidecar: "READY",
  agentRuntime: "DISCONNECTED",
  activeTaskId: null,
  lastEventAt: null,
  lastError: null,
};

function getRuntimeStatus(): RuntimeStatus {
  return {
    ...runtimeStatus,
  };
}

export function handleDesktopRequest(store: AdeStore, request: DesktopRequest): DesktopResponse {
  try {
    if (!['project.snapshot', 'task.create', 'task.advance', 'runtime.status', 'task.run'].includes(request.method)) {
      return { id: request.id, error: { code: "METHOD_NOT_FOUND", message: `Unknown method: ${request.method}` } };
    }
    if (request.method === "project.snapshot") {
      const projectId = request.params?.projectId;
      if (!projectId) {
        return { id: request.id, error: { code: "INVALID_PARAMS", message: "projectId is required" } };
      }
      return { id: request.id, result: getProjectSnapshot(store, projectId) };
    }
    if (request.method === "runtime.status") {
      return { id: request.id, result: getRuntimeStatus() };
    }
    const { taskId, intent, projectId, repositoryPath, next, reason, actor } = request.params ?? {};
    if (request.method === "task.advance") {
      if (!taskId || !next || !reason) {
        return { id: request.id, error: { code: "INVALID_PARAMS", message: "taskId, next and reason are required" } };
      }
      const task = advanceTask(store, { id: taskId, next, reason, ...(actor ? { actor } : {}) });
      return { id: request.id, result: { id: task.id, intent: task.intent, status: task.currentStatus, projectId: task.projectId ?? null } };
    }
    if (!taskId || !intent) {
      return { id: request.id, error: { code: "INVALID_PARAMS", message: "taskId and intent are required" } };
    }
    const task = createTask(store, {
      id: taskId,
      intent,
      ...(projectId ? { projectId } : {}),
      ...(repositoryPath ? { repositoryPath } : {}),
    });
    return { id: request.id, result: { id: task.id, intent: task.intent, status: task.currentStatus, projectId: task.projectId ?? null } };
  } catch (error) {
    return {
      id: request.id,
      error: { code: "REQUEST_FAILED", message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export async function runDesktopSidecar(): Promise<void> {
  const databasePath = process.env.ADE_DB_PATH;
  if (!databasePath) throw new Error("ADE_DB_PATH must point to the ADE metadata database");
  const store = new AdeStore(databasePath);
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  try {
    for await (const line of input) {
      if (!line.trim()) continue;
      let request: DesktopRequest;
      try {
        request = JSON.parse(line) as DesktopRequest;
      } catch {
        process.stdout.write(`${JSON.stringify({ id: null, error: { code: "INVALID_JSON", message: "Request must be valid JSON" } })}\n`);
        continue;
      }
      if (request.method === "task.run") {
        startTaskRun(store, request);
      } else {
        process.stdout.write(`${JSON.stringify(handleDesktopRequest(store, request))}\n`);
      }
    }
  } finally {
    input.close();
    store.close();
  }
}

function startTaskRun(store: AdeStore, request: DesktopRequest): void {
  const taskId = request.params?.taskId;
  const task = taskId ? store.rehydrateTask(taskId) : undefined;
  if (!taskId || !task?.repositoryPath) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "INVALID_PARAMS", message: "taskId must reference a Task with a repositoryPath" } })}\n`);
    return;
  }
  if (runtimeStatus.activeTaskId) {
    process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: "RUNTIME_BUSY", message: `Task ${runtimeStatus.activeTaskId} is already running` } })}\n`);
    return;
  }
  runtimeStatus.agentRuntime = "RUNNING";
  runtimeStatus.activeTaskId = taskId;
  runtimeStatus.lastError = null;
  process.stdout.write(`${JSON.stringify({ id: request.id, result: { accepted: true, taskId, status: "RUNNING" } })}\n`);
  void runSpike(new OpenCodeHttpRuntime(process.env.OPENCODE_URL), {
    taskId,
    directory: task.repositoryPath,
    intent: task.intent,
    store,
    existingTask: true,
    onEvent: (event) => {
      runtimeStatus.lastEventAt = new Date().toISOString();
      process.stdout.write(`${JSON.stringify({ type: "runtime.event", taskId, event, status: getRuntimeStatus() })}\n`);
    },
  }).then(() => {
    runtimeStatus.agentRuntime = "CONNECTED";
    runtimeStatus.activeTaskId = null;
    process.stdout.write(`${JSON.stringify({ type: "runtime.completed", taskId, status: getRuntimeStatus() })}\n`);
  }).catch((error: unknown) => {
    runtimeStatus.agentRuntime = "FAILED";
    runtimeStatus.activeTaskId = null;
    runtimeStatus.lastError = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ type: "runtime.failed", taskId, status: getRuntimeStatus() })}\n`);
  });
}

const directEntrypoint = ["desktop-sidecar.ts", "desktop-sidecar.js", "desktop-sidecar.cjs"].some((name) => process.argv[1]?.endsWith(name));
if (directEntrypoint || isSea()) {
  runDesktopSidecar().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
