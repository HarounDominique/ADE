export type SkillPermission = "read_project" | "write_code" | "write_docs" | "run_commands" | "network";

export type SkillManifest = {
  id: string;
  version: string;
  label: string;
  description: string;
  inputs: readonly string[];
  outputs: readonly string[];
  permissions: readonly SkillPermission[];
  source: "native" | "project";
  /** Whether this skill has a body, or is only a manifest describing one.
      A manifest-only skill forwards its own description to the provider as a
      prompt; presenting that beside skills that actually execute leaves the
      operator unable to tell them apart (ADR-0056). */
  implemented?: boolean;
};

export function validateSkillManifest(manifest: SkillManifest): SkillManifest {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)) throw new Error(`Invalid skill id: ${manifest.id}`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error(`Invalid skill version: ${manifest.version}`);
  if (!manifest.label.trim() || manifest.permissions.length === 0) throw new Error(`Skill ${manifest.id} needs label and permissions`);
  return manifest;
}
