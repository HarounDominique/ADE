import type { ChangeSet } from "../domain/change-set.js";
import type { Finding } from "../domain/review.js";

export type ReviewInput = {
  taskId: string;
  intent: string;
  /** What the human said "done" means. A review without it is an opinion about
      code; with it, it is a judgement against a stated bar. */
  acceptanceCriteria?: readonly string[];
  changeSet: ChangeSet;
};

export type ReviewOutput = {
  reviewer: string;
  sessionId?: string;
  summary: string;
  findings: readonly Finding[];
};

/** A reviewer receives evidence and intent, never the implementer's conversation. */
export interface ReviewerPort {
  review(input: ReviewInput): Promise<ReviewOutput>;
}
