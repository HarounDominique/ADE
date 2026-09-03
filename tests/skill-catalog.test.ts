import test from "node:test";
import assert from "node:assert/strict";
import { listNativeSkills, listSkills } from "../src/application/skills/skill-catalog.js";
import { validateSkillManifest } from "../src/domain/skill.js";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("native skill catalog includes the daily developer workflow", () => {
  const ids = listNativeSkills().map((skill) => skill.id);
  assert.deepEqual(ids, ["prompt-engineering", "pr-review", "spector", "adaptive-workflow", "uml", "functional-documentation", "task-estimation", "git-github"]);
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
