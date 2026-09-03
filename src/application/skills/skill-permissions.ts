import type { SkillManifest, SkillPermission } from "../../domain/skill.js";

const automatic: readonly SkillPermission[] = ["read_project", "write_docs"];

export function assertSkillPermissions(skill: SkillManifest, granted: readonly SkillPermission[]): void {
  const missing = skill.permissions.filter((permission) => !automatic.includes(permission) && !granted.includes(permission));
  if (missing.length) throw new Error(`Skill ${skill.id} requires explicit permission: ${missing.join(", ")}`);
}
