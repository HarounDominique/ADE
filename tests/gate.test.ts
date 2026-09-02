import test from "node:test";
import assert from "node:assert/strict";
import { GateSet } from "../src/domain/gate.js";

test("GateSet blocks shipping when a required gate is unresolved", () => {
  const gates = new GateSet([
    { id: "tests", required: true, status: "passed", evidenceIds: ["run-1"] },
    { id: "review", required: true, status: "failed", evidenceIds: ["review-1"], failureReason: "Finding remains" },
    { id: "telemetry", required: false, status: "pending", evidenceIds: [] },
  ]);

  assert.equal(gates.canShip(), false);
  assert.deepEqual(gates.requiredFailures().map((gate) => gate.id), ["review"]);
  assert.throws(() => gates.assertCanShip(), /review/);
});

test("waived required gates can ship only when policy records the waiver", () => {
  const gates = new GateSet([{ id: "review", required: true, status: "waived", evidenceIds: ["approval-1"] }]);
  assert.equal(gates.canShip(), true);
});
