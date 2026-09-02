import type { ChangeSet } from "./change-set.js";

export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingAction = "fix" | "assign" | "accept-risk" | "dismiss";
export type ReviewStatus = "pass" | "changes_requested";

export type Finding = {
  id: string;
  severity: FindingSeverity;
  location?: { path: string; line?: number };
  claim: string;
  evidence: string;
  action: FindingAction;
};

export type Review = {
  id: string;
  taskId: string;
  changeSetId: string;
  reviewer: string;
  sessionId?: string;
  createdAt: string;
  summary: string;
  status: ReviewStatus;
  findings: readonly Finding[];
};

export function createReview(input: {
  id: string;
  taskId: string;
  changeSet: ChangeSet;
  reviewer: string;
  sessionId?: string;
  summary: string;
  findings: readonly Finding[];
}): Review {
  const status = input.findings.some((finding) => ["high", "critical"].includes(finding.severity))
    ? "changes_requested"
    : "pass";
  return {
    id: input.id,
    taskId: input.taskId,
    changeSetId: input.changeSet.id,
    reviewer: input.reviewer,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    createdAt: new Date().toISOString(),
    summary: input.summary,
    status,
    findings: input.findings,
  };
}
