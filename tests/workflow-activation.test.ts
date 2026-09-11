import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDevelopmentWorkflowEnabled } from "../src/application/workflow/activation.js";
import { loadGatePolicy } from "../src/application/change-review/gate-policy.js";
import { defaultSettings } from "../src/application/settings/settings.js";

function projectWithPolicy(policy: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "ade-workflow-"));
  mkdirSync(join(root, ".ade"), { recursive: true });
  writeFileSync(join(root, ".ade", "policy.json"), JSON.stringify(policy), "utf8");
  return root;
}

test("the workflow is on when nobody says otherwise", () => {
  assert.equal(defaultSettings.developmentWorkflow, true);
  assert.equal(isDevelopmentWorkflowEnabled({ user: defaultSettings, policy: loadGatePolicy() }), true);
});

test("the operator can turn it off for themselves", () => {
  const user = { ...defaultSettings, developmentWorkflow: false };
  assert.equal(isDevelopmentWorkflowEnabled({ user, policy: loadGatePolicy() }), false);
});

test("a Project that requires the workflow overrides an operator who turned it off", () => {
  const policy = loadGatePolicy(projectWithPolicy({ developmentWorkflow: true }));
  const user = { ...defaultSettings, developmentWorkflow: false };

  assert.equal(policy.developmentWorkflow, true);
  assert.equal(isDevelopmentWorkflowEnabled({ user, policy }), true);
});

test("a Project that disables the workflow overrides an operator who wants it", () => {
  const policy = loadGatePolicy(projectWithPolicy({ developmentWorkflow: false }));

  assert.equal(policy.developmentWorkflow, false);
  assert.equal(isDevelopmentWorkflowEnabled({ user: defaultSettings, policy }), false);
});

test("a policy that stays silent leaves the decision to the operator", () => {
  const policy = loadGatePolicy(projectWithPolicy({ requiredGates: ["build"] }));

  assert.equal(policy.developmentWorkflow, undefined);
  assert.equal(isDevelopmentWorkflowEnabled({ user: { ...defaultSettings, developmentWorkflow: false }, policy }), false);
  assert.equal(isDevelopmentWorkflowEnabled({ user: defaultSettings, policy }), true);
});

test("a non-boolean in the policy is silence, not a decision", () => {
  const policy = loadGatePolicy(projectWithPolicy({ developmentWorkflow: "yes" }));
  assert.equal(policy.developmentWorkflow, undefined);
  assert.equal(isDevelopmentWorkflowEnabled({ user: defaultSettings, policy }), true);
});

test("an unreadable policy never silently turns the workflow off", () => {
  const policy = loadGatePolicy("/definitely/not/a/project");
  assert.equal(policy.developmentWorkflow, undefined);
  assert.equal(isDevelopmentWorkflowEnabled({ user: defaultSettings, policy }), true);
});
