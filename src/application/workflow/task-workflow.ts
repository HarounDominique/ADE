import { GateSet } from "../../domain/gate.js";
import { WorkflowState, type WorkflowMode } from "../../domain/workflow/phase.js";
import { AdeStore } from "../../persistence/sqlite-store.js";
import { getChangeReview } from "../change-review-read-model.js";
import { isDevelopmentWorkflowEnabled } from "./activation.js";
import { applyWorkflowResult, type WorkflowResult } from "./advance.js";
import { loadGatePolicy, type GatePolicy } from "../change-review/gate-policy.js";
import { readSettings, type UserSettings } from "../settings/settings.js";

/** The workflow is off for this operator or this Project. Told apart from a
    refusal: nothing was wrong with the request, ADE simply is not conducting
    work here. */
export class WorkflowDisabledError extends Error {}

/** Only the two fields activation actually reads, so a caller can answer the
    question without assembling a whole policy. */
export type Activation = {
  user: Pick<UserSettings, "developmentWorkflow">;
  policy: Pick<GatePolicy, "developmentWorkflow">;
};

/** Both halves of the switch, read where they actually live: the operator's
    preference in ADE's own store, the Project's position in the repository the
    Task points at. A Task with no repository has no Project policy to consult,
    so the operator's preference stands alone. */
export function resolveActivation(store: AdeStore, taskId: string): Activation {
  const task = store.getTask(taskId);
  return {
    user: readSettings(store),
    policy: loadGatePolicy(task?.repositoryPath ?? undefined),
  };
}

export function isWorkflowEnabledForTask(store: AdeStore, taskId: string): boolean {
  const activation = resolveActivation(store, taskId);
  return isDevelopmentWorkflowEnabled({ user: activation.user as UserSettings, policy: activation.policy as GatePolicy });
}

export function getTaskWorkflow(store: AdeStore, taskId: string): WorkflowState | undefined {
  const snapshot = store.getWorkflowState(taskId);
  return snapshot ? WorkflowState.rehydrate(snapshot) : undefined;
}

export function startTaskWorkflow(
  store: AdeStore,
  input: { taskId: string; mode: WorkflowMode; reason: string; actor?: string; activation: Activation },
): WorkflowState {
  assertEnabled(input.activation);
  const state = WorkflowState.start({
    taskId: input.taskId,
    mode: input.mode,
    reason: input.reason,
    ...(input.actor ? { actor: input.actor } : {}),
  });
  store.saveWorkflowState(state.snapshot());
  return state;
}

/** The gates come from the Task's own evidence, never from the caller: a result
    that claims its gates are green is exactly the claim the gates exist to
    check. Nothing is persisted until the whole result has been accepted, so a
    refusal leaves the stored state as it was. */
export function advanceTaskWorkflow(
  store: AdeStore,
  input: { taskId: string; result: WorkflowResult; actor?: string; activation: Activation },
): WorkflowState {
  assertEnabled(input.activation);
  const state = getTaskWorkflow(store, input.taskId);
  if (!state) throw new Error(`Task has no workflow to advance: ${input.taskId}`);

  applyWorkflowResult(state, input.result, {
    gates: new GateSet(getChangeReview(store, input.taskId).gates),
    ...(input.actor ? { actor: input.actor } : {}),
  });

  store.saveWorkflowState(state.snapshot());
  return state;
}

function assertEnabled(activation: Activation): void {
  if (!isDevelopmentWorkflowEnabled({ user: activation.user as UserSettings, policy: activation.policy as GatePolicy })) {
    throw new WorkflowDisabledError("The adaptive development workflow is switched off for this Project or operator");
  }
}
