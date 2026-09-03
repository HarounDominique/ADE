import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildKnowledgeGraph } from "../src/application/knowledge/knowledge-graph.js";

test("knowledge graph emits Mermaid edges for valid spec references", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-graph-"));
  await writeFile(join(root, "SPEC-a.md"), "[B](SPEC-b.md#objective)");
  await writeFile(join(root, "SPEC-b.md"), "# B");
  const graph = await buildKnowledgeGraph(root);
  assert.deepEqual(graph.edges, [{ from: "SPEC-a.md", to: "SPEC-b.md", heading: "objective" }]);
  assert.match(graph.mermaid, /graph TD/);
});
