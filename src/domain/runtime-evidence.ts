export type RuntimeEvidence = {
  id: string;
  taskId: string;
  sessionId?: string;
  type: string;
  at: string;
  summary: string;
  details?: string;
};

const SUMMARY_LIMIT = 500;
const DETAILS_LIMIT = 2_000;

export function createRuntimeEvidence(input: {
  id: string;
  taskId: string;
  sessionId?: string;
  type: string;
  at?: string;
  summary: string;
  details?: string;
}): RuntimeEvidence {
  if (!input.id.trim() || !input.taskId.trim() || !input.type.trim()) throw new Error("Runtime evidence identity is required");
  if (!input.summary.trim()) throw new Error("Runtime evidence summary is required");
  return {
    id: input.id,
    taskId: input.taskId,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    type: input.type.slice(0, 120),
    at: input.at ?? new Date().toISOString(),
    summary: input.summary.slice(0, SUMMARY_LIMIT),
    ...(input.details ? { details: input.details.slice(0, DETAILS_LIMIT) } : {}),
  };
}
