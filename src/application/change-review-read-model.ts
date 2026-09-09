import { AdeStore } from "../persistence/sqlite-store.js";
import type { Gate } from "../domain/gate.js";
import { loadGatePolicy } from "./change-review/gate-policy.js";
import { structuralGateId } from "./gates/ask-gate.js";

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
    build: verificationGate("build", evidence),
    tests: verificationGate("tests", evidence),
    "agent-review": { id: "agent-review", required: true, status: reviewPassed ? "passed" : "pending", evidenceIds: review ? [review.id] : [] },
    "documentation-review": { id: "documentation-review", required: true, status: evidence.some((item) => item.type === "documentation.reconciled") ? "passed" : "pending", evidenceIds: evidence.filter((item) => item.type === "documentation.reconciled").map((item) => item.id) },
    "human-approval": { id: "human-approval", required: true, status: store.getApproval(taskId) ? "passed" : "pending", evidenceIds: store.getApproval(taskId) ? [taskId] : [] },
    [structuralGateId]: structuralGate(evidence),
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

/** A build gate that passes because a ChangeSet exists says nothing about the
    code, and a tests gate waiting on evidence nobody writes can never pass. Both
    now read the newest run the Project declared as verification: its exit code
    decides, and a Project that never ran one leaves the gate pending rather
    than passed. */
function verificationGate(verifies: "build" | "tests", evidence: readonly { id: string; type: string }[]): Gate {
  const latest = evidence.find((item) => item.type.startsWith(`verification.${verifies}.`));
  if (!latest) return { id: verifies, required: true, status: "pending", evidenceIds: [] };
  return {
    id: verifies,
    required: true,
    status: latest.type.endsWith(".pass") ? "passed" : "failed",
    evidenceIds: [latest.id],
  };
}

/** The newest structural verdict decides: a gate that was blocked and then run
    again after the fix reports what ASK last proved, not what it once found.
    A Project that never ran the gate leaves it pending rather than passed. */
function structuralGate(evidence: readonly { id: string; type: string; summary: string }[]): Gate {
  const latest = evidence.find((item) => item.type.startsWith("structural.gate."));
  if (!latest) return { id: structuralGateId, required: true, status: "pending", evidenceIds: [] };
  if (latest.type === "structural.gate.pass") return { id: structuralGateId, required: true, status: "passed", evidenceIds: [latest.id] };
  return {
    id: structuralGateId,
    required: true,
    status: latest.type === "structural.gate.block" ? "failed" : "pending",
    evidenceIds: [latest.id],
    failureReason: latest.summary,
  };
}
