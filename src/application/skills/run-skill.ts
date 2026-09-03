import type { AgentRuntimePort } from "../../ports/agent-runtime.js";
import { listSkills } from "./skill-catalog.js";

export async function runNativeSkill(runtime: AgentRuntimePort, input: { skillId: string; directory: string; intent: string }) {
  const skill = (await listSkills(input.directory)).find((candidate) => candidate.id === input.skillId);
  if (!skill) throw new Error(`Native skill not found: ${input.skillId}`);
  const session = await runtime.createSession({ directory: input.directory, title: `skill-${skill.id}` });
  await runtime.prompt(session, { text: [
    `You are running the ADE skill: ${skill.label}.`,
    skill.description,
    `Declared permissions: ${skill.permissions.join(", ")}.`,
    `Return outputs: ${skill.outputs.join(", ")}.`,
    `Task intent: ${input.intent}`,
  ].join("\n") });
  return { skill, session };
}
