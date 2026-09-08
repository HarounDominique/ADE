import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AskUnavailableError, askExecutable } from "../src/adapters/ask-command.js";
import { askGateEvidenceType, askGateSummary, evaluateAskGate, structuralGateId } from "../src/application/gates/ask-gate.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { Task } from "../src/domain/task.js";
import { createRuntimeEvidence } from "../src/domain/runtime-evidence.js";
import { getChangeReview } from "../src/application/change-review-read-model.js";

/** ASK is installed per interpreter, so a Project fixture declares the skill
    the way `skills.install` writes it. */
function projectWithSkill(name: string, manifest?: Record<string, unknown>): string {
  const repository = mkdtempSync(join(tmpdir(), `ade-ask-gate-${name}-`));
  mkdirSync(join(repository, ".ade", "skills"), { recursive: true });
  writeFileSync(join(repository, ".ade", "skills", "ask-gate.json"), JSON.stringify(manifest ?? {
    id: "ask-gate",
    version: "1.0.0",
    label: "ASK structural gate",
    description: "Run ASK Engine's change safety gate.",
    inputs: ["repository", "since"],
    outputs: ["verdict", "evidence"],
    permissions: ["read_project", "run_commands"],
    source: "project",
  }));
  return repository;
}

function pack(verdict: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema_version: "ask-pack-gate-v1",
    pack: "gate",
    verdict,
    exit_code: verdict === "PASS" ? 0 : verdict === "BLOCK" ? 1 : 2,
    since: null,
    pr: null,
    blocking_components: [],
    unverified_components: [],
    manifest: { build: { tool: "ask", tool_version: "5.9.30", build_commit: "793177c" } },
    ...extra,
  });
}

test("a passing ASK pack is a passed structural gate", async () => {
  const repository = projectWithSkill("pass");
  const result = await evaluateAskGate(
    { repositoryPath: repository, since: "origin/main", grantedPermissions: ["run_commands"] },
    { run: async () => ({ stdout: pack("PASS", { since: "origin/main" }), stderr: "", exitCode: 0 }) },
  );

  assert.equal(result.verdict, "PASS");
  assert.equal(result.gate.id, structuralGateId);
  assert.equal(result.gate.status, "passed");
  assert.equal(result.tool.version, "5.9.30");
  assert.equal(result.since, "origin/main");
});

test("a blocked change fails the gate and names the component that blocked it", async () => {
  const repository = projectWithSkill("block");
  const result = await evaluateAskGate(
    { repositoryPath: repository, grantedPermissions: ["run_commands"] },
    { run: async () => ({ stdout: pack("BLOCK", { blocking_components: ["verify-edit"] }), stderr: "", exitCode: 1 }) },
  );

  assert.equal(result.gate.status, "failed");
  assert.match(result.gate.failureReason ?? "", /verify-edit/);
  assert.equal(result.exitCode, 1);
});

/** UNVERIFIED is the verdict this integration exists to keep honest: ASK proved
    nothing either way, which is a pending gate and never a pass. */
test("an unverified pack leaves the gate pending rather than passed", async () => {
  const repository = projectWithSkill("unverified");
  const result = await evaluateAskGate(
    { repositoryPath: repository, grantedPermissions: ["run_commands"] },
    { run: async () => ({ stdout: pack("UNVERIFIED", { unverified_components: ["verify"] }), stderr: "", exitCode: 2 }) },
  );

  assert.equal(result.gate.status, "pending");
  assert.match(result.gate.failureReason ?? "", /could not decide: verify/);
});

test("the gate is not run without the Project skill and its explicit grant", async () => {
  const bare = mkdtempSync(join(tmpdir(), "ade-ask-gate-bare-"));
  await assert.rejects(
    evaluateAskGate({ repositoryPath: bare, grantedPermissions: ["run_commands"] }, { run: async () => { throw new Error("must not run"); } }),
    /ask-gate is not installed/,
  );

  const repository = projectWithSkill("ungranted");
  await assert.rejects(
    evaluateAskGate({ repositoryPath: repository }, { run: async () => { throw new Error("must not run"); } }),
    /requires explicit permission: run_commands/,
  );
});

test("a repository scope, a base ref, a PR and a profile reach the command", async () => {
  const repository = projectWithSkill("command");
  let seen: readonly string[] = [];
  await evaluateAskGate(
    { repositoryPath: repository, since: "origin/main", pr: 123, profile: "prod", grantedPermissions: ["run_commands"] },
    { run: async (args) => { seen = args; return { stdout: pack("PASS"), stderr: "", exitCode: 0 }; } },
  );

  assert.deepEqual([...seen], ["pack", "gate", repository, "--format", "json", "--compact", "--since", "origin/main", "--pr", "123", "--profile", "prod"]);
});

test("an answer ASK could not print is reported, never read as a pass", async () => {
  const repository = projectWithSkill("malformed");
  await assert.rejects(
    evaluateAskGate({ repositoryPath: repository, grantedPermissions: ["run_commands"] }, { run: async () => ({ stdout: "", stderr: "output ceiling exceeded", exitCode: 1 }) }),
    /output ceiling exceeded/,
  );

  await assert.rejects(
    evaluateAskGate({ repositoryPath: repository, grantedPermissions: ["run_commands"] }, { run: async () => ({ stdout: JSON.stringify({ schema_version: "ask-pack-assessment-v1" }), stderr: "", exitCode: 0 }) }),
    /where a gate pack was expected/,
  );

  // ASK states why it refused; the operator reads that, not the envelope.
  await assert.rejects(
    evaluateAskGate({ repositoryPath: repository, grantedPermissions: ["run_commands"] }, { run: async () => ({ stdout: JSON.stringify({ error: { code: "INVALID_INPUT", message: "Ref 'origin/nope' does not resolve to a commit.", hint: "Use a local branch that exists." } }), stderr: "", exitCode: 2 }) }),
    /refused the request: Ref 'origin\/nope' does not resolve to a commit\. Use a local branch/,
  );
});

test("the newest structural verdict decides the gate a Task ships with", () => {
  const repository = mkdtempSync(join(tmpdir(), "ade-ask-gate-review-"));
  mkdirSync(join(repository, ".ade"), { recursive: true });
  writeFileSync(join(repository, ".ade", "policy.json"), JSON.stringify({ requiredGates: ["build", "structural-gate", "human-approval"] }));
  const store = new AdeStore();
  store.saveTask(Task.create({ id: "task-gate", intent: "Weigh a change structurally", repositoryPath: repository }));

  assert.equal(getChangeReview(store, "task-gate").gates.find((gate) => gate.id === structuralGateId)?.status, "pending");

  store.saveRuntimeEvidence(createRuntimeEvidence({ id: "structural-1", taskId: "task-gate", at: "2026-09-08T10:00:00.000Z", type: "structural.gate.block", summary: "ASK BLOCK (since origin/main) — verify-edit" }));
  const blocked = getChangeReview(store, "task-gate").gates.find((gate) => gate.id === structuralGateId);
  assert.equal(blocked?.status, "failed");
  assert.deepEqual(blocked?.evidenceIds, ["structural-1"]);

  store.saveRuntimeEvidence(createRuntimeEvidence({ id: "structural-2", taskId: "task-gate", at: "2026-09-08T11:00:00.000Z", type: "structural.gate.pass", summary: "ASK PASS (since origin/main)" }));
  const passed = getChangeReview(store, "task-gate").gates.find((gate) => gate.id === structuralGateId);
  assert.equal(passed?.status, "passed");
  assert.deepEqual(passed?.evidenceIds, ["structural-2"]);
  store.close();
});

test("evidence names the verdict and the scope it was measured over", () => {
  assert.equal(askGateEvidenceType("BLOCK"), "structural.gate.block");
  assert.equal(askGateSummary({
    gate: { id: structuralGateId, required: true, status: "failed", evidenceIds: [] },
    verdict: "BLOCK", exitCode: 1, since: "origin/main", pr: null,
    blockingComponents: ["verify-edit"], unverifiedComponents: [],
    tool: { name: "ask", version: "5.9.30", buildCommit: null }, command: [], ranAt: "2026-09-08T10:00:00.000Z",
  }), "ASK BLOCK (since origin/main) — verify-edit");
});

test("a desktop launcher finds ASK in the operator's PATH before the standard prefixes", () => {
  const installed = "/Users/dev/.venvs/ask/bin/ask";
  assert.equal(askExecutable({ PATH: "/usr/bin:/Users/dev/.venvs/ask/bin" }, "darwin", (candidate) => candidate === installed), installed);
  assert.equal(askExecutable({ PATH: "" }, "darwin", (candidate) => candidate === "/opt/homebrew/bin/ask"), "/opt/homebrew/bin/ask");
  assert.equal(askExecutable({ ADE_ASK_COMMAND: "/opt/ask" }, "darwin", () => false), "/opt/ask");
  assert.equal(askExecutable({ Path: "C:\\Py\\Scripts" }, "win32", (candidate) => candidate === "C:\\Py\\Scripts\\ask.exe"), "C:\\Py\\Scripts\\ask.exe");
  assert.equal(askExecutable({ PATH: "" }, "linux", () => false), "ask");
  assert.equal(new AskUnavailableError().code, "ASK_UNAVAILABLE");
});
