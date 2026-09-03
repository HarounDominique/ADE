import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { validateSkillManifest, type SkillManifest } from "../../domain/skill.js";

const execFile = promisify(execFileCallback);

export async function installProjectSkill(input: { repositoryPath: string; source: string; manifestPath?: string }): Promise<SkillManifest> {
  const checkout = await resolveSource(input.source);
  try {
    const manifestFile = input.manifestPath ?? (checkout.file ? checkout.path : join(checkout.path, "skill.json"));
    const manifest = validateSkillManifest({ ...JSON.parse(await readFile(manifestFile, "utf8")) as SkillManifest, source: "project" });
    const destination = join(input.repositoryPath, ".ade", "skills", `${manifest.id}.json`);
    await mkdir(join(input.repositoryPath, ".ade", "skills"), { recursive: true });
    await copyFile(manifestFile, destination);
    return manifest;
  } finally {
    if (!checkout.file) await rm(checkout.path, { recursive: true, force: true });
  }
}

export function skillSourceNeedsNetwork(source: string): boolean {
  return /^(https?:\/\/|git@)/.test(source) || /^[\w.-]+\/[\w.-]+$/.test(source);
}

async function resolveSource(source: string): Promise<{ path: string; file: boolean }> {
  if (source.endsWith(".json")) return { path: source, file: true };
  const directory = await mkdtemp(join(tmpdir(), "ade-skill-install-"));
  const remote = /^[\w.-]+\/[\w.-]+$/.test(source) ? `https://github.com/${source}.git` : source;
  try {
    await execFile("git", ["clone", "--depth", "1", remote, directory]);
    return { path: directory, file: false };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw new Error(`Unable to install skill from ${basename(source)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
