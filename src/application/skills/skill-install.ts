import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { executeGit } from "../../adapters/git-command.js";
import { validateSkillManifest, type SkillManifest } from "../../domain/skill.js";

type StoredProjectSkill = SkillManifest & { installedFrom?: string; installedAt?: string };

export async function installProjectSkill(input: { repositoryPath: string; source: string; manifestPath?: string; expectedId?: string }): Promise<SkillManifest> {
  const checkout = await resolveSource(input.source);
  try {
    const manifestFile = input.manifestPath ?? (checkout.file ? checkout.path : join(checkout.path, "skill.json"));
    const manifest = validateSkillManifest({ ...JSON.parse(await readFile(manifestFile, "utf8")) as SkillManifest, source: "project" });
    if (input.expectedId && manifest.id !== input.expectedId) throw new Error(`Updated skill id ${manifest.id} does not match ${input.expectedId}`);
    const destination = join(input.repositoryPath, ".ade", "skills", `${manifest.id}.json`);
    await mkdir(join(input.repositoryPath, ".ade", "skills"), { recursive: true });
    const installedFrom = checkout.file ? await realpath(input.source) : input.source;
    const stored: StoredProjectSkill = { ...manifest, installedFrom, installedAt: new Date().toISOString() };
    await writeFile(destination, `${JSON.stringify(stored, null, 2)}\n`);
    return manifest;
  } finally {
    if (!checkout.file) await rm(checkout.path, { recursive: true, force: true });
  }
}

export async function projectSkillSourceNeedsNetwork(input: { repositoryPath: string; skillId: string }): Promise<boolean> {
  const skill = await readStoredProjectSkill(input.repositoryPath, input.skillId);
  return skill.installedFrom ? skillSourceNeedsNetwork(skill.installedFrom) : false;
}

export async function updateProjectSkill(input: { repositoryPath: string; skillId: string }): Promise<SkillManifest> {
  const skill = await readStoredProjectSkill(input.repositoryPath, input.skillId);
  if (!skill.installedFrom) throw new Error(`Skill ${input.skillId} has no recorded source and cannot be updated automatically`);
  return installProjectSkill({ repositoryPath: input.repositoryPath, source: skill.installedFrom, expectedId: input.skillId });
}

export function skillSourceNeedsNetwork(source: string): boolean {
  return /^(https?:\/\/|git@)/.test(source) || /^[\w.-]+\/[\w.-]+$/.test(source);
}

async function readStoredProjectSkill(repositoryPath: string, skillId: string): Promise<StoredProjectSkill> {
  const manifestPath = join(repositoryPath, ".ade", "skills", `${skillId}.json`);
  try {
    const skill = JSON.parse(await readFile(manifestPath, "utf8")) as StoredProjectSkill;
    return validateSkillManifest({ ...skill, source: "project" }) as StoredProjectSkill;
  } catch (error) {
    throw new Error(`Unable to read Project skill ${skillId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function resolveSource(source: string): Promise<{ path: string; file: boolean }> {
  if (source.endsWith(".json")) return { path: source, file: true };
  const directory = await mkdtemp(join(tmpdir(), "ade-skill-install-"));
  const remote = /^[\w.-]+\/[\w.-]+$/.test(source) ? `https://github.com/${source}.git` : source;
  try {
    await executeGit(["clone", "--depth", "1", remote, directory]);
    return { path: directory, file: false };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw new Error(`Unable to install skill from ${basename(source)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
