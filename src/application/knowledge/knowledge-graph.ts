import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type KnowledgeGraph = { nodes: readonly string[]; edges: readonly { from: string; to: string; heading?: string }[]; mermaid: string };

export async function buildKnowledgeGraph(root: string): Promise<KnowledgeGraph> {
  const files = (await readdir(root)).filter((file) => file.endsWith(".md")).sort();
  const nodes = [...files];
  const edges: { from: string; to: string; heading?: string }[] = [];
  for (const file of files) {
    const content = await readFile(join(root, file), "utf8");
    for (const match of content.matchAll(/\]\((SPEC-[^)#]+\.md)(?:#([^)]*))?\)/g)) {
      if (match[1] && nodes.includes(match[1])) edges.push({ from: file, to: match[1], ...(match[2] ? { heading: match[2] } : {}) });
    }
  }
  const mermaid = ["graph TD", ...edges.map((edge) => `  ${node(edge.from)} -->|${edge.heading ?? "references"}| ${node(edge.to)}`)].join("\n");
  return { nodes, edges, mermaid };
}

function node(file: string): string { return `n${file.replace(/[^a-zA-Z0-9]/g, "")}`; }
