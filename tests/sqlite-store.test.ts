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
  assert.equal(persistedProject?.versionControl, "git");
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
  store.saveAgentMessage({ id: "message-1", sessionId: "session-1", role: "user", content: "Inspect this project", createdAt: "2026-09-03T00:01:00.000Z" });
  store.saveAgentMessage({ id: "message-2", sessionId: "session-1", role: "assistant", content: "I found the project root.", createdAt: "2026-09-03T00:02:00.000Z" });
  assert.deepEqual(store.listAgentMessages("session-1").map((message) => message.content), ["Inspect this project", "I found the project root."]);
  store.close();
});

test("a conversation keeps its model until it is deleted", () => {
  const store = new AdeStore();
  store.saveAgentSession({ id: "session-model", provider: "claude", directory: "/tmp/p", model: "haiku", status: "COMPLETED", createdAt: "2026-09-07T00:00:00.000Z" });
  assert.equal(store.getAgentSession("session-model")?.model, "haiku");

  // A later turn that says nothing about the model must not silently reset the
  // choice the operator made for this conversation.
  store.saveAgentSession({ id: "session-model", provider: "claude", directory: "/tmp/p", status: "RUNNING", createdAt: "2026-09-07T00:00:00.000Z" });
  assert.equal(store.getAgentSession("session-model")?.model, "haiku");

  // Going back to the provider default is an explicit empty choice, not silence.
  store.saveAgentSession({ id: "session-model", provider: "claude", directory: "/tmp/p", model: "", status: "COMPLETED", createdAt: "2026-09-07T00:00:00.000Z" });
  assert.equal(store.getAgentSession("session-model")?.model, "");

  assert.equal(store.listAgentSessionsForProject(undefined, "/tmp/p")[0]?.model, "");
  store.deleteAgentSession("session-model");
  assert.equal(store.getAgentSession("session-model"), undefined);
  store.close();
});

test("SQLite isolates agent sessions by Project while keeping legacy directory sessions readable", () => {
  const store = new AdeStore();
  store.saveAgentSession({ id: "session-project-a", projectId: "project-a", provider: "codex", directory: "/tmp/shared", title: "Inspect login flow", status: "COMPLETED", createdAt: "2026-09-06T00:00:00.000Z" });
  store.saveAgentSession({ id: "session-project-b", projectId: "project-b", provider: "claude", directory: "/tmp/shared", title: "Review retry flow", status: "COMPLETED", createdAt: "2026-09-06T00:01:00.000Z" });
  store.saveAgentSession({ id: "session-legacy", provider: "opencode", directory: "/tmp/legacy", status: "COMPLETED", createdAt: "2026-09-06T00:02:00.000Z" });

  assert.deepEqual(store.listAgentSessionsForProject("project-a", "/tmp/shared").map((session) => session.id), ["session-project-a"]);
  assert.deepEqual(store.listAgentSessionsForProject("project-b", "/tmp/shared").map((session) => session.id), ["session-project-b"]);
  assert.equal(store.getAgentSession("session-project-a")?.title, "Inspect login flow");
  assert.deepEqual(store.listAgentSessionsForProject("project-legacy", "/tmp/legacy").map((session) => session.id), ["session-legacy"]);
  store.close();
});

test("SQLite deletes an agent session and cascades its messages", () => {
  const store = new AdeStore();
  store.saveAgentSession({ id: "session-delete", provider: "codex", directory: "/tmp/project", status: "COMPLETED", createdAt: "2026-09-03T00:00:00.000Z" });
  store.saveAgentMessage({ id: "message-delete", sessionId: "session-delete", role: "user", content: "Remove me", createdAt: "2026-09-03T00:01:00.000Z" });

  store.deleteAgentSession("session-delete");

  assert.deepEqual(store.listAgentSessions().map((session) => session.id), []);
  assert.deepEqual(store.listAgentMessages("session-delete"), []);
  store.close();
});

test("SQLite migrates terminal history and keeps the conversation it can resume", () => {
  const path = join(tmpdir(), `ade-terminal-legacy-${Date.now()}.db`);
  const legacy = new DatabaseSync(path);
  legacy.exec("CREATE TABLE terminal_history_sessions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, provider TEXT NOT NULL, title TEXT NOT NULL, transcript TEXT NOT NULL, truncated INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL, ended_at TEXT NOT NULL)");
  legacy.exec("INSERT INTO terminal_history_sessions VALUES ('terminal-legacy', 'project-a', 'claude', 'Older session', 'transcript', 0, '2026-09-07T10:00:00.000Z', '2026-09-07T10:30:00.000Z')");
  legacy.close();

  const store = new AdeStore(path);
  const columns = store.db.prepare("PRAGMA table_info(terminal_history_sessions)").all() as Array<{ name: string }>;
  assert.ok(columns.some((column) => column.name === "provider_session_id"));
  // A row written before the column existed stays readable and simply has no
  // conversation to resume.
  assert.equal(store.getTerminalHistorySession("terminal-legacy")?.providerSessionId, undefined);

  store.saveTerminalHistorySession({ id: "terminal-new", projectId: "project-a", provider: "claude", title: "Resumable session", transcript: "transcript", truncated: false, startedAt: "2026-09-08T10:00:00.000Z", endedAt: "2026-09-08T10:30:00.000Z", providerSessionId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(store.getTerminalHistorySession("terminal-new")?.providerSessionId, "11111111-1111-4111-8111-111111111111");
  assert.equal(store.listTerminalHistorySessions("project-a")[0]?.providerSessionId, "11111111-1111-4111-8111-111111111111");

  // Re-saving on close must not drop an id an earlier lookup already resolved.
  store.saveTerminalHistorySession({ id: "terminal-new", projectId: "project-a", provider: "claude", title: "Resumable session", transcript: "transcript and more", truncated: false, startedAt: "2026-09-08T10:00:00.000Z", endedAt: "2026-09-08T10:45:00.000Z" });
  assert.equal(store.getTerminalHistorySession("terminal-new")?.providerSessionId, "11111111-1111-4111-8111-111111111111");
  store.close();
});
