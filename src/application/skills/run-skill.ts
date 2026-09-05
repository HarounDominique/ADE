import type { AgentRuntimePort, RuntimeEvent, SessionHandle } from "../../ports/agent-runtime.js";
import type { SkillPermission } from "../../domain/skill.js";
import { listSkills } from "./skill-catalog.js";
import { assertSkillPermissions } from "./skill-permissions.js";

export async function runNativeSkill(runtime: AgentRuntimePort, input: { skillId: string; directory: string; intent: string; sessionId?: string; grantedPermissions?: readonly SkillPermission[]; onSession?: (session: SessionHandle) => void | Promise<void>; onEvent?: (event: RuntimeEvent) => void }) {
  const skill = (await listSkills(input.directory)).find((candidate) => candidate.id === input.skillId);
  if (!skill) throw new Error(`Native skill not found: ${input.skillId}`);
  assertSkillPermissions(skill, input.grantedPermissions ?? []);
  const session = input.sessionId ? { id: input.sessionId, directory: input.directory } : await runtime.createSession({ directory: input.directory, title: `skill-${skill.id}` });
  await input.onSession?.(session);
  const completion = input.onEvent ? collectUntilIdle(runtime.events(), input.onEvent) : undefined;
  await runtime.prompt(session, { text: [
    `You are running the ADE skill: ${skill.label}.`,
    skill.description,
    `Declared permissions: ${skill.permissions.join(", ")}.`,
    `Return outputs: ${skill.outputs.join(", ")}.`,
    `Task intent: ${input.intent}`,
  ].join("\n"), grantedPermissions: input.grantedPermissions ?? [] });
  const events = completion ? await completion : [];
  return { skill, session, events };
}

async function collectUntilIdle(source: AsyncIterable<RuntimeEvent>, onEvent: (event: RuntimeEvent) => void): Promise<RuntimeEvent[]> {
  const events: RuntimeEvent[] = [];
  for await (const event of source) {
    events.push(event);
    onEvent(event);
    const payload = event.payload as { type?: string };
    if (payload.type === "session.idle") break;
  }
  return events;
}
