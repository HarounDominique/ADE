import type { Finding, FindingAction, FindingSeverity } from "../domain/review.js";
import type { ReviewInput } from "../ports/reviewer.js";

/** The shape a review must take, whichever provider produces it. One contract
    means a Task reviewed by Claude and one reviewed by OpenCode are comparable
    instead of being two different kinds of document. */
export const reviewSchema: Record<string, unknown> = {
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

export type RawReview = {
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

export function buildReviewPrompt(input: ReviewInput): string {
  return [
    "You are an independent code reviewer for ADE.",
    "Review only the evidence below. Do not assume or invent changes.",
    "Do not discuss the implementer's conversation; it is intentionally unavailable.",
    "Return only a JSON object with the keys \"summary\" (string) and \"findings\" (array).",
    "Each finding has severity (low|medium|high|critical), claim, evidence, action (fix|assign|accept-risk|dismiss), and optionally path and line.",
    "A change with nothing wrong returns an empty findings array; do not invent findings to fill it.",
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

/** Providers answer in three different shapes: OpenCode returns the structured
    object it was asked for, Claude returns text, and Codex returns a JSONL
    transcript with the text inside one of its events. The review is the same
    review in all three, so it is found rather than parsed three ways. */
export function parseReviewPayload(value: unknown, depth = 0): RawReview {
  const found = findReview(value, depth);
  if (!found) throw new Error("Reviewer returned no structured output");
  return {
    summary: found.summary,
    findings: found.findings.map((item) => validateFinding(item)),
  };
}

export function toFindings(changeSetId: string, raw: RawReview): readonly Finding[] {
  return raw.findings.map((finding, index) => ({
    id: `finding-${changeSetId}-${index + 1}`,
    severity: finding.severity,
    ...(finding.path ? { location: { path: finding.path, ...(finding.line ? { line: finding.line } : {}) } } : {}),
    claim: finding.claim,
    evidence: finding.evidence,
    action: finding.action,
  }));
}

type LooseReview = { summary: string; findings: unknown[] };

function findReview(value: unknown, depth: number): LooseReview | undefined {
  if (depth > 6 || value === null || value === undefined) return undefined;
  if (typeof value === "string") return findInText(value, depth);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findReview(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.summary === "string" && Array.isArray(record.findings)) {
    return { summary: record.summary, findings: record.findings };
  }
  // The places a provider wraps its answer: structured output, the text of a
  // turn, the parts of a message, or the message itself.
  for (const key of ["structured", "structured_output", "output", "text", "data", "info", "parts", "message", "item"]) {
    const found = findReview(record[key], depth + 1);
    if (found) return found;
  }
  return undefined;
}

/** Text arrives fenced, prefixed with prose, or as a JSONL transcript. Each is
    tried in turn rather than trusting the model to answer bare JSON. */
function findInText(text: string, depth: number): LooseReview | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const direct = tryParse(trimmed);
  if (direct) {
    const found = findReview(direct, depth + 1);
    if (found) return found;
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    const found = findReview(tryParse(fenced[1].trim()), depth + 1);
    if (found) return found;
  }
  if (trimmed.includes("\n")) {
    for (const line of trimmed.split(/\r?\n/)) {
      const parsed = tryParse(line.trim());
      const found = parsed ? findReview(parsed, depth + 1) : undefined;
      if (found) return found;
    }
  }
  const braced = trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
  return braced.length > 1 ? findReview(tryParse(braced), depth + 1) : undefined;
}

function tryParse(candidate: string): unknown {
  if (!candidate.startsWith("{") && !candidate.startsWith("[")) return undefined;
  try { return JSON.parse(candidate) as unknown; } catch { return undefined; }
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
