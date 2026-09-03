import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findReferenceImpact } from "../src/application/knowledge/reference-impact.js";

test("reference impact lists citers and flags malformed links", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-knowledge-"));
  await writeFile(join(root, "SPEC-a.md"), "[b](SPEC-b.md#objective)");
  await writeFile(join(root, "SPEC-b.md"), "# B");
  await writeFile(join(root, "SPEC-c.md"), "SPEC-b.md without a link");
  const impact = await findReferenceImpact(root, "SPEC-b.md");
  assert.deepEqual(impact.citers, ["SPEC-a.md", "SPEC-c.md"]);
  assert.deepEqual(impact.broken, ["SPEC-c.md"]);
});
