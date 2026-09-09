import type { ChangeSet } from "../domain/change-set.js";
import type { Finding, FindingAction, FindingSeverity } from "../domain/review.js";
import type { AgentRuntimePort } from "../ports/agent-runtime.js";
import type { ReviewInput, ReviewOutput, ReviewerPort } from "../ports/reviewer.js";

const reviewSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          path: { type: "string" },
          line: { type: "number" },
          claim: { type: "string" },
          evidence: { type: "string" },
          action: { type: "string", enum: ["fix", "assign", "accept-risk", "dismiss"] },
        },
        required: ["severity", "claim", "evidence", "action"],
      },
    },
  },
  required: ["summary", "findings"],
};

export class OpenCodeReviewer implements ReviewerPort {
  constructor(private readonly runtime: AgentRuntimePort) {}

  async review(input: ReviewInput): Promise<ReviewOutput> {
    const session = await this.runtime.createSession({
      directory: input.changeSet.directory,
      title: `review-${input.changeSet.id}`,
    });
    const response = await this.runtime.promptAndWait(session, {
      text: buildReviewPrompt(input),
      format: { type: "json_schema", schema: reviewSchema, retryCount: 2 },
    });
    const parsed = parseStructuredReview(response);
    return {
      reviewer: "opencode-reviewer",
      sessionId: session.id,
      summary: parsed.summary,
      findings: parsed.findings.map((finding, index) => ({
        id: `finding-${input.changeSet.id}-${index + 1}`,
        severity: finding.severity,
        ...(finding.path ? { location: { path: finding.path, ...(finding.line ? { line: finding.line } : {}) } } : {}),
        claim: finding.claim,
        evidence: finding.evidence,
        action: finding.action,
      })),
    };
  }
}

function buildReviewPrompt(input: ReviewInput): string {
  return [
    "You are an independent code reviewer for ADE.",
    "Review only the evidence below. Do not assume or invent changes.",
    "Do not discuss the implementer's conversation; it is intentionally unavailable.",
    "Return only the requested JSON structure.",
    "",
    `Task intent: ${input.intent}`,
    ...(input.acceptanceCriteria?.length
      ? ["Acceptance criteria the change must satisfy:", ...input.acceptanceCriteria.map((criterion, index) => `${index + 1}. ${criterion}`), "Judge the change against these criteria; a criterion left unmet is a finding."]
      : ["No acceptance criteria were recorded; judge only against the stated intent."]),
    `ChangeSet: ${input.changeSet.id}`,
    `Runtime diff: ${JSON.stringify(input.changeSet.runtimeDiff)}`,
    `Git status: ${input.changeSet.git.status}`,
    `Git patch: ${input.changeSet.git.patch}`,
    `Untracked files: ${JSON.stringify(input.changeSet.git.untracked)}`,
  ].join("\n");
}

type RawReview = {
  summary: string;
  findings: Array<{
    severity: FindingSeverity;
    path?: string;
    line?: number;
    claim: string;
    evidence: string;
    action: FindingAction;
  }>;
};

function parseStructuredReview(response: unknown): RawReview {
  const root = response as { data?: { info?: { structured?: unknown; structured_output?: unknown }; parts?: unknown[] }; info?: { structured?: unknown; structured_output?: unknown }; parts?: unknown[] };
  const structured = root.data?.info?.structured ?? root.info?.structured
    ?? root.data?.info?.structured_output ?? root.info?.structured_output;
  const candidate = structured ?? extractTextJson(root.data?.parts ?? root.parts ?? []);
  if (!candidate || typeof candidate !== "object") throw new Error("Reviewer returned no structured output");
  const value = candidate as { summary?: unknown; findings?: unknown };
  if (typeof value.summary !== "string" || !Array.isArray(value.findings)) {
    throw new Error("Reviewer output does not match the review schema");
  }
  return {
    summary: value.summary,
    findings: value.findings.map((item) => validateFinding(item)),
  };
}

function extractTextJson(parts: unknown[]): unknown {
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text !== "string") continue;
    try { return JSON.parse(text) as unknown; } catch { /* inspect next part */ }
  }
  return undefined;
}

function validateFinding(value: unknown): RawReview["findings"][number] {
  if (!value || typeof value !== "object") throw new Error("Reviewer finding is not an object");
  const finding = value as Record<string, unknown>;
  const severities = ["low", "medium", "high", "critical"];
  const actions = ["fix", "assign", "accept-risk", "dismiss"];
  if (!severities.includes(String(finding.severity)) || !actions.includes(String(finding.action))) {
    throw new Error("Reviewer finding has invalid severity or action");
  }
  if (typeof finding.claim !== "string" || typeof finding.evidence !== "string") {
    throw new Error("Reviewer finding requires claim and evidence");
  }
  return {
    severity: finding.severity as FindingSeverity,
    ...(typeof finding.path === "string" ? { path: finding.path } : {}),
    ...(typeof finding.line === "number" ? { line: finding.line } : {}),
    claim: finding.claim,
    evidence: finding.evidence,
    action: finding.action as FindingAction,
  };
}
