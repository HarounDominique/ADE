import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { Task } from "../src/domain/task.js";
import { createChangeSet } from "../src/domain/change-set.js";

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
