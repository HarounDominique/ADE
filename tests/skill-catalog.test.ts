import test from "node:test";
import assert from "node:assert/strict";
import { listNativeSkills, listSkills } from "../src/application/skills/skill-catalog.js";
import { validateSkillManifest } from "../src/domain/skill.js";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runNativeSkill } from "../src/application/skills/run-skill.js";
import { installProjectSkill, skillSourceNeedsNetwork } from "../src/application/skills/skill-install.js";

test("native skill catalog includes the daily developer workflow", () => {
  const ids = listNativeSkills().map((skill) => skill.id);
  assert.deepEqual(ids, ["prompt-engineering", "pr-review", "spector", "adaptive-workflow", "uml", "functional-documentation", "task-estimation", "git-github"]);
});

test("native skills declare the capabilities that need an explicit per-run grant", () => {
  const git = listNativeSkills().find((skill) => skill.id === "git-github");
  const spector = listNativeSkills().find((skill) => skill.id === "spector");
  assert.deepEqual(git?.permissions, ["read_project", "run_commands", "network"]);
  assert.deepEqual(spector?.permissions, ["read_project", "write_docs"]);
});

test("skill manifests reject unscoped identifiers and missing permissions", () => {
  assert.throws(() => validateSkillManifest({ id: "Bad Skill", version: "1.0.0", label: "bad", description: "bad", inputs: [], outputs: [], permissions: [], source: "project" }));
});

test("project skills load from the local ADE skills directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-skills-"));
  await mkdir(join(root, ".ade", "skills"), { recursive: true });
  await writeFile(join(root, ".ade", "skills", "team-review.json"), JSON.stringify({ id: "team-review", version: "1.0.0", label: "Team review", description: "Review team conventions", inputs: ["intent"], outputs: ["findings"], permissions: ["read_project"] }));
  const skills = await listSkills(root);
  assert.ok(skills.some((skill) => skill.id === "team-review" && skill.source === "project"));
});

test("project skills are executable through the shared runtime contract", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-skills-run-"));
  await mkdir(join(root, ".ade", "skills"), { recursive: true });
  await writeFile(join(root, ".ade", "skills", "team-review.json"), JSON.stringify({ id: "team-review", version: "1.0.0", label: "Team review", description: "Review team conventions", inputs: ["intent"], outputs: ["findings"], permissions: ["read_project"] }));
  const calls: string[] = [];
  const runtime = { createSession: async () => ({ id: "session", directory: root }), prompt: async (_session: unknown, input: { text: string }) => { calls.push(input.text); } } as never;
  const result = await runNativeSkill(runtime, { skillId: "team-review", directory: root, intent: "Review this" });
  assert.equal(result.skill.source, "project");
  assert.match(calls[0] ?? "", /Team review/);
});

test("a local skill manifest installs into the Project catalog", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-skills-install-"));
  const source = join(root, "source.json");
  await writeFile(source, JSON.stringify({ id: "release-notes", version: "1.0.0", label: "Release notes", description: "Summarize release", inputs: ["intent"], outputs: ["notes"], permissions: ["write_docs"] }));
  const skill = await installProjectSkill({ repositoryPath: root, source });
  assert.equal(skill.id, "release-notes");
  assert.ok((await listSkills(root)).some((candidate) => candidate.id === "release-notes"));
});

test("remote skill sources are identifiable before any clone occurs", () => {
  assert.equal(skillSourceNeedsNetwork("owner/skill-repository"), true);
  assert.equal(skillSourceNeedsNetwork("https://example.test/skill.git"), true);
  assert.equal(skillSourceNeedsNetwork("/tmp/skill.json"), false);
});
