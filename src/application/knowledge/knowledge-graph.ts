import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

export type KnowledgeGraph = { nodes: readonly string[]; edges: readonly { from: string; to: string; heading?: string }[]; mermaid: string; uml: string; brokenReferences: readonly { from: string; target: string }[] };

export async function buildKnowledgeGraph(root: string): Promise<KnowledgeGraph> {
  const files = await markdownFiles(root);
  const nodes = [...files];
  const edges: { from: string; to: string; heading?: string }[] = [];
  const brokenReferences: { from: string; target: string }[] = [];
  for (const file of files) {
    const content = await readFile(join(root, file), "utf8");
    for (const match of content.matchAll(/\]\(([^)#]+\.md)(?:#([^)]*))?\)/g)) {
      if (!match[1]) continue;
      const normalized = relative(root, resolve(root, dirname(file), match[1]));
      if (nodes.includes(normalized)) edges.push({ from: file, to: normalized, ...(match[2] ? { heading: match[2] } : {}) });
      else brokenReferences.push({ from: file, target: normalized });
    }
  }
  const mermaid = ["graph TD", ...edges.map((edge) => `  ${node(edge.from)} -->|${edge.heading ?? "references"}| ${node(edge.to)}`)].join("\n");
  const uml = ["classDiagram", ...nodes.map((item) => `  class ${node(item)} {\n    <<document>>\n  }`), ...edges.map((edge) => `  ${node(edge.from)} --> ${node(edge.to)} : ${edge.heading ?? "references"}`)].join("\n");
  return { nodes, edges, mermaid, uml, brokenReferences };
}

async function markdownFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith(".md")) result.push(relative(root, path));
    }
  }
  await visit(root);
  return result.sort();
}

function node(file: string): string { return `n${file.replace(/[^a-zA-Z0-9]/g, "")}`; }
