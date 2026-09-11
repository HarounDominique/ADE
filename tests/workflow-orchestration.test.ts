import test from "node:test";
import assert from "node:assert/strict";
import { GateSet } from "../src/domain/gate.js";
import { WorkflowState } from "../src/domain/workflow/phase.js";
import {
  applyWorkflowResult,
  assertDispatchable,
  proposeNextPhase,
  WorkflowRefusedError,
} from "../src/application/workflow/advance.js";

const allPassed = new GateSet([
  { id: "build", required: true, status: "passed", evidenceIds: ["b"] },
  { id: "tests", required: true, status: "passed", evidenceIds: ["t"] },
  { id: "human-approval", required: true, status: "passed", evidenceIds: ["a"] },
]);
const testsPending = new GateSet([
  { id: "tests", required: true, status: "pending", evidenceIds: [] },
]);

function at(phase: Parameters<WorkflowState["advance"]>[0], mode: "standard" | "quick" = "standard"): WorkflowState {
  const state = WorkflowState.start({ taskId: "t", mode, reason: "start" });
  const legs: Record<string, readonly string[]> = {
    FRAME: [],
    BUILD: ["BUILD"],
    VERIFY: ["BUILD", "VERIFY"],
    RECONCILE: ["BUILD", "VERIFY", "RECONCILE"],
  };
  for (const leg of legs[phase] ?? []) state.advance(leg as typeof phase, `to ${leg}`);
  return state;
}

test("the route proposes the next phase for the mode", () => {
  assert.equal(proposeNextPhase(WorkflowState.start({ taskId: "t", mode: "standard", reason: "s" })), "EXPLORE");
  assert.equal(proposeNextPhase(WorkflowState.start({ taskId: "t", mode: "quick", reason: "s" })), "BUILD");
});

test("a route that has run out proposes nothing rather than inventing a phase", () => {
  const state = at("VERIFY", "quick");
  assert.equal(proposeNextPhase(state), undefined);
});

test("a proposal the matrix would refuse is not made", () => {
  const state = at("RECONCILE");
  /** RECONCILE -> SHIP is legal, so standard's route still has an opinion here. */
  assert.equal(proposeNextPhase(state), "SHIP");
});

test("applying a result advances the phase and records its evidence and reason", () => {
  const state = at("BUILD");

  applyWorkflowResult(state, {
    phase: "BUILD",
    next: "VERIFY",
    reason: "changeset captured",
    evidenceIds: ["cs-1"],
  }, { gates: testsPending });

  assert.equal(state.currentPhase, "VERIFY");
  assert.deepEqual(state.history().at(-1)?.evidenceIds, ["cs-1"]);
  assert.equal(state.history().at(-1)?.reentry, false);
});

test("a result for a phase the work already left is refused as stale", () => {
  const state = at("VERIFY");

  assert.throws(
    () => applyWorkflowResult(state, { phase: "BUILD", next: "REVIEW", reason: "late" }, { gates: testsPending }),
    WorkflowRefusedError,
  );
  assert.equal(state.currentPhase, "VERIFY");
});

test("going back along the route is recorded as re-entry, not as progress", () => {
  const state = at("VERIFY");

  applyWorkflowResult(state, { phase: "VERIFY", next: "BUILD", reason: "tests are red" }, { gates: testsPending });

  assert.equal(state.currentPhase, "BUILD");
  assert.equal(state.history().at(-1)?.reentry, true);
  assert.equal(state.attemptsFor("BUILD"), 2);
});

test("a result with no next phase records the outcome and stays put", () => {
  const state = at("BUILD");

  applyWorkflowResult(state, { phase: "BUILD", reason: "still working", evidenceIds: ["ev"] }, { gates: testsPending });

  assert.equal(state.currentPhase, "BUILD");
  assert.equal(state.attemptsFor("BUILD"), 1, "staying is not a new attempt");
});

test("SHIP is refused while a required gate is unresolved", () => {
  const state = at("RECONCILE");

  assert.throws(
    () => applyWorkflowResult(state, { phase: "RECONCILE", next: "SHIP", reason: "done" }, { gates: testsPending }),
    /tests/,
  );
  assert.equal(state.currentPhase, "RECONCILE");
});

test("SHIP is allowed once every required gate is passed", () => {
  const state = at("RECONCILE");
  applyWorkflowResult(state, { phase: "RECONCILE", next: "SHIP", reason: "approved" }, { gates: allPassed });
  assert.equal(state.currentPhase, "SHIP");
});

test("a skill cannot approve on the human's behalf", () => {
  const state = at("RECONCILE");

  assert.throws(
    () => applyWorkflowResult(state, {
      phase: "RECONCILE",
      reason: "looks fine to me",
      gateUpdates: [{ id: "human-approval", status: "passed" }],
    }, { gates: allPassed }),
    /human-approval/,
  );
});

test("a skill cannot waive the gate that is blocking it", () => {
  const state = at("VERIFY");

  assert.throws(
    () => applyWorkflowResult(state, {
      phase: "VERIFY",
      reason: "the test is flaky",
      gateUpdates: [{ id: "tests", status: "waived" }],
    }, { gates: testsPending }),
    /waive/i,
  );
});

test("a skill may report a gate passed or failed — that is evidence, not a bypass", () => {
  const state = at("VERIFY");

  const applied = applyWorkflowResult(state, {
    phase: "VERIFY",
    reason: "suite ran",
    gateUpdates: [{ id: "tests", status: "failed" }],
  }, { gates: testsPending });

  assert.deepEqual(applied.gateUpdates, [{ id: "tests", status: "failed" }]);
});

test("a halted phase refuses to be dispatched again", () => {
  const state = at("VERIFY");
  applyWorkflowResult(state, { phase: "VERIFY", next: "BUILD", reason: "red" }, { gates: testsPending });
  applyWorkflowResult(state, { phase: "BUILD", next: "VERIFY", reason: "retry" }, { gates: testsPending });
  applyWorkflowResult(state, { phase: "VERIFY", next: "BUILD", reason: "still red" }, { gates: testsPending });

  assert.equal(state.attemptsFor("BUILD"), 3);
  assert.throws(() => assertDispatchable(state, "BUILD"), WorkflowRefusedError);
  assert.throws(() => assertDispatchable(state, "BUILD"), /human/i);
});

test("a dispatchable phase reports which attempt it is and whether to escalate", () => {
  const state = at("BUILD");
  assert.deepEqual(assertDispatchable(state, "BUILD"), { attempt: 1, escalate: false, halt: false });

  applyWorkflowResult(state, { phase: "BUILD", next: "VERIFY", reason: "captured" }, { gates: testsPending });
  applyWorkflowResult(state, { phase: "VERIFY", next: "BUILD", reason: "red" }, { gates: testsPending });

  assert.deepEqual(assertDispatchable(state, "BUILD"), { attempt: 2, escalate: true, halt: false });
});

test("a skill may recommend escalating the mode without losing its place", () => {
  const state = at("BUILD", "quick");

  applyWorkflowResult(state, {
    phase: "BUILD",
    reason: "this turned out to change a public contract",
    escalateMode: "design-heavy",
  }, { gates: testsPending });

  assert.equal(state.currentMode, "design-heavy");
  assert.equal(state.currentPhase, "BUILD");
});

test("every result needs a reason", () => {
  const state = at("BUILD");
  assert.throws(() => applyWorkflowResult(state, { phase: "BUILD", next: "VERIFY", reason: "  " }, { gates: testsPending }), /reason/i);
});
