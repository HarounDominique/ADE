import test from "node:test";
import assert from "node:assert/strict";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { WorkflowState } from "../src/domain/workflow/phase.js";

function storeWithTask(id = "task-1"): AdeStore {
  const store = new AdeStore();
  createTask(store, { id, intent: "Do the thing", acceptanceCriteria: ["it works"] });
  return store;
}

test("a Task with no workflow state reads as absent rather than failing", () => {
  const store = storeWithTask();
  assert.equal(store.getWorkflowState("task-1"), undefined);
});

test("workflow state survives a round trip with phase, mode, cycle, attempts and history", () => {
  const store = storeWithTask();
  const state = WorkflowState.start({ taskId: "task-1", mode: "standard", reason: "new feature" });
  state.advance("BUILD", "known pattern");
  state.advance("VERIFY", "changeset captured");
  state.reenter("BUILD", "tests red", { evidenceIds: ["ev-1"] });

  store.saveWorkflowState(state.snapshot());
  const restored = WorkflowState.rehydrate(store.getWorkflowState("task-1")!);

  assert.equal(restored.currentPhase, "BUILD");
  assert.equal(restored.currentMode, "standard");
  assert.equal(restored.currentCycle, 1);
  assert.equal(restored.attemptsFor("BUILD"), 2);
  assert.deepEqual(restored.dispatchFor("BUILD"), { attempt: 2, escalate: true, halt: false });
  assert.equal(restored.history().length, 4);
  assert.deepEqual(restored.history().at(-1)?.evidenceIds, ["ev-1"]);
  assert.equal(restored.history().at(-1)?.reentry, true);
});

test("saving again replaces the Task's state instead of accumulating rows", () => {
  const store = storeWithTask();
  const state = WorkflowState.start({ taskId: "task-1", mode: "quick", reason: "small fix" });
  store.saveWorkflowState(state.snapshot());

  state.advance("BUILD", "go");
  store.saveWorkflowState(state.snapshot());

  const restored = WorkflowState.rehydrate(store.getWorkflowState("task-1")!);
  assert.equal(restored.currentPhase, "BUILD");
  assert.equal(restored.history().length, 2);
});

test("two Tasks keep separate workflow state", () => {
  const store = storeWithTask("task-1");
  createTask(store, { id: "task-2", intent: "Other", acceptanceCriteria: ["ok"] });

  store.saveWorkflowState(WorkflowState.start({ taskId: "task-1", mode: "quick", reason: "a" }).snapshot());
  const second = WorkflowState.start({ taskId: "task-2", mode: "design-heavy", reason: "b" });
  second.advance("EXPLORE", "unknown architecture");
  store.saveWorkflowState(second.snapshot());

  assert.equal(store.getWorkflowState("task-1")?.phase, "FRAME");
  assert.equal(store.getWorkflowState("task-1")?.mode, "quick");
  assert.equal(store.getWorkflowState("task-2")?.phase, "EXPLORE");
  assert.equal(store.getWorkflowState("task-2")?.mode, "design-heavy");
});

test("a stored escalation is not restarted by reopening the app", () => {
  const store = storeWithTask();
  const state = WorkflowState.start({ taskId: "task-1", mode: "standard", reason: "start" });
  state.advance("BUILD", "go");
  state.advance("VERIFY", "changeset");
  state.reenter("BUILD", "red");
  state.advance("VERIFY", "retry");
  state.reenter("BUILD", "still red");
  store.saveWorkflowState(state.snapshot());

  const restored = WorkflowState.rehydrate(store.getWorkflowState("task-1")!);

  assert.deepEqual(restored.dispatchFor("BUILD"), { attempt: 3, escalate: false, halt: true });
  assert.equal(restored.haltReason()?.includes("BUILD"), true);
});
