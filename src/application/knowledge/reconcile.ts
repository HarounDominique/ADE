import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildKnowledgeGraph } from "./knowledge-graph.js";

export async function proposeKnowledgeReconciliation(root: string, changedFile: string) {
  const graph = await buildKnowledgeGraph(root);
  const files = (await readdir(root)).filter((file) => file.endsWith(".md"));
  const affected = [] as string[];
  const broken = [] as string[];
  for (const file of files) {
    const content = await readFile(join(root, file), "utf8");
    if (content.includes(changedFile)) affected.push(file);
    if (content.includes(changedFile) && !content.includes(`](${changedFile}`)) broken.push(file);
  }
  return { changedFile, affected: affected.sort(), broken: broken.sort(), graph, proposal: affected.length ? `Review ${affected.length} citing document(s) before accepting ${changedFile}.` : "No citing documents require reconciliation." };
}
