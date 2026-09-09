import { Task } from "../domain/task.js";
import { createReview, type Review } from "../domain/review.js";
import type { ChangeSet } from "../domain/change-set.js";
import type { ReviewerPort } from "../ports/reviewer.js";
import { AdeStore } from "../persistence/sqlite-store.js";

export async function reviewChangeSet(
  reviewer: ReviewerPort,
  input: { task: Task; changeSet: ChangeSet; store?: AdeStore; actor?: string; reason?: string },
): Promise<Review> {
  if (input.task.currentStatus !== "IMPLEMENTED") {
    throw new Error(`Task must be IMPLEMENTED before review, got ${input.task.currentStatus}`);
  }
  input.task.transition("UNDER_REVIEW", input.reason ?? "Independent review started", input.actor ?? "ade");
  input.store?.saveTask(input.task);
  const output = await reviewer.review({
    taskId: input.task.id,
    intent: input.task.intent,
    ...(input.task.acceptance().length ? { acceptanceCriteria: input.task.acceptance() } : {}),
    changeSet: input.changeSet,
  });
  const review = createReview({
    id: `review-${input.changeSet.id}`,
    taskId: input.task.id,
    changeSet: input.changeSet,
    reviewer: output.reviewer,
    ...(output.sessionId ? { sessionId: output.sessionId } : {}),
    summary: output.summary,
    findings: output.findings,
  });
  input.task.transition(
    review.status === "pass" ? "READY_FOR_HUMAN" : "CHANGES_REQUESTED",
    review.status === "pass" ? "Reviewer passed the ChangeSet" : "Reviewer requested changes",
    output.reviewer,
  );
  input.store?.saveTask(input.task);
  input.store?.saveReview(review);
  return review;
}
