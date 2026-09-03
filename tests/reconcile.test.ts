import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyKnowledgeReconciliation, proposeKnowledgeReconciliation } from "../src/application/knowledge/reconcile.js";

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
