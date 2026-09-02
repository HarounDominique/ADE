import test from "node:test";
import assert from "node:assert/strict";
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
