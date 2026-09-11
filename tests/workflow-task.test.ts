import test from "node:test";
import assert from "node:assert/strict";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { WorkflowDisabledError, advanceTaskWorkflow, getTaskWorkflow, startTaskWorkflow } from "../src/application/workflow/task-workflow.js";
import { WorkflowRefusedError } from "../src/application/workflow/advance.js";
import { defaultSettings } from "../src/application/settings/settings.js";

const on = { user: defaultSettings, policy: { developmentWorkflow: true } };
const off = { user: { ...defaultSettings, developmentWorkflow: false }, policy: {} };

function storeWithTask(): AdeStore {
  const store = new AdeStore();
  createTask(store, { id: "task-1", intent: "Ship the thing", acceptanceCriteria: ["it works"] });
  return store;
}

test("starting a workflow persists it and puts the Task in the mode's entry phase", () => {
  const store = storeWithTask();

  const state = startTaskWorkflow(store, { taskId: "task-1", mode: "standard", reason: "new feature", activation: on });

  assert.equal(state.currentPhase, "FRAME");
  assert.equal(getTaskWorkflow(store, "task-1")?.currentPhase, "FRAME");
  assert.equal(getTaskWorkflow(store, "task-1")?.currentMode, "standard");
});

test("a Task that never started a workflow has none, which is a readable answer", () => {
  assert.equal(getTaskWorkflow(storeWithTask(), "task-1"), undefined);
});

test("advancing persists the new phase so the next read sees it", () => {
  const store = storeWithTask();
  startTaskWorkflow(store, { taskId: "task-1", mode: "quick", reason: "small fix", activation: on });

  advanceTaskWorkflow(store, { taskId: "task-1", result: { phase: "FRAME", next: "BUILD", reason: "intent recorded" }, activation: on });

  assert.equal(getTaskWorkflow(store, "task-1")?.currentPhase, "BUILD");
});

test("the escalation counter survives being read back from the store", () => {
  const store = storeWithTask();
  startTaskWorkflow(store, { taskId: "task-1", mode: "standard", reason: "start", activation: on });
  advanceTaskWorkflow(store, { taskId: "task-1", result: { phase: "FRAME", next: "BUILD", reason: "go" }, activation: on });
  advanceTaskWorkflow(store, { taskId: "task-1", result: { phase: "BUILD", next: "VERIFY", reason: "captured" }, activation: on });
  advanceTaskWorkflow(store, { taskId: "task-1", result: { phase: "VERIFY", next: "BUILD", reason: "red" }, activation: on });

  assert.deepEqual(getTaskWorkflow(store, "task-1")?.dispatchFor("BUILD"), { attempt: 2, escalate: true, halt: false });
});

test("with the workflow off, starting it refuses instead of half-working", () => {
  const store = storeWithTask();

  assert.throws(() => startTaskWorkflow(store, { taskId: "task-1", mode: "standard", reason: "s", activation: off }), WorkflowDisabledError);
  assert.equal(getTaskWorkflow(store, "task-1"), undefined);
});

test("with the workflow off, advancing refuses and leaves the stored state untouched", () => {
  const store = storeWithTask();
  startTaskWorkflow(store, { taskId: "task-1", mode: "quick", reason: "s", activation: on });

  assert.throws(
    () => advanceTaskWorkflow(store, { taskId: "task-1", result: { phase: "FRAME", next: "BUILD", reason: "go" }, activation: off }),
    WorkflowDisabledError,
  );
  assert.equal(getTaskWorkflow(store, "task-1")?.currentPhase, "FRAME");
});

test("advancing a Task with no workflow says so rather than starting one silently", () => {
  const store = storeWithTask();

  assert.throws(
    () => advanceTaskWorkflow(store, { taskId: "task-1", result: { phase: "FRAME", next: "BUILD", reason: "go" }, activation: on }),
    /no workflow/i,
  );
});

test("SHIP is refused against the Task's real gates, not a caller's claim", () => {
  const store = storeWithTask();
  startTaskWorkflow(store, { taskId: "task-1", mode: "standard", reason: "start", activation: on });
  for (const [phase, next] of [["FRAME", "BUILD"], ["BUILD", "VERIFY"], ["VERIFY", "RECONCILE"]] as const) {
    advanceTaskWorkflow(store, { taskId: "task-1", result: { phase, next, reason: `to ${next}` }, activation: on });
  }

  assert.throws(
    () => advanceTaskWorkflow(store, { taskId: "task-1", result: { phase: "RECONCILE", next: "SHIP", reason: "done" }, activation: on }),
    WorkflowRefusedError,
  );
  assert.equal(getTaskWorkflow(store, "task-1")?.currentPhase, "RECONCILE", "a refused SHIP does not move the Task");
});

test("a refused result never reaches the store", () => {
  const store = storeWithTask();
  startTaskWorkflow(store, { taskId: "task-1", mode: "quick", reason: "s", activation: on });

  assert.throws(
    () => advanceTaskWorkflow(store, { taskId: "task-1", result: { phase: "VERIFY", next: "BUILD", reason: "stale" }, activation: on }),
    WorkflowRefusedError,
  );
  assert.equal(getTaskWorkflow(store, "task-1")?.currentPhase, "FRAME");
  assert.equal(getTaskWorkflow(store, "task-1")?.history().length, 1);
});
