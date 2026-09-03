import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { buildKnowledgeGraph } from "./knowledge-graph.js";

export async function proposeKnowledgeReconciliation(root: string, changedFile: string) {
  const graph = await buildKnowledgeGraph(root);
  const files = graph.nodes;
  const normalizedChangedFile = relative(root, join(root, changedFile));
  const affected = [] as string[];
  const broken = [] as string[];
  for (const file of files) {
    const content = await readFile(join(root, file), "utf8");
    if (graph.edges.some((edge) => edge.from === file && edge.to === normalizedChangedFile)) affected.push(file);
    if (content.includes(changedFile) && !graph.edges.some((edge) => edge.from === file && edge.to === normalizedChangedFile)) broken.push(file);
  }
  const transitivelyAffected = new Set(affected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) if (transitivelyAffected.has(edge.to) && !transitivelyAffected.has(edge.from)) { transitivelyAffected.add(edge.from); changed = true; }
  }
  return { changedFile: normalizedChangedFile, affected: [...transitivelyAffected].sort(), broken: broken.sort(), graph, proposal: transitivelyAffected.size ? `Review ${transitivelyAffected.size} citing document(s) before accepting ${changedFile}.` : "No citing documents require reconciliation." };
}
