import { createInterface } from "node:readline";
import { AdeStore } from "./persistence/sqlite-store.js";
import { getProjectSnapshot } from "./application/project-snapshot.js";

export type DesktopRequest = {
  id: string | number;
  method: string;
  params?: { projectId?: string };
};

export type DesktopResponse = {
  id: string | number;
  result?: unknown;
  error?: { code: string; message: string };
};

export function handleDesktopRequest(store: AdeStore, request: DesktopRequest): DesktopResponse {
  try {
    if (request.method !== "project.snapshot") {
      return { id: request.id, error: { code: "METHOD_NOT_FOUND", message: `Unknown method: ${request.method}` } };
    }
    const projectId = request.params?.projectId;
    if (!projectId) {
      return { id: request.id, error: { code: "INVALID_PARAMS", message: "projectId is required" } };
    }
    return { id: request.id, result: getProjectSnapshot(store, projectId) };
  } catch (error) {
    return {
      id: request.id,
      error: { code: "REQUEST_FAILED", message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export async function runDesktopSidecar(): Promise<void> {
  const store = new AdeStore(process.env.ADE_DB_PATH ?? `${process.cwd()}/.ade/ade.db`);
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

if (import.meta.url === `file://${process.argv[1]}`) {
  runDesktopSidecar().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
