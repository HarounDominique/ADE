import test from "node:test";
import assert from "node:assert/strict";
import { WorkflowState, routeFor, type WorkflowPhase } from "../src/domain/workflow/phase.js";

test("a standard run starts at FRAME and records why it started", () => {
  const state = WorkflowState.start({ taskId: "task-1", mode: "standard", actor: "human", reason: "New feature" });

  assert.equal(state.currentPhase, "FRAME");
  assert.equal(state.currentMode, "standard");
  assert.equal(state.currentCycle, 1);
  assert.deepEqual(state.history().map((entry) => [entry.from, entry.to]), [[undefined, "FRAME"]]);
  assert.equal(state.history()[0]?.reason, "New feature");
});

test("quick mode starts at FRAME too — the mode picks the route, not the entry", () => {
  assert.equal(WorkflowState.start({ taskId: "t", mode: "quick", reason: "typo" }).currentPhase, "FRAME");
  assert.deepEqual(routeFor("quick"), ["FRAME", "BUILD", "VERIFY"]);
  assert.deepEqual(routeFor("standard"), ["FRAME", "EXPLORE", "BUILD", "VERIFY", "REVIEW", "RECONCILE", "SHIP"]);
  assert.deepEqual(routeFor("design-heavy"), ["FRAME", "EXPLORE", "DESIGN", "REVIEW", "BUILD", "VERIFY", "RECONCILE", "SHIP"]);
  assert.deepEqual(routeFor("recovery"), ["EXPLORE", "BUILD", "VERIFY"]);
});

test("recovery mode enters at EXPLORE because it exists to re-read the evidence", () => {
  assert.equal(WorkflowState.start({ taskId: "t", mode: "recovery", reason: "regression" }).currentPhase, "EXPLORE");
});

test("the transition matrix from the spec is enforced in both directions", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });

  state.advance("BUILD", "skipping exploration, the pattern is known");
  assert.equal(state.currentPhase, "BUILD");

  assert.throws(() => state.advance("SHIP", "ship it"), /BUILD -> SHIP/);
  assert.equal(state.currentPhase, "BUILD", "a refused transition must not mutate the phase");
});

test("SHIP is terminal", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });
  for (const [to, why] of [["BUILD", "b"], ["VERIFY", "v"], ["RECONCILE", "r"], ["SHIP", "s"]] as const) {
    state.advance(to as WorkflowPhase, why);
  }
  assert.equal(state.currentPhase, "SHIP");
  assert.throws(() => state.advance("BUILD", "one more thing"), /SHIP -> BUILD/);
});

test("every transition carries actor, reason and evidence, and a reason is required", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });

  state.advance("EXPLORE", "unknown architecture", { actor: "agent", evidenceIds: ["ev-1"] });
  const last = state.history().at(-1);
  assert.equal(last?.actor, "agent");
  assert.deepEqual(last?.evidenceIds, ["ev-1"]);
  assert.equal(last?.reentry, false);

  assert.throws(() => state.advance("BUILD", "   "), /reason/i);
});

test("reentry is explicit, keeps the history and is marked as such", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });
  state.advance("BUILD", "known pattern");
  state.advance("VERIFY", "changeset captured");

  state.reenter("BUILD", "tests are red");

  assert.equal(state.currentPhase, "BUILD");
  assert.equal(state.history().at(-1)?.reentry, true);
  assert.equal(state.history().length, 4, "reentry appends, it never rewrites");
});

test("reentry still obeys the matrix — it is a direction, not a bypass", () => {
  const state = WorkflowState.start({ taskId: "t", mode: "standard", reason: "start" });
  state.advance("BUILD", "go");
  assert.throws(() => state.reenter("SHIP", "just ship"), /BUILD -> SHIP/);
});
