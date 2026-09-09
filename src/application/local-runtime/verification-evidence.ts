import { createRuntimeEvidence } from "../../domain/runtime-evidence.js";
import type { RunSession, RunVerification } from "../../domain/run-configuration.js";
import { AdeStore } from "../../persistence/sqlite-store.js";
import { loadGatePolicy } from "../change-review/gate-policy.js";

export type VerificationRun = {
  taskId: string;
  repositoryPath: string;
  verifies: RunVerification;
  label: string;
  output: string;
};

const OUTPUT_TAIL = 4_000;

/** The tail is what a failure is read from; the head of a long build scrolls
    away without saying why it stopped. */
export function appendVerificationOutput(run: VerificationRun, text: string): void {
  run.output = `${run.output}${text}`.slice(-OUTPUT_TAIL);
}

export function verificationEvidenceType(verifies: RunVerification, passed: boolean): string {
  return `verification.${verifies}.${passed ? "pass" : "fail"}`;
}

/** A gate may cite a run that finished, and only its own exit code decides.
    Until this existed, `tests` waited on evidence nothing wrote and `build`
    was satisfied by the existence of a ChangeSet, which is not a build. */
export function recordVerificationRun(store: AdeStore, run: VerificationRun, session: RunSession): void {
  /** A run the operator stopped proves nothing either way. Recording it as a
      failure would fail the gate for a reason the code did not cause. */
  if (session.stoppedByUser) return;
  const passed = session.state === "STOPPED" && (session.exitCode ?? 0) === 0;
  const outcome = typeof session.exitCode === "number" ? `exited ${session.exitCode}`
    : session.failure ?? `ended ${session.state.toLowerCase()}`;
  const policy = loadGatePolicy(run.repositoryPath);
  store.saveRuntimeEvidence(createRuntimeEvidence({
    id: `runtime-${run.taskId}-${session.id}-verification`,
    taskId: run.taskId,
    sessionId: session.id,
    type: verificationEvidenceType(run.verifies, passed),
    summary: `${run.label} ${outcome}`,
    ...(run.output.trim() ? { details: run.output.trim() } : {}),
    policy: policy.evidence,
  }));
  store.pruneRuntimeEvidence(run.taskId, policy.evidence.maxItems);
}

export function isTerminalRunState(session: RunSession): boolean {
  return session.state === "STOPPED" || session.state === "FAILED";
}
