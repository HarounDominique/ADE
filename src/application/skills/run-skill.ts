import type { AgentRuntimePort, RuntimeEvent } from "../../ports/agent-runtime.js";
import { listSkills } from "./skill-catalog.js";

export async function runNativeSkill(runtime: AgentRuntimePort, input: { skillId: string; directory: string; intent: string; sessionId?: string; onEvent?: (event: RuntimeEvent) => void }) {
  const skill = (await listSkills(input.directory)).find((candidate) => candidate.id === input.skillId);
  if (!skill) throw new Error(`Native skill not found: ${input.skillId}`);
  const session = input.sessionId ? { id: input.sessionId, directory: input.directory } : await runtime.createSession({ directory: input.directory, title: `skill-${skill.id}` });
  const completion = input.onEvent ? collectUntilIdle(runtime.events(), input.onEvent) : undefined;
  await runtime.prompt(session, { text: [
    `You are running the ADE skill: ${skill.label}.`,
    skill.description,
    `Declared permissions: ${skill.permissions.join(", ")}.`,
    `Return outputs: ${skill.outputs.join(", ")}.`,
    `Task intent: ${input.intent}`,
  ].join("\n") });
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
