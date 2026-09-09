import test from "node:test";
import assert from "node:assert/strict";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { createTask } from "../src/application/tasks/task-commands.js";
import { getChangeReview } from "../src/application/change-review-read-model.js";
import { createChangeSet } from "../src/domain/change-set.js";
import { recordVerificationRun, appendVerificationOutput, type VerificationRun } from "../src/application/local-runtime/verification-evidence.js";
import type { RunSession } from "../src/domain/run-configuration.js";

function taskWithRepository(store: AdeStore, id: string) {
  const task = createTask(store, { id, intent: "Change something", repositoryPath: "/tmp/ade-verification" });
  task.transition("READY", "Acceptance criteria recorded", "human");
  store.saveTask(task);
  return task;
}

function run(overrides: Partial<VerificationRun> = {}): VerificationRun {
  return { taskId: "task-gates", repositoryPath: "/tmp/ade-verification", verifies: "tests", label: "npm · test", output: "", ...overrides };
}

function session(overrides: Partial<RunSession> = {}): RunSession {
  return { id: "run-session-1", configurationId: "test", mode: "run", state: "STOPPED", exitCode: 0, ports: [], startedAt: "2026-09-09T10:00:00.000Z", ...overrides };
}

test("a gate passes on a real exit code, not on the existence of a ChangeSet", () => {
  const store = new AdeStore();
  taskWithRepository(store, "task-gates");
  store.saveChangeSet(createChangeSet({ id: "changeset-1", taskId: "task-gates", sessionId: "agent-session", directory: "/tmp/ade-verification", runtimeDiff: [], git: { status: " M src/main.ts", patch: "", untracked: [] } }));

  // A ChangeSet used to satisfy `build` by existing, and `tests` waited on
  // evidence nothing wrote.
  const before = getChangeReview(store, "task-gates");
  assert.equal(before.gates.find((gate) => gate.id === "build")?.status, "pending");
  assert.equal(before.gates.find((gate) => gate.id === "tests")?.status, "pending");

  recordVerificationRun(store, run({ verifies: "build", label: "npm · build" }), session({ id: "run-build" }));
  recordVerificationRun(store, run(), session({ id: "run-tests" }));

  const after = getChangeReview(store, "task-gates");
  assert.equal(after.gates.find((gate) => gate.id === "build")?.status, "passed");
  assert.equal(after.gates.find((gate) => gate.id === "tests")?.status, "passed");
  store.close();
});

test("a failing run fails its gate and the next passing run clears it", () => {
  const store = new AdeStore();
  taskWithRepository(store, "task-gates");

  recordVerificationRun(store, run({ output: "1 test failed\n" }), session({ id: "run-1", state: "FAILED", exitCode: 1 }));
  const failed = getChangeReview(store, "task-gates").gates.find((gate) => gate.id === "tests");
  assert.equal(failed?.status, "failed");
  const evidence = store.listRuntimeEvidence("task-gates", 10);
  assert.equal(evidence[0]?.type, "verification.tests.fail");
  assert.match(evidence[0]?.summary ?? "", /npm · test exited 1/);
  assert.match(evidence[0]?.details ?? "", /1 test failed/);

  // The newest run decides, so a fix that passes is not outvoted by history.
  recordVerificationRun(store, run(), session({ id: "run-2", state: "STOPPED", exitCode: 0 }));
  assert.equal(getChangeReview(store, "task-gates").gates.find((gate) => gate.id === "tests")?.status, "passed");
  store.close();
});

test("a run the operator stopped proves nothing", () => {
  const store = new AdeStore();
  taskWithRepository(store, "task-gates");

  recordVerificationRun(store, run(), session({ state: "STOPPED", exitCode: null, stoppedByUser: true }));

  assert.deepEqual(store.listRuntimeEvidence("task-gates", 10), []);
  assert.equal(getChangeReview(store, "task-gates").gates.find((gate) => gate.id === "tests")?.status, "pending");
  store.close();
});

test("the output kept for a gate is its tail, where a failure explains itself", () => {
  const tracked = run();
  appendVerificationOutput(tracked, "a".repeat(3_500));
  appendVerificationOutput(tracked, "\nFAIL src/thing.test.ts\n");
  assert.ok(tracked.output.length <= 4_000);
  assert.match(tracked.output, /FAIL src\/thing\.test\.ts/);
});
