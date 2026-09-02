import test from "node:test";
import assert from "node:assert/strict";
import { approveTask } from "../src/application/tasks/approval-commands.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { GateSet } from "../src/domain/gate.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";

test("human approval completes a ready Task when required gates pass", () => {
  const store = new AdeStore();
  const task = createTask(store, { id: "task-approval", intent: "Inspect" });
  task.transition("READY", "Framed", "human");
  task.transition("IN_PROGRESS", "Started", "ade");
  task.transition("IMPLEMENTED", "Built", "ade");
  task.transition("UNDER_REVIEW", "Review started", "ade");
  task.transition("READY_FOR_HUMAN", "Review passed", "ade");
  store.saveTask(task);

  approveTask(store, {
    id: task.id,
    reason: "Acceptance confirmed",
    gates: new GateSet([{ id: "review", required: true, status: "passed", evidenceIds: ["review-1"] }]),
  });

  assert.equal(store.rehydrateTask(task.id)?.currentStatus, "COMPLETED");
  store.close();
});

test("approval does not mutate a Task when a required gate fails", () => {
  const store = new AdeStore();
  const task = createTask(store, { id: "task-blocked-approval", intent: "Inspect" });
  task.transition("READY", "Framed", "human");
  task.transition("IN_PROGRESS", "Started", "ade");
  task.transition("IMPLEMENTED", "Built", "ade");
  task.transition("UNDER_REVIEW", "Review started", "ade");
  task.transition("READY_FOR_HUMAN", "Review passed", "ade");
  store.saveTask(task);

  assert.throws(() => approveTask(store, {
    id: task.id,
    reason: "Acceptance attempted",
    gates: new GateSet([{ id: "tests", required: true, status: "failed", evidenceIds: [] }]),
  }), /tests/);
  assert.equal(store.rehydrateTask(task.id)?.currentStatus, "READY_FOR_HUMAN");
  store.close();
});
