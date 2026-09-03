import { createInterface } from "node:readline";
import { isSea } from "node:sea";
import { advanceTask, createTask } from "./application/tasks/task-commands.js";
import type { TaskStatus } from "./domain/task.js";
import { AdeStore } from "./persistence/sqlite-store.js";
import { getProjectSnapshot } from "./application/project-snapshot.js";

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
  agentRuntime: "DISCONNECTED";
  activeTaskId: null;
  lastEventAt: null;
  lastError: null;
};

function getRuntimeStatus(): RuntimeStatus {
  return {
    sidecar: "READY",
    agentRuntime: "DISCONNECTED",
    activeTaskId: null,
    lastEventAt: null,
    lastError: null,
  };
}

export function handleDesktopRequest(store: AdeStore, request: DesktopRequest): DesktopResponse {
  try {
    if (!['project.snapshot', 'task.create', 'task.advance', 'runtime.status'].includes(request.method)) {
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
      process.stdout.write(`${JSON.stringify(handleDesktopRequest(store, request))}\n`);
    }
  } finally {
    input.close();
    store.close();
  }
}

const directEntrypoint = ["desktop-sidecar.ts", "desktop-sidecar.js", "desktop-sidecar.cjs"].some((name) => process.argv[1]?.endsWith(name));
if (directEntrypoint || isSea()) {
  runDesktopSidecar().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
