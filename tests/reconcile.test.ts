import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { proposeKnowledgeReconciliation } from "../src/application/knowledge/reconcile.js";

test("reconciliation proposes affected citing documents without mutating them", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-reconcile-"));
  await writeFile(join(root, "SPEC-a.md"), "[B](SPEC-b.md#objective)");
  await writeFile(join(root, "SPEC-b.md"), "# B");
  const result = await proposeKnowledgeReconciliation(root, "SPEC-b.md");
  assert.deepEqual(result.affected, ["SPEC-a.md"]);
  assert.match(result.proposal, /Review 1/);
});
