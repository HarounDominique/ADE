import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
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
  assert.match(graph.uml, /classDiagram/);
  assert.equal(graph.brokenReferences.length, 0);
});

test("knowledge graph reports broken document references", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-graph-broken-"));
  await writeFile(join(root, "SPEC-a.md"), "[Missing](SPEC-missing.md)");
  const graph = await buildKnowledgeGraph(root);
  assert.deepEqual(graph.brokenReferences, [{ from: "SPEC-a.md", target: "SPEC-missing.md" }]);
});

test("knowledge graph ignores tool documentation outside the project contract", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-graph-tools-"));
  await mkdir(join(root, ".agents", "skills"), { recursive: true });
  await writeFile(join(root, "SPEC-a.md"), "# A\n");
  await writeFile(join(root, ".agents", "skills", "tool.md"), "[external](https://example.com/docs.md)\n");
  const graph = await buildKnowledgeGraph(root);
  assert.deepEqual(graph.nodes, ["SPEC-a.md"]);
  assert.deepEqual(graph.brokenReferences, []);
});
