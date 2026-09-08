import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { Project } from "../src/domain/project.js";
import { Task } from "../src/domain/task.js";
import { handleDesktopRequest } from "../src/desktop-sidecar.js";
import type { Readable } from "node:stream";

type SidecarMessage = { id?: string; type?: string; [key: string]: unknown };

/** The sidecar interleaves answers and push events on one stream, and a run
    emits both, so a test that reads a single chunk reads whatever arrived
    first. This buffers every line and waits for the one it asked for. */
function readSidecarLines(stream: Readable, timeoutMs = 8_000): { waitFor(predicate: (message: SidecarMessage) => boolean): Promise<SidecarMessage> } {
  const received: SidecarMessage[] = [];
  const waiting: Array<{ predicate: (message: SidecarMessage) => boolean; resolve: (message: SidecarMessage) => void }> = [];
  let buffer = "";
  stream.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let message: SidecarMessage;
      try { message = JSON.parse(line) as SidecarMessage; } catch { continue; }
      received.push(message);
      const index = waiting.findIndex((entry) => entry.predicate(message));
      if (index >= 0) waiting.splice(index, 1)[0]?.resolve(message);
    }
  });
  return {
    waitFor(predicate) {
      const already = received.find((message) => predicate(message));
      if (already) return Promise.resolve(already);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("sidecar did not send a matching message")), timeoutMs);
        waiting.push({ predicate, resolve: (message) => { clearTimeout(timer); resolve(message); } });
      });
    },
  };
}

test("desktop sidecar answers project.snapshot with a structured result", () => {
  const store = new AdeStore();
  const project = Project.create({ id: "sidecar-project", name: "ADE", repositoryPath: "/tmp/ade" });
  store.saveProject(project, { path: "/tmp/ade", gitRoot: "/tmp/ade", branch: "main" });
  store.saveTask(Task.create({ id: "sidecar-task", intent: "Inspect UI", projectId: project.id }));

  const response = handleDesktopRequest(store, { id: "request-1", method: "project.snapshot", params: { projectId: project.id } });

  assert.equal(response.id, "request-1");
  assert.equal((response.result as { project: { id: string } }).project.id, project.id);
  assert.equal(response.error, undefined);
  store.close();
});

test("desktop sidecar lists registered projects for the Git context selector", () => {
  const store = new AdeStore();
  const first = Project.create({ id: "project-a", name: "Alpha", repositoryPath: "/tmp/alpha" });
  const second = Project.create({ id: "project-b", name: "Beta", repositoryPath: "/tmp/beta" });
  store.saveProject(first, { path: "/tmp/alpha", gitRoot: "/tmp/alpha", branch: "main" });
  store.saveProject(second, { path: "/tmp/beta", gitRoot: "/tmp/beta", branch: "develop" });
  const response = handleDesktopRequest(store, { id: "projects-1", method: "project.list" });

  assert.deepEqual((response.result as Array<{ id: string }>).map((project) => project.id), ["project-a", "project-b"]);
  store.close();
});

test("desktop sidecar removes a project from ADE without touching its files", () => {
  const store = new AdeStore();
  const project = Project.create({ id: "project-remove", name: "Remove me", repositoryPath: "/tmp/remove-me" });
  store.saveProject(project, { path: "/tmp/remove-me", gitRoot: "/tmp/remove-me", branch: "main" });

  const response = handleDesktopRequest(store, { id: "remove-1", method: "project.remove", params: { projectId: project.id } });

  assert.deepEqual(response, { id: "remove-1", result: { id: project.id, removed: true } });
  assert.equal(store.getProject(project.id), undefined);
  store.close();
});

test("desktop sidecar deletes a saved agent conversation", () => {
  const store = new AdeStore();
  store.saveAgentSession({ id: "session-sidecar-delete", provider: "codex", directory: "/tmp/project", status: "COMPLETED", createdAt: "2026-09-03T00:00:00.000Z" });

  const response = handleDesktopRequest(store, { id: "delete-session-1", method: "agent.session.delete", params: { sessionId: "session-sidecar-delete" } });

  assert.deepEqual(response, { id: "delete-session-1", result: { id: "session-sidecar-delete", removed: true } });
  assert.deepEqual(store.listAgentSessions(), []);
  store.close();
});

test("desktop sidecar refuses to delete a conversation from another Project", () => {
  const store = new AdeStore();
  store.saveAgentSession({ id: "session-project-bound", projectId: "project-a", provider: "codex", directory: "/tmp/project-a", status: "COMPLETED", createdAt: "2026-09-06T00:00:00.000Z" });

  const response = handleDesktopRequest(store, { id: "delete-wrong-project", method: "agent.session.delete", params: { sessionId: "session-project-bound", projectId: "project-b" } });

  assert.deepEqual(response, { id: "delete-wrong-project", error: { code: "SESSION_PROJECT_MISMATCH", message: "This conversation belongs to another Project" } });
  assert.equal(store.getAgentSession("session-project-bound")?.id, "session-project-bound");
  store.close();
});

test("desktop sidecar isolates saved agent terminal sessions by Project", () => {
  const store = new AdeStore();
  const saved = handleDesktopRequest(store, { id: "terminal-save", method: "terminal.history.save", params: { sessionId: "terminal-a", projectId: "project-a", provider: "claude", transcript: "hello", startedAt: "2026-09-08T10:00:00.000Z", endedAt: "2026-09-08T10:05:00.000Z" } });
  assert.deepEqual(saved, { id: "terminal-save", result: { id: "terminal-a", saved: true } });
  assert.equal((handleDesktopRequest(store, { id: "terminal-list", method: "terminal.history.list", params: { projectId: "project-a" } }).result as Array<{ id: string }>)[0]?.id, "terminal-a");
  assert.equal(handleDesktopRequest(store, { id: "terminal-get-wrong", method: "terminal.history.get", params: { sessionId: "terminal-a", projectId: "project-b" } }).error?.code, "TERMINAL_SESSION_PROJECT_MISMATCH");
  store.close();
});

test("desktop sidecar returns actionable protocol errors", () => {
  const store = new AdeStore();

  assert.deepEqual(handleDesktopRequest(store, { id: 1, method: "unknown" }), {
    id: 1,
    error: { code: "METHOD_NOT_FOUND", message: "Unknown method: unknown" },
  });
  assert.deepEqual(handleDesktopRequest(store, { id: 2, method: "project.snapshot" }), {
    id: 2,
    error: { code: "INVALID_PARAMS", message: "projectId is required" },
  });
  assert.deepEqual(handleDesktopRequest(store, { id: 3, method: "task.create" }), {
    id: 3,
    error: { code: "INVALID_PARAMS", message: "taskId and intent are required" },
  });
  assert.deepEqual(handleDesktopRequest(store, { id: 4, method: "task.advance" }), {
    id: 4,
    error: { code: "INVALID_PARAMS", message: "taskId, next and reason are required" },
  });
  assert.deepEqual(handleDesktopRequest(store, { id: 5, method: "runtime.status" }), {
    id: 5,
    result: {
      sidecar: "READY",
      agentRuntime: "DISCONNECTED",
      activeTaskId: null,
      lastEventAt: null,
      lastError: null,
    },
  });
  store.close();
});

test("desktop sidecar advances a Task through the application use case", () => {
  const store = new AdeStore();
  const task = Task.create({ id: "task-advance", intent: "Advance Work task", projectId: "ade" });
  store.saveTask(task);
  const response = handleDesktopRequest(store, {
    id: "advance-1",
    method: "task.advance",
    params: { taskId: task.id, next: "READY", reason: "Acceptance criteria recorded", actor: "human" },
  });

  assert.deepEqual(response.result, { id: task.id, intent: task.intent, status: "READY", projectId: "ade" });
  assert.equal(store.getTask(task.id)?.status, "READY");
  store.close();
});

test("desktop sidecar creates a Task through the application use case", () => {
  const store = new AdeStore();
  const response = handleDesktopRequest(store, {
    id: "task-1",
    method: "task.create",
    params: { taskId: "task-sidecar", intent: "Build Work screen", projectId: "ade" },
  });

  assert.deepEqual(response.result, { id: "task-sidecar", intent: "Build Work screen", status: "DRAFT", projectId: "ade" });
  assert.equal(store.getTask("task-sidecar")?.intent, "Build Work screen");
  store.close();
});

test("desktop sidecar process answers over stdin/stdout", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ade-sidecar-process-"));
  const child = spawn(process.execPath, ["--import", "tsx", "src/desktop-sidecar.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ADE_DB_PATH: join(directory, "ade.db") },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdin.write('{"id":"process-1","method":"project.snapshot","params":{"projectId":"missing"}}\n');
  const [output] = await once(child.stdout, "data");
  const response = JSON.parse(output.toString()) as { id: string; error: { code: string } };

  assert.equal(response.id, "process-1");
  assert.equal(response.error.code, "REQUEST_FAILED");
  child.kill();
  await once(child, "close");
  rmSync(directory, { recursive: true, force: true });
});

test("desktop sidecar accepts an Implementer run asynchronously", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ade-sidecar-run-"));
  const databasePath = join(directory, "ade.db");
  const store = new AdeStore(databasePath);
  const task = Task.create({ id: "task-run", intent: "Run Implementer", repositoryPath: directory });
  task.transition("READY", "Ready for implementation", "human");
  store.saveTask(task);
  store.close();
  const child = spawn(process.execPath, ["--import", "tsx", "src/desktop-sidecar.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ADE_DB_PATH: databasePath, OPENCODE_URL: "http://127.0.0.1:1" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdin.write(JSON.stringify({ id: "run-1", method: "task.run", params: { taskId: task.id } }) + "\n");
  const [output] = await once(child.stdout, "data");
  const response = JSON.parse(output.toString()) as { id: string; result: { accepted: boolean; status: string } };

  assert.deepEqual(response, { id: "run-1", result: { accepted: true, taskId: task.id, status: "RUNNING" } });
  child.kill();
  await once(child, "close");
  rmSync(directory, { recursive: true, force: true });
});

test("desktop sidecar rejects an Implementer run from an ineligible Task state", () => {
  const store = new AdeStore();
  const task = Task.create({ id: "task-draft-run", intent: "Do not run yet", repositoryPath: "/tmp/ade" });
  store.saveTask(task);

  const response = handleDesktopRequest(store, { id: "run-draft", method: "task.run", params: { taskId: task.id } });

  assert.deepEqual(response, {
    id: "run-draft",
    error: { code: "METHOD_NOT_FOUND", message: "Unknown method: task.run" },
  });
  store.close();
});

test("desktop sidecar reports unavailable OpenCode health explicitly", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ade-sidecar-health-"));
  const child = spawn(process.execPath, ["--import", "tsx", "src/desktop-sidecar.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ADE_DB_PATH: join(directory, "ade.db"), OPENCODE_URL: "http://127.0.0.1:1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.write('{"id":"health-1","method":"runtime.health"}\n');
  const [output] = await once(child.stdout, "data");
  const response = JSON.parse(output.toString()) as { id: string; error: { code: string }; status: { agentRuntime: string } };

  assert.equal(response.id, "health-1");
  assert.equal(response.error.code, "RUNTIME_UNAVAILABLE");
  assert.equal(response.status.agentRuntime, "FAILED");
  child.kill();
  await once(child, "close");
  rmSync(directory, { recursive: true, force: true });
});

test("desktop sidecar refuses a network skill install without explicit confirmation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ade-sidecar-install-"));
  const child = spawn(process.execPath, ["--import", "tsx", "src/desktop-sidecar.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ADE_DB_PATH: join(directory, "ade.db") },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdin.write(JSON.stringify({ id: "install-1", method: "skills.install", params: { repositoryPath: directory, intent: "owner/skill-repository" } }) + "\n");
  const [output] = await once(child.stdout, "data");
  const response = JSON.parse(output.toString()) as { id: string; error: { code: string } };

  assert.equal(response.id, "install-1");
  assert.equal(response.error.code, "SKILL_INSTALL_CONFIRMATION_REQUIRED");
  child.kill();
  await once(child, "close");
  rmSync(directory, { recursive: true, force: true });
});

test("desktop sidecar process fails fast without an explicit database", async () => {
  const child = spawn(process.execPath, ["--import", "tsx", "src/desktop-sidecar.ts"], {
    cwd: process.cwd(),
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "ADE_DB_PATH")),
    stdio: ["pipe", "pipe", "pipe"],
  });
  let errorOutput = "";
  child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
  const [code] = await once(child, "close");

  assert.notEqual(code, 0);
  assert.match(errorOutput, /ADE_DB_PATH must point/);
});

test("desktop sidecar lists, starts and stops a run configuration", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ade-sidecar-run-"));
  const projectRoot = mkdtempSync(join(tmpdir(), "ade-run-project-"));
  mkdirSync(join(projectRoot, ".ade"), { recursive: true });
  writeFileSync(join(projectRoot, ".ade", "run.json"), JSON.stringify({
    configurations: [{
      id: "client",
      label: "Client",
      kind: "command",
      command: process.execPath,
      args: ["-e", "process.stdout.write('client up'); setTimeout(() => {}, 10000);"],
      cwd: projectRoot,
    }],
  }), "utf8");

  const child = spawn(process.execPath, ["--import", "tsx", "src/desktop-sidecar.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ADE_DB_PATH: join(directory, "ade.db") },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = readSidecarLines(child.stdout);

  child.stdin.write(`${JSON.stringify({ id: "run-list-1", method: "run.list", params: { repositoryPath: projectRoot } })}\n`);
  const listed = await lines.waitFor((message) => message.id === "run-list-1") as { result: { configurations: Array<{ id: string; label: string }> } };
  assert.deepEqual(listed.result.configurations.map((configuration) => configuration.id), ["client"]);

  child.stdin.write(`${JSON.stringify({ id: "run-start-1", method: "run.start", params: { repositoryPath: projectRoot, configurationId: "client", mode: "run" } })}\n`);
  const started = await lines.waitFor((message) => message.id === "run-start-1") as { result: { id: string; state: string } };
  assert.equal(started.result.state, "RUNNING");

  // The console has to fill while the process lives, so output arrives as its
  // own event rather than with the answer to a later request.
  const output = await lines.waitFor((message) => message.type === "run.output") as { text: string };
  assert.match(output.text, /client up/);

  child.stdin.write(`${JSON.stringify({ id: "run-stop-1", method: "run.stop", params: { repositoryPath: projectRoot, runSessionId: started.result.id } })}\n`);
  const stopped = await lines.waitFor((message) => message.id === "run-stop-1") as { result: { state: string; stoppedByUser: boolean } };
  assert.equal(stopped.result.state, "STOPPED");
  assert.equal(stopped.result.stoppedByUser, true);

  child.kill();
  await once(child, "close");
  rmSync(directory, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

test("desktop sidecar reports an invalid run configuration by field", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ade-sidecar-run-bad-"));
  const projectRoot = mkdtempSync(join(tmpdir(), "ade-run-project-bad-"));
  mkdirSync(join(projectRoot, ".ade"), { recursive: true });
  writeFileSync(join(projectRoot, ".ade", "run.json"), JSON.stringify({ configurations: [{ id: "client", label: "Client", kind: "command" }] }), "utf8");

  const child = spawn(process.execPath, ["--import", "tsx", "src/desktop-sidecar.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ADE_DB_PATH: join(directory, "ade.db") },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = readSidecarLines(child.stdout);

  child.stdin.write(`${JSON.stringify({ id: "run-list-2", method: "run.list", params: { repositoryPath: projectRoot } })}\n`);
  const listed = await lines.waitFor((message) => message.id === "run-list-2") as { error: { code: string; message: string } };
  assert.equal(listed.error.code, "RUN_CONFIG_INVALID");
  assert.match(listed.error.message, /client: a command configuration requires a command/);

  child.kill();
  await once(child, "close");
  rmSync(directory, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

test("a Project without .ade/run.json lists nothing instead of failing", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ade-sidecar-run-none-"));
  const projectRoot = mkdtempSync(join(tmpdir(), "ade-run-project-none-"));

  const child = spawn(process.execPath, ["--import", "tsx", "src/desktop-sidecar.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ADE_DB_PATH: join(directory, "ade.db") },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = readSidecarLines(child.stdout);

  child.stdin.write(`${JSON.stringify({ id: "run-list-3", method: "run.list", params: { repositoryPath: projectRoot } })}\n`);
  const listed = await lines.waitFor((message) => message.id === "run-list-3") as { result: { configurations: unknown[] } };
  assert.deepEqual(listed.result.configurations, []);

  child.kill();
  await once(child, "close");
  rmSync(directory, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

test("desktop sidecar proposes configurations and writes the ones that are accepted", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ade-sidecar-detect-"));
  const projectRoot = mkdtempSync(join(tmpdir(), "ade-detect-project-"));
  mkdirSync(join(projectRoot, "client"), { recursive: true });
  writeFileSync(join(projectRoot, "client", "package.json"), JSON.stringify({ scripts: { start: "ng serve" }, dependencies: { "@angular/core": "^17" } }), "utf8");

  const child = spawn(process.execPath, ["--import", "tsx", "src/desktop-sidecar.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ADE_DB_PATH: join(directory, "ade.db") },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = readSidecarLines(child.stdout);

  child.stdin.write(`${JSON.stringify({ id: "detect-1", method: "run.detect", params: { repositoryPath: projectRoot } })}\n`);
  const detected = await lines.waitFor((message) => message.id === "detect-1") as { result: Array<{ id: string; source: string; ports?: Array<{ port: number }> }> };
  const draft = detected.result.find((candidate) => candidate.id === "client-start");
  assert.equal(draft?.source, "client/package.json");
  assert.equal(draft?.ports?.[0]?.port, 4200);

  const { source, ...accepted } = draft as Record<string, unknown>;
  child.stdin.write(`${JSON.stringify({ id: "save-1", method: "run.save", params: { repositoryPath: projectRoot, configurations: [accepted] } })}\n`);
  const saved = await lines.waitFor((message) => message.id === "save-1") as { result: { configurations: Array<{ id: string }> } };
  assert.deepEqual(saved.result.configurations.map((configuration) => configuration.id), ["client-start"]);

  // The write is the file the next session reads, not only an answer.
  child.stdin.write(`${JSON.stringify({ id: "list-after-save", method: "run.list", params: { repositoryPath: projectRoot } })}\n`);
  const listed = await lines.waitFor((message) => message.id === "list-after-save") as { result: { configurations: Array<{ id: string }> } };
  assert.deepEqual(listed.result.configurations.map((configuration) => configuration.id), ["client-start"]);

  child.stdin.write(`${JSON.stringify({ id: "save-invalid", method: "run.save", params: { repositoryPath: projectRoot, configurations: [{ id: "broken", label: "Broken", kind: "command" }] } })}\n`);
  const refused = await lines.waitFor((message) => message.id === "save-invalid") as { error: { code: string; message: string } };
  assert.equal(refused.error.code, "RUN_CONFIG_INVALID");
  assert.match(refused.error.message, /requires a command/);

  child.kill();
  await once(child, "close");
  rmSync(directory, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});
