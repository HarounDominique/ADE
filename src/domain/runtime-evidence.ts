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

export type RuntimeEvidencePolicy = { summaryLimit?: number; detailsLimit?: number };

export function createRuntimeEvidence(input: {
  id: string;
  taskId: string;
  sessionId?: string;
  type: string;
  at?: string;
  summary: string;
  details?: string;
  policy?: RuntimeEvidencePolicy;
}): RuntimeEvidence {
  if (!input.id.trim() || !input.taskId.trim() || !input.type.trim()) throw new Error("Runtime evidence identity is required");
  if (!input.summary.trim()) throw new Error("Runtime evidence summary is required");
  const summaryLimit = boundedLimit(input.policy?.summaryLimit, SUMMARY_LIMIT);
  const detailsLimit = boundedLimit(input.policy?.detailsLimit, DETAILS_LIMIT);
  return {
    id: input.id,
    taskId: input.taskId,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    type: input.type.slice(0, 120),
    at: input.at ?? new Date().toISOString(),
    summary: input.summary.slice(0, summaryLimit),
    ...(input.details ? { details: input.details.slice(0, detailsLimit) } : {}),
  };
}

function boundedLimit(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0 ? Math.min(value, fallback) : fallback;
}
