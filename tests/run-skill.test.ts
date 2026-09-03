import test from "node:test";
import assert from "node:assert/strict";
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
