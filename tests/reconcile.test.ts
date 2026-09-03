import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { applyKnowledgeReconciliation, proposeKnowledgeReconciliation, reconcileChangedDocumentation } from "../src/application/knowledge/reconcile.js";

const execFile = promisify(execFileCallback);

test("reconciliation proposes affected citing documents without mutating them", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-reconcile-"));
  await writeFile(join(root, "SPEC-a.md"), "[B](SPEC-b.md#objective)");
  await writeFile(join(root, "SPEC-b.md"), "# B");
  const result = await proposeKnowledgeReconciliation(root, "SPEC-b.md");
  assert.deepEqual(result.affected, ["SPEC-a.md"]);
  assert.match(result.proposal, /Review 1/);
});

test("knowledge graph follows nested and transitive references", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-reconcile-nested-"));
  await mkdir(join(root, "nested"));
  await writeFile(join(root, "nested", "SPEC-a.md"), "[B](../SPEC-b.md)");
  await writeFile(join(root, "SPEC-b.md"), "[C](SPEC-c.md)");
  await writeFile(join(root, "SPEC-c.md"), "# C");
  const result = await proposeKnowledgeReconciliation(root, "SPEC-c.md");
  assert.deepEqual(result.affected, ["SPEC-b.md", "nested/SPEC-a.md"]);
  assert.equal(result.graph.nodes.length, 3);
});

test("reconciliation writes traceable QA and estimate artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-reconcile-write-"));
  await writeFile(join(root, "SPEC-a.md"), "[B](SPEC-b.md)");
  await writeFile(join(root, "SPEC-b.md"), "# B");
  const result = await applyKnowledgeReconciliation(root, "SPEC-b.md");
  assert.deepEqual(result.artifacts, { reconciliationPath: "docu/generated/reconciliation/spec-b.md", qaPath: "docu/generated/qa/spec-b.md", estimatePath: "docu/generated/estimates/spec-b.md" });
  assert.match(await readFile(join(root, result.artifacts.qaPath), "utf8"), /Functional scope/);
});

test("reconciliation records its canonical trace in an existing Nexus exactly once", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-reconcile-nexus-"));
  await mkdir(join(root, "docu", "specs"), { recursive: true });
  await writeFile(join(root, "docu", "specs", "SPEC-NEXUS.md"), "# Nexus\n");
  await writeFile(join(root, "docu", "specs", "SPEC-a.md"), "[B](SPEC-b.md)");
  await writeFile(join(root, "docu", "specs", "SPEC-b.md"), "# B");
  await applyKnowledgeReconciliation(root, "docu/specs/SPEC-b.md");
  await applyKnowledgeReconciliation(root, "docu/specs/SPEC-b.md");
  const nexus = await readFile(join(root, "docu", "specs", "SPEC-NEXUS.md"), "utf8");
  assert.match(nexus, /Automatic Reconciliation Log/);
  assert.equal((nexus.match(/reconciliation:docu\/specs\/SPEC-b\.md/g) ?? []).length, 1);
});

test("reconciliation diagnoses resolved Markdown links instead of incidental text", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-reconcile-links-"));
  await writeFile(join(root, "SPEC-a.md"), "The changed file is SPEC-b.md, but it is not a Markdown reference.");
  await writeFile(join(root, "SPEC-b.md"), "# B");
  const result = await proposeKnowledgeReconciliation(root, "SPEC-b.md");
  assert.deepEqual(result.broken, []);
  assert.deepEqual(result.affected, []);
});

test("reconciliation applies every changed spec and ADR detected by Git", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-reconcile-changed-"));
  await mkdir(join(root, "docu", "specs"), { recursive: true });
  await mkdir(join(root, "docu", "adr"), { recursive: true });
  await writeFile(join(root, "docu", "specs", "SPEC-NEXUS.md"), "# Nexus\n");
  await writeFile(join(root, "docu", "specs", "SPEC-a.md"), "# A\n");
  await writeFile(join(root, "docu", "specs", "SPEC-b.md"), "# B\n[A](SPEC-a.md)\n");
  await writeFile(join(root, "docu", "adr", "0001.md"), "# ADR\n[A](../specs/SPEC-a.md)\n");
  await execFile("git", ["init", "-q"], { cwd: root });
  await execFile("git", ["add", "."], { cwd: root });
  await execFile("git", ["-c", "user.name=ADE test", "-c", "user.email=ade@example.test", "commit", "-qm", "initial"], { cwd: root });
  await writeFile(join(root, "docu", "specs", "SPEC-a.md"), "# A\nChanged\n");
  await writeFile(join(root, "docu", "adr", "0001.md"), "# ADR\nChanged\n");

  const result = await reconcileChangedDocumentation(root);

  assert.deepEqual(result.changedFiles, ["docu/adr/0001.md", "docu/specs/SPEC-a.md"]);
  assert.equal(result.results.length, 2);
  assert.ok(result.affected.includes("docu/specs/SPEC-b.md"));
});
