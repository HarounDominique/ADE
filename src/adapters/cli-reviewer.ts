import type { AgentRuntimePort } from "../ports/agent-runtime.js";
import type { ReviewInput, ReviewOutput, ReviewerPort } from "../ports/reviewer.js";
import { buildReviewPrompt, parseReviewPayload, reviewSchema, toFindings } from "./review-contract.js";

/** The reviewer a CLI provider can be. Until now the only reviewer ADE had was
    OpenCode's, so the gate that decides whether work passes was reachable by a
    single runtime: an operator working with Claude Code or Codex could produce
    changes the product could never review. Independence is not the provider
    being different -- it is the reviewer seeing evidence and intent, never the
    implementer's conversation. */
export class CliReviewer implements ReviewerPort {
  constructor(private readonly runtime: AgentRuntimePort, private readonly name: string) {}

  async review(input: ReviewInput): Promise<ReviewOutput> {
    const session = await this.runtime.createSession({
      directory: input.changeSet.directory,
      title: `review-${input.changeSet.id}`,
    });
    /** A review reads; it never writes. No permission is granted for this turn,
        so a reviewer cannot "fix" what it was asked to judge. */
    const response = await this.runtime.promptAndWait(session, {
      text: buildReviewPrompt(input),
      format: { type: "json_schema", schema: reviewSchema, retryCount: 2 },
    });
    const parsed = parseReviewPayload(response);
    return {
      reviewer: this.name,
      /** A CLI names its session only when the turn ends, so the placeholder id
          is not recorded as if it were resumable. */
      ...(session.id.includes("-pending-") ? {} : { sessionId: session.id }),
      summary: parsed.summary,
      findings: toFindings(input.changeSet.id, parsed),
    };
  }
}
