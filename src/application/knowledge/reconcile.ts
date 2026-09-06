import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { buildKnowledgeGraph, relative } from "./knowledge-graph.js";

const execFile = promisify(execFileCallback);

export async function proposeKnowledgeReconciliation(root: string, changedFile: string) {
  const graph = await buildKnowledgeGraph(root);
  const files = graph.nodes;
  const normalizedChangedFile = relative(root, join(root, changedFile));
  const affected = [] as string[];
  for (const file of files) {
    if (graph.edges.some((edge) => edge.from === file && edge.to === normalizedChangedFile)) affected.push(file);
  }
  const transitivelyAffected = new Set(affected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) if (transitivelyAffected.has(edge.to) && !transitivelyAffected.has(edge.from)) { transitivelyAffected.add(edge.from); changed = true; }
  }
  const broken = graph.brokenReferences.map((item) => `${item.from} → ${item.target}`).sort();
  return { changedFile: normalizedChangedFile, affected: [...transitivelyAffected].sort(), broken, graph, proposal: transitivelyAffected.size ? `Review ${transitivelyAffected.size} citing document(s) before accepting ${changedFile}.` : "No citing documents require reconciliation." };
}

export async function applyKnowledgeReconciliation(root: string, changedFile: string) {
  const reconciliation = await proposeKnowledgeReconciliation(root, changedFile);
  const slug = basename(reconciliation.changedFile, ".md").toLowerCase();
  const generated = join(root, "docu", "generated");
  const reconciliationPath = join(generated, "reconciliation", `${slug}.md`);
  const qaPath = join(generated, "qa", `${slug}.md`);
  const estimatePath = join(generated, "estimates", `${slug}.md`);
  await Promise.all([mkdir(join(generated, "reconciliation"), { recursive: true }), mkdir(join(generated, "qa"), { recursive: true }), mkdir(join(generated, "estimates"), { recursive: true })]);
  const affected = reconciliation.affected.length ? reconciliation.affected.map((file) => `- [ ] Review and synchronize [${file}](${relative(dirname(reconciliationPath), join(root, file))})`).join("\n") : "- No dependent specifications detected.";
  const broken = reconciliation.broken;
  await Promise.all([
    writeFile(reconciliationPath, `# Reconciliation: ${reconciliation.changedFile}\n\nGenerated from the current documentation graph.\n\n## Affected documents\n\n${affected}\n\n## Broken references\n\n${broken.length ? broken.map((item) => `- ${item}`).join("\n") : "- None."}\n\n## Mermaid UML\n\n\`\`\`mermaid\n${reconciliation.graph.uml}\n\`\`\`\n`, "utf8"),
    writeFile(qaPath, `# QA impact: ${reconciliation.changedFile}\n\n## Functional scope\n\nValidate the behavior and acceptance criteria changed by ${reconciliation.changedFile}.\n\n## Affected specifications\n\n${reconciliation.affected.length ? reconciliation.affected.map((file) => `- ${file}`).join("\n") : "- No dependent specifications detected."}\n\n## Verification checklist\n\n- [ ] Review changed acceptance criteria.\n- [ ] Add or update automated tests.\n- [ ] Verify documentation links and generated diagrams.\n- [ ] Record evidence on the related Task.\n`, "utf8"),
    writeFile(estimatePath, `# Estimate: ${reconciliation.changedFile}\n\n## Inputs\n\n- Changed spec: ${reconciliation.changedFile}\n- Direct and transitive dependents: ${reconciliation.affected.length}\n- Broken references: ${broken.length}\n\n## Estimate\n\n| Work item | Initial estimate |\n| --- | --- |\n| Specification and Nexus synchronization | ${reconciliation.affected.length ? "Medium" : "Small"} |\n| QA documentation and verification | Small |\n| Implementation impact | Requires task-specific decomposition |\n\n## Traceability\n\nSee [reconciliation report](../reconciliation/${slug}.md) and [QA impact](../qa/${slug}.md).\n`, "utf8"),
  ]);
  await appendNexusReconciliation(root, reconciliation, { reconciliationPath, qaPath, estimatePath });
  return { ...reconciliation, artifacts: { reconciliationPath: relative(root, reconciliationPath), qaPath: relative(root, qaPath), estimatePath: relative(root, estimatePath) } };
}

export async function reconcileChangedDocumentation(root: string) {
  const changedFiles = await changedDocumentationFiles(root);
  const results = [] as Awaited<ReturnType<typeof applyKnowledgeReconciliation>>[];
  for (const file of changedFiles) results.push(await applyKnowledgeReconciliation(root, file));
  const graph = results.at(-1)?.graph ?? await buildKnowledgeGraph(root);
  const affected = [...new Set(results.flatMap((result) => result.affected))].sort();
  const broken = [...new Set(results.flatMap((result) => result.broken))].sort();
  return {
    changedFiles,
    results,
    graph,
    affected,
    broken,
    proposal: changedFiles.length
      ? `Reconciled ${changedFiles.length} changed documentation file(s) and found ${affected.length} dependent document(s).`
      : "No changed specifications or ADRs require reconciliation.",
  };
}

async function changedDocumentationFiles(root: string): Promise<string[]> {
  const status = await execFile("git", ["status", "--porcelain"], { cwd: root });
  return status.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1)?.replace(/^"|"$/g, "") ?? "")
    .filter((file) => file.endsWith(".md"))
    .filter((file) => (file.startsWith("docu/specs/") && file !== "docu/specs/SPEC-NEXUS.md") || file.startsWith("docu/adr/"))
    .sort();
}

async function appendNexusReconciliation(
  root: string,
  reconciliation: Awaited<ReturnType<typeof proposeKnowledgeReconciliation>>,
  artifacts: { reconciliationPath: string; qaPath: string; estimatePath: string },
): Promise<void> {
  const nexusPath = join(root, "docu", "specs", "SPEC-NEXUS.md");
  try {
    const nexus = await readFile(nexusPath, "utf8");
    const key = `<!-- reconciliation:${reconciliation.changedFile} -->`;
    const relativeArtifacts = Object.values(artifacts).map((path) => relative(dirname(nexusPath), path));
    const entry = `${key}\n- ${new Date().toISOString().slice(0, 10)} — automatic-reconciliation — ${reconciliation.changedFile}; ${reconciliation.affected.length} dependent document(s), ${reconciliation.broken.length} broken reference(s). Artifacts: ${relativeArtifacts.join(", ")}.`;
    const prior = nexus.indexOf(key);
    if (prior >= 0) {
      const end = nexus.indexOf("\n", prior + key.length + 1);
      await writeFile(nexusPath, `${nexus.slice(0, prior)}${entry}${end >= 0 ? nexus.slice(end) : "\n"}`, "utf8");
      return;
    }
    const heading = "## Automatic Reconciliation Log";
    await writeFile(nexusPath, nexus.includes(heading) ? `${nexus.trimEnd()}\n${entry}\n` : `${nexus.trimEnd()}\n\n${heading}\n\n${entry}\n`, "utf8");
  } catch {
    // A Project without ADE specs can still receive its generated reconciliation package.
  }
}
