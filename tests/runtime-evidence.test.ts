import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeEvidence } from "../src/domain/runtime-evidence.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { Task } from "../src/domain/task.js";

test("runtime evidence is bounded and persists by Task", () => {
  const store = new AdeStore();
  store.saveTask(Task.create({ id: "task-1", intent: "Capture runtime evidence" }));
  const evidence = createRuntimeEvidence({
    id: "evidence-1",
    taskId: "task-1",
    type: "session.message",
    summary: "event",
    details: "x".repeat(3_000),
  });

  store.saveRuntimeEvidence(evidence);
  const saved = store.listRuntimeEvidence("task-1");

  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.details?.length, 2_000);
  assert.equal(store.listRuntimeEvidence("other-task").length, 0);
  store.close();
});
