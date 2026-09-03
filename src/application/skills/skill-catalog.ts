import { nativeProviders } from "../../domain/agent-provider.js";
import { validateSkillManifest, type SkillManifest } from "../../domain/skill.js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const nativeSkillDefinitions: ReadonlyArray<Pick<SkillManifest, "id" | "label" | "description" | "permissions">> = [
  { id: "prompt-engineering", label: "Prompt engineering", description: "Shape intent, constraints and acceptance criteria.", permissions: ["read_project"] },
  { id: "pr-review", label: "PR review", description: "Review a ChangeSet with evidence and actionable findings.", permissions: ["read_project"] },
  { id: "spector", label: "Spector specs", description: "Generate and reconcile living specifications.", permissions: ["read_project", "write_docs"] },
  { id: "adaptive-workflow", label: "Adaptive workflow", description: "Select phase, mode and re-entry without rigid ceremony.", permissions: ["read_project"] },
  { id: "uml", label: "UML diagrams", description: "Generate diagrams that support specs and quality review.", permissions: ["read_project", "write_docs"] },
  { id: "functional-documentation", label: "Functional documentation", description: "Explain scope, behavior and rationale for QA.", permissions: ["read_project", "write_docs"] },
  { id: "task-estimation", label: "Task estimation", description: "Estimate implementation effort from functional intent.", permissions: ["read_project"] },
  { id: "git-github", label: "Git and GitHub", description: "Prepare auditable branches, diffs and pull requests.", permissions: ["read_project", "run_commands", "network"] },
];

export const nativeSkills: readonly SkillManifest[] = nativeSkillDefinitions.map((skill) => validateSkillManifest({
  ...skill,
  version: "1.0.0",
  inputs: ["intent", "context"],
  outputs: ["proposal", "evidence"],
  source: "native",
}));

export function listNativeSkills(): readonly SkillManifest[] {
  return nativeSkills;
}

export function getNativeSkill(id: string): SkillManifest | undefined {
  return nativeSkills.find((skill) => skill.id === id);
}

export async function loadProjectSkills(repositoryPath: string): Promise<readonly SkillManifest[]> {
  const directory = join(repositoryPath, ".ade", "skills");
  try {
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
    const skills: SkillManifest[] = [];
    for (const file of files) {
      const value = JSON.parse(await readFile(join(directory, file), "utf8")) as SkillManifest;
      skills.push(validateSkillManifest({ ...value, source: "project" }));
    }
    return skills;
  } catch {
    return [];
  }
}

export async function listSkills(repositoryPath?: string): Promise<readonly SkillManifest[]> {
  return repositoryPath ? [...nativeSkills, ...(await loadProjectSkills(repositoryPath))] : nativeSkills;
}

export function listNativeProviders(): readonly string[] {
  return nativeProviders.map((provider) => provider.id);
}
