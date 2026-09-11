import test from "node:test";
import assert from "node:assert/strict";
import { WorkflowState } from "../src/domain/workflow/phase.js";

test("the first attempt at a phase runs at its default tier", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });
  assert.equal(state.attemptsFor("FRAME"), 1);
  assert.deepEqual(state.dispatchFor("FRAME"), { attempt: 1, escalate: false, halt: false });
});

test("the second attempt escalates one tier, once", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });
  state.advance("BUILD", "go");
  state.advance("VERIFY", "changeset");
  state.reenter("BUILD", "tests red");

  assert.equal(state.attemptsFor("BUILD"), 2);
  assert.deepEqual(state.dispatchFor("BUILD"), { attempt: 2, escalate: true, halt: false });
});

test("the third attempt halts instead of dispatching again", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });
  state.advance("BUILD", "go");
  state.advance("VERIFY", "changeset");
  state.reenter("BUILD", "tests red");
  state.advance("VERIFY", "retry");
  state.reenter("BUILD", "still red");

  assert.equal(state.attemptsFor("BUILD"), 3);
  assert.deepEqual(state.dispatchFor("BUILD"), { attempt: 3, escalate: false, halt: true });
  assert.equal(state.haltReason()?.includes("BUILD"), true);
});

test("a phase never entered has no attempts and would dispatch fresh", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });
  assert.equal(state.attemptsFor("REVIEW"), 0);
  assert.deepEqual(state.dispatchFor("REVIEW"), { attempt: 1, escalate: false, halt: false });
});

test("a new cycle resets the counters — escalation is per cycle, never cumulative forever", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });
  state.advance("BUILD", "go");
  state.advance("VERIFY", "changeset");
  state.reenter("BUILD", "tests red");
  assert.equal(state.attemptsFor("BUILD"), 2);

  state.newCycle("second increment of the roadmap");

  assert.equal(state.currentCycle, 2);
  /** The phase the new cycle starts in is entered afresh, so it reads as this
      cycle's first attempt rather than the previous cycle's third. */
  assert.equal(state.attemptsFor("BUILD"), 1);
  assert.deepEqual(state.dispatchFor("BUILD"), { attempt: 1, escalate: false, halt: false });
  assert.equal(state.attemptsFor("VERIFY"), 0, "a phase not entered in this cycle carries nothing over");
  assert.equal(state.haltReason(), undefined);
});

test("escalating the mode keeps phase, cycle and counters — it changes the route, not the progress", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "quick", reason: "small fix" });
  state.advance("BUILD", "go");

  state.escalateMode("design-heavy", "this turned out to change a public contract");

  assert.equal(state.currentMode, "design-heavy");
  assert.equal(state.currentPhase, "BUILD");
  assert.equal(state.attemptsFor("BUILD"), 1);
  assert.equal(state.history().at(-1)?.reason.includes("public contract"), true);
});

test("state survives a round trip so closing the app does not restart the escalation", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });
  state.advance("BUILD", "go");
  state.advance("VERIFY", "changeset");
  state.reenter("BUILD", "tests red");

  const restored = WorkflowState.rehydrate(state.snapshot());

  assert.equal(restored.currentPhase, "BUILD");
  assert.equal(restored.attemptsFor("BUILD"), 2);
  assert.equal(restored.currentCycle, 1);
  assert.deepEqual(restored.dispatchFor("BUILD"), { attempt: 2, escalate: true, halt: false });
  assert.equal(restored.history().length, state.history().length);
});
