import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
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

export async function applyKnowledgeReconciliation(root: string, changedFile: string) {
  const reconciliation = await proposeKnowledgeReconciliation(root, changedFile);
  const slug = basename(reconciliation.changedFile, ".md").toLowerCase();
  const generated = join(root, "docu", "generated");
  const reconciliationPath = join(generated, "reconciliation", `${slug}.md`);
  const qaPath = join(generated, "qa", `${slug}.md`);
  const estimatePath = join(generated, "estimates", `${slug}.md`);
  await Promise.all([mkdir(join(generated, "reconciliation"), { recursive: true }), mkdir(join(generated, "qa"), { recursive: true }), mkdir(join(generated, "estimates"), { recursive: true })]);
  const affected = reconciliation.affected.length ? reconciliation.affected.map((file) => `- [ ] Review and synchronize [${file}](../../specs/${file})`).join("\n") : "- No dependent specifications detected.";
  const broken = [...reconciliation.broken, ...reconciliation.graph.brokenReferences.map((item) => `${item.from} → ${item.target}`)];
  await Promise.all([
    writeFile(reconciliationPath, `# Reconciliation: ${reconciliation.changedFile}\n\nGenerated from the current documentation graph.\n\n## Affected documents\n\n${affected}\n\n## Broken references\n\n${broken.length ? broken.map((item) => `- ${item}`).join("\n") : "- None."}\n\n## Mermaid UML\n\n\`\`\`mermaid\n${reconciliation.graph.uml}\n\`\`\`\n`, "utf8"),
    writeFile(qaPath, `# QA impact: ${reconciliation.changedFile}\n\n## Functional scope\n\nValidate the behavior and acceptance criteria changed by ${reconciliation.changedFile}.\n\n## Affected specifications\n\n${reconciliation.affected.length ? reconciliation.affected.map((file) => `- ${file}`).join("\n") : "- No dependent specifications detected."}\n\n## Verification checklist\n\n- [ ] Review changed acceptance criteria.\n- [ ] Add or update automated tests.\n- [ ] Verify documentation links and generated diagrams.\n- [ ] Record evidence on the related Task.\n`, "utf8"),
    writeFile(estimatePath, `# Estimate: ${reconciliation.changedFile}\n\n## Inputs\n\n- Changed spec: ${reconciliation.changedFile}\n- Direct and transitive dependents: ${reconciliation.affected.length}\n- Broken references: ${broken.length}\n\n## Estimate\n\n| Work item | Initial estimate |\n| --- | --- |\n| Specification and Nexus synchronization | ${reconciliation.affected.length ? "Medium" : "Small"} |\n| QA documentation and verification | Small |\n| Implementation impact | Requires task-specific decomposition |\n\n## Traceability\n\nSee [reconciliation report](../reconciliation/${slug}.md) and [QA impact](../qa/${slug}.md).\n`, "utf8"),
  ]);
  return { ...reconciliation, artifacts: { reconciliationPath: relative(root, reconciliationPath), qaPath: relative(root, qaPath), estimatePath: relative(root, estimatePath) } };
}
