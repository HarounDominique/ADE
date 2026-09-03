import { nativeProviders } from "../../domain/agent-provider.js";
import { validateSkillManifest, type SkillManifest } from "../../domain/skill.js";

export const nativeSkills: readonly SkillManifest[] = ([
  ["prompt-engineering", "Prompt engineering", "Shape intent, constraints and acceptance criteria."],
  ["pr-review", "PR review", "Review a ChangeSet with evidence and actionable findings."],
  ["spector", "Spector specs", "Generate and reconcile living specifications."],
  ["adaptive-workflow", "Adaptive workflow", "Select phase, mode and re-entry without rigid ceremony."],
  ["uml", "UML diagrams", "Generate diagrams that support specs and quality review."],
  ["functional-documentation", "Functional documentation", "Explain scope, behavior and rationale for QA."],
  ["task-estimation", "Task estimation", "Estimate implementation effort from functional intent."],
  ["git-github", "Git and GitHub", "Prepare auditable branches, diffs and pull requests."],
] as const).map(([id, label, description]) => validateSkillManifest({ id, label, description, version: "1.0.0", inputs: ["intent", "context"], outputs: ["proposal", "evidence"], permissions: ["read_project"], source: "native" }));

export function listNativeSkills(): readonly SkillManifest[] {
  return nativeSkills;
}

export function listNativeProviders(): readonly string[] {
  return nativeProviders.map((provider) => provider.id);
}
