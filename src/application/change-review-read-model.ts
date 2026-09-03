import { AdeStore } from "../persistence/sqlite-store.js";
import type { Gate } from "../domain/gate.js";

export function getChangeReview(store: AdeStore, taskId: string) {
  const task = store.rehydrateTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const changeSets = store.listChangeSets(taskId);
  const reviews = store.listReviews(taskId);
  const review = reviews[0];
  const reviewPassed = review?.status === "pass";
  const gates: Gate[] = [
      { id: "build", required: true, status: changeSets.length > 0 ? "passed" : "pending", evidenceIds: changeSets[0] ? [changeSets[0].id] : [] },
      { id: "tests", required: true, status: store.listRuntimeEvidence(taskId).some((item) => item.type === "verification") ? "passed" : "pending", evidenceIds: store.listRuntimeEvidence(taskId).filter((item) => item.type === "verification").map((item) => item.id) },
      { id: "agent-review", required: true, status: reviewPassed ? "passed" : "pending", evidenceIds: review ? [review.id] : [] },
      { id: "human-approval", required: true, status: store.getApproval(taskId) ? "passed" : "pending", evidenceIds: store.getApproval(taskId) ? [taskId] : [] },
  ];
  store.saveGates(taskId, gates);
  return {
    taskId,
    taskStatus: task.currentStatus,
    changeSet: changeSets[0] ?? null,
    review: review ? { ...review, findings: JSON.parse(review.findings) } : null,
    gates,
  };
}
