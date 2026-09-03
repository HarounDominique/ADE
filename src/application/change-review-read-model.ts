import { AdeStore } from "../persistence/sqlite-store.js";
import type { Gate } from "../domain/gate.js";
import { loadGatePolicy } from "./change-review/gate-policy.js";

export function getChangeReview(store: AdeStore, taskId: string) {
  const task = store.rehydrateTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const changeSets = store.listChangeSets(taskId);
  const reviews = store.listReviews(taskId);
  const review = reviews[0];
  const reviewPassed = review?.status === "pass";
  const policy = loadGatePolicy(task.repositoryPath);
  const evidence = store.listRuntimeEvidence(taskId, policy.evidence.maxItems);
  const definitions: Record<string, Gate> = {
    build: { id: "build", required: true, status: changeSets.length > 0 ? "passed" : "pending", evidenceIds: changeSets[0] ? [changeSets[0].id] : [] },
    tests: { id: "tests", required: true, status: evidence.some((item) => item.type === "verification") ? "passed" : "pending", evidenceIds: evidence.filter((item) => item.type === "verification").map((item) => item.id) },
    "agent-review": { id: "agent-review", required: true, status: reviewPassed ? "passed" : "pending", evidenceIds: review ? [review.id] : [] },
    "human-approval": { id: "human-approval", required: true, status: store.getApproval(taskId) ? "passed" : "pending", evidenceIds: store.getApproval(taskId) ? [taskId] : [] },
  };
  const gates: Gate[] = policy.requiredGates.map((id) => definitions[id] ?? { id, required: true, status: "pending", evidenceIds: [] as string[] });
  store.saveGates(taskId, gates);
  return {
    taskId,
    taskStatus: task.currentStatus,
    changeSet: changeSets[0] ?? null,
    review: review ? { ...review, findings: JSON.parse(review.findings) } : null,
    gates,
  };
}
