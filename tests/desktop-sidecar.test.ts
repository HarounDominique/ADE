import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { Project } from "../src/domain/project.js";
import { Task } from "../src/domain/task.js";
import { handleDesktopRequest } from "../src/desktop-sidecar.js";

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
