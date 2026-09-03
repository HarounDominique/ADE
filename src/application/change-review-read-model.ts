import { AdeStore } from "../persistence/sqlite-store.js";

export function getChangeReview(store: AdeStore, taskId: string) {
  const task = store.rehydrateTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const changeSets = store.listChangeSets(taskId);
  const reviews = store.listReviews(taskId);
  const review = reviews[0];
  const reviewPassed = review?.status === "pass";
  return {
    taskId,
    taskStatus: task.currentStatus,
    changeSet: changeSets[0] ?? null,
    review: review ? { ...review, findings: JSON.parse(review.findings) } : null,
    gates: [
      { id: "build", required: true, status: changeSets.length > 0 ? "passed" : "pending", evidenceIds: changeSets[0] ? [changeSets[0].id] : [] },
      { id: "tests", required: true, status: "pending", evidenceIds: [] },
      { id: "agent-review", required: true, status: reviewPassed ? "passed" : "pending", evidenceIds: review ? [review.id] : [] },
      { id: "human-approval", required: true, status: "pending", evidenceIds: [] },
    ],
  };
}
