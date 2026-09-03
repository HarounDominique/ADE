import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runNativeSkill } from "../src/application/skills/run-skill.js";
import type { AgentRuntimePort } from "../src/ports/agent-runtime.js";

test("native skill execution creates an attributed agent session", async () => {
  let prompt = "";
  const runtime: AgentRuntimePort = {
    health: async () => ({ healthy: true }),
    createSession: async (input) => ({ id: input.title ?? "session", directory: input.directory }),
    prompt: async (_session, input) => { prompt = input.text; },
    promptAndWait: async () => ({}),
    events: async function* () {},
    diff: async () => [],
    abort: async () => {},
  };
  const result = await runNativeSkill(runtime, { skillId: "spector", directory: "/tmp", intent: "Update the nexus" });
  assert.equal(result.session.id, "skill-spector");
  assert.match(prompt, /Declared permissions/);
  assert.match(prompt, /Update the nexus/);
});

test("command-capable skills require an explicit per-run grant", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-skill-permission-"));
  await mkdir(join(root, ".ade", "skills"), { recursive: true });
  await writeFile(join(root, ".ade", "skills", "release-command.json"), JSON.stringify({ id: "release-command", version: "1.0.0", label: "Release command", description: "Run a release command", inputs: ["intent"], outputs: ["evidence"], permissions: ["read_project", "run_commands"] }));
  let prompted = false;
  const runtime: AgentRuntimePort = {
    health: async () => ({ healthy: true }),
    createSession: async () => ({ id: "permission-session", directory: root }),
    prompt: async () => { prompted = true; },
    promptAndWait: async () => ({}),
    events: async function* () {},
    diff: async () => [],
    abort: async () => {},
  };
  await assert.rejects(() => runNativeSkill(runtime, { skillId: "release-command", directory: root, intent: "Release" }), /explicit permission: run_commands/);
  await runNativeSkill(runtime, { skillId: "release-command", directory: root, intent: "Release", grantedPermissions: ["run_commands"] });
  assert.equal(prompted, true);
});
