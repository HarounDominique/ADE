import test from "node:test";
import assert from "node:assert/strict";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { writeSettings } from "../src/application/settings/settings.js";
import { handleDesktopRequest } from "../src/desktop-sidecar.js";

function storeWithTask(): AdeStore {
  const store = new AdeStore();
  createTask(store, { id: "task-1", intent: "Ship the thing", acceptanceCriteria: ["it works"] });
  return store;
}

test("a Task with no workflow reports that, with the flow enabled", () => {
  const response = handleDesktopRequest(storeWithTask(), { id: "1", method: "workflow.state", params: { taskId: "task-1" } });

  assert.deepEqual(response.result, { taskId: "task-1", enabled: true, state: null });
});

test("starting a workflow returns the phase the shell should render", () => {
  const store = storeWithTask();

  const response = handleDesktopRequest(store, {
    id: "1",
    method: "workflow.start",
    params: { taskId: "task-1", workflowMode: "standard", reason: "new feature" },
  });

  const result = response.result as { phase: string; mode: string; cycle: number; dispatch: { attempt: number } };
  assert.equal(result.phase, "FRAME");
  assert.equal(result.mode, "standard");
  assert.equal(result.cycle, 1);
  assert.equal(result.dispatch.attempt, 1);
});

test("the state command reports phase, mode, attempts and history after a start", () => {
  const store = storeWithTask();
  handleDesktopRequest(store, { id: "1", method: "workflow.start", params: { taskId: "task-1", workflowMode: "quick", reason: "small fix" } });

  const result = handleDesktopRequest(store, { id: "2", method: "workflow.state", params: { taskId: "task-1" } }).result as {
    enabled: boolean;
    state: { phase: string; mode: string; nextProposed: string | null; history: unknown[] };
  };

  assert.equal(result.enabled, true);
  assert.equal(result.state.phase, "FRAME");
  assert.equal(result.state.mode, "quick");
  assert.equal(result.state.nextProposed, "BUILD");
  assert.equal(result.state.history.length, 1);
});

test("advancing moves the phase and reports the new dispatch", () => {
  const store = storeWithTask();
  handleDesktopRequest(store, { id: "1", method: "workflow.start", params: { taskId: "task-1", workflowMode: "quick", reason: "fix" } });

  const response = handleDesktopRequest(store, {
    id: "2",
    method: "workflow.advance",
    params: { taskId: "task-1", result: { phase: "FRAME", next: "BUILD", reason: "intent recorded" } },
  });

  assert.equal((response.result as { phase: string }).phase, "BUILD");
});

test("a refused result comes back as an error the shell can show, not a crash", () => {
  const store = storeWithTask();
  handleDesktopRequest(store, { id: "1", method: "workflow.start", params: { taskId: "task-1", workflowMode: "quick", reason: "fix" } });

  const response = handleDesktopRequest(store, {
    id: "2",
    method: "workflow.advance",
    params: { taskId: "task-1", result: { phase: "VERIFY", next: "BUILD", reason: "stale" } },
  });

  assert.equal(response.error?.code, "WORKFLOW_REFUSED");
  assert.match(response.error?.message ?? "", /stale/i);
});

test("with the workflow off, state says so instead of failing", () => {
  const store = storeWithTask();
  writeSettings(store, { developmentWorkflow: false });

  assert.deepEqual(
    handleDesktopRequest(store, { id: "1", method: "workflow.state", params: { taskId: "task-1" } }).result,
    { taskId: "task-1", enabled: false, state: null },
  );
});

test("with the workflow off, start and advance refuse with a distinct code", () => {
  const store = storeWithTask();
  writeSettings(store, { developmentWorkflow: false });

  for (const request of [
    { id: "1", method: "workflow.start", params: { taskId: "task-1", workflowMode: "quick" as const, reason: "fix" } },
    { id: "2", method: "workflow.advance", params: { taskId: "task-1", result: { phase: "FRAME" as const, reason: "x" } } },
  ]) {
    assert.equal(handleDesktopRequest(store, request).error?.code, "WORKFLOW_DISABLED");
  }
});

test("the workflow commands validate their parameters", () => {
  const store = storeWithTask();

  assert.equal(handleDesktopRequest(store, { id: "1", method: "workflow.state" }).error?.code, "INVALID_PARAMS");
  assert.equal(handleDesktopRequest(store, { id: "2", method: "workflow.start", params: { taskId: "task-1" } }).error?.code, "INVALID_PARAMS");
  assert.equal(
    handleDesktopRequest(store, { id: "3", method: "workflow.start", params: { taskId: "task-1", workflowMode: "sideways" as never, reason: "r" } }).error?.code,
    "INVALID_PARAMS",
  );
  assert.equal(handleDesktopRequest(store, { id: "4", method: "workflow.advance", params: { taskId: "task-1" } }).error?.code, "INVALID_PARAMS");
});

test("an unknown workflow method is still unknown", () => {
  assert.equal(handleDesktopRequest(storeWithTask(), { id: "1", method: "workflow.teleport" }).error?.code, "METHOD_NOT_FOUND");
});
