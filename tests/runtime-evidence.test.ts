import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeEvidence } from "../src/domain/runtime-evidence.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { Task } from "../src/domain/task.js";
import { getRuntimeHistory, getTaskDetail } from "../src/application/task-detail.js";
import { getChangeReview } from "../src/application/change-review-read-model.js";

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
  assert.equal(getRuntimeHistory(store, "task-1").length, 1);
  assert.equal(getTaskDetail(store, "task-1").task.status, "DRAFT");
  assert.equal(getChangeReview(store, "task-1").gates[0]?.status, "pending");
  store.close();
});
