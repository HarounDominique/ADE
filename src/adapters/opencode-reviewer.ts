import type { ReviewInput, ReviewOutput, ReviewerPort } from "../ports/reviewer.js";
import type { AgentRuntimePort } from "../ports/agent-runtime.js";
import { buildReviewPrompt, parseReviewPayload, reviewSchema, toFindings } from "./review-contract.js";

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
    const parsed = parseReviewPayload(response);
    return {
      reviewer: "opencode-reviewer",
      sessionId: session.id,
      summary: parsed.summary,
      findings: toFindings(input.changeSet.id, parsed),
    };
  }
}
