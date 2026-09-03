import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { Task } from "../src/domain/task.js";
import { createChangeSet } from "../src/domain/change-set.js";
import { Project } from "../src/domain/project.js";

test("SQLite persists Task and its ChangeSet relationship", () => {
  const store = new AdeStore();
  const task = Task.create({ id: "task-persisted", intent: "Capture a change" });
  task.transition("READY", "Intent accepted", "human");
  store.saveTask(task);
  const changeSet = createChangeSet({
    id: "changeset-1",
    taskId: task.id,
    sessionId: "session-1",
    directory: "/tmp/project",
    runtimeDiff: [{ path: "new.txt" }],
    git: { status: "?? new.txt\n", patch: "", untracked: ["new.txt"] },
  });
  store.saveChangeSet(changeSet);

  const persistedTask = store.getTask(task.id);
  const persistedChangeSet = store.getChangeSet(changeSet.id);
  assert.equal(persistedTask?.status, "READY");
  assert.equal(JSON.parse(persistedTask?.events ?? "[]").length, 2);
  assert.equal(persistedChangeSet?.taskId, task.id);
  assert.deepEqual(JSON.parse(persistedChangeSet?.untracked ?? "[]"), ["new.txt"]);
  store.close();
});

test("SQLite persists Project and rehydrates a Task with its history", () => {
  const store = new AdeStore();
  const project = Project.create({ id: "project-1", name: "ADE", repositoryPath: "/tmp/ade" });
  const repository = { path: "/tmp/ade", gitRoot: "/tmp/ade", branch: "main" };
  store.saveProject(project, repository);
  const task = Task.create({ id: "task-project", intent: "Inspect", projectId: project.id, repositoryPath: project.repositoryPath });
  task.transition("READY", "Intent framed", "human");
  store.saveTask(task);

  const persistedProject = store.getProject(project.id);
  const rehydrated = store.rehydrateTask(task.id);
  assert.equal(persistedProject?.gitRoot, "/tmp/ade");
  assert.equal(rehydrated?.currentStatus, "READY");
  assert.equal(rehydrated?.projectId, project.id);
  assert.deepEqual(rehydrated?.history(), task.history());
  store.close();
});

test("SQLite lists Projects and Tasks for the desktop read model", () => {
  const store = new AdeStore();
  const first = Project.create({ id: "project-a", name: "First", repositoryPath: "/tmp/first" });
  const second = Project.create({ id: "project-b", name: "Second", repositoryPath: "/tmp/second" });
  store.saveProject(first, { path: "/tmp/first", gitRoot: "/tmp/first", branch: "main" });
  store.saveProject(second, { path: "/tmp/second", gitRoot: "/tmp/second", branch: "main" });
  store.saveTask(Task.create({ id: "task-b", intent: "Second task", projectId: second.id }));
  store.saveTask(Task.create({ id: "task-a", intent: "First task", projectId: first.id }));

  assert.deepEqual(store.listProjects().map((project) => project.id), ["project-a", "project-b"]);
  assert.deepEqual(store.listTasks().map((task) => task.id), ["task-a", "task-b"]);
  assert.equal(store.listTasks()[0]?.projectId, first.id);
  store.close();
});

test("SQLite migrates an existing ChangeSet table when directory is added", () => {
  const path = join(tmpdir(), `ade-legacy-${Date.now()}.db`);
  const legacy = new DatabaseSync(path);
  legacy.exec("CREATE TABLE change_sets (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, session_id TEXT NOT NULL, captured_at TEXT NOT NULL, runtime_diff_json TEXT NOT NULL, git_status TEXT NOT NULL, git_patch TEXT NOT NULL, untracked_json TEXT NOT NULL)");
  legacy.close();
  const store = new AdeStore(path);
  const columns = store.db.prepare("PRAGMA table_info(change_sets)").all() as Array<{ name: string }>;
  assert.ok(columns.some((column) => column.name === "directory"));
  store.close();
});

test("SQLite persists resumable agent sessions per Task", () => {
  const store = new AdeStore();
  const task = Task.create({ id: "task-session", intent: "Resume agent work" });
  store.saveTask(task);
  store.saveAgentSession({ id: "session-1", taskId: task.id, provider: "codex", directory: "/tmp/project", status: "COMPLETED", createdAt: "2026-09-03T00:00:00.000Z" });
  assert.deepEqual(store.listAgentSessions(task.id).map((session) => session.id), ["session-1"]);
  assert.equal(store.listAgentSessions(task.id)[0]?.provider, "codex");
  store.close();
});
