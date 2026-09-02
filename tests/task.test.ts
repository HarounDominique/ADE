import test from "node:test";
import assert from "node:assert/strict";
import { Task } from "../src/domain/task.js";

test("Task records reasoned transitions", () => {
  const task = Task.create({ id: "task-1", intent: "Inspect the repository" });
  task.transition("READY", "Intent and acceptance criteria are present", "human");
  task.transition("IN_PROGRESS", "Execution started", "ade");

  assert.equal(task.currentStatus, "IN_PROGRESS");
  assert.deepEqual(task.history().map((event) => event.status), ["DRAFT", "READY", "IN_PROGRESS"]);
  assert.equal(task.history()[2]?.reason, "Execution started");
});

test("Task rejects invalid transitions and empty reasons", () => {
  const task = Task.create({ id: "task-2", intent: "Inspect the repository" });
  assert.throws(() => task.transition("COMPLETED", "skip"), /Invalid Task transition/);
  assert.throws(() => task.transition("READY", ""), /requires a reason/);
});
