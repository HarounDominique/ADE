import { GateSet, type GateStatus } from "../../domain/gate.js";
import { canTransition, routeFor, type PhaseDispatch, type WorkflowMode, type WorkflowPhase, type WorkflowState } from "../../domain/workflow/phase.js";

/** What a transition skill hands back: what it did, what it thinks comes next,
    the evidence it produced and what it observed about the gates. It is a
    proposal -- the application validates it before any of it becomes state. */
export type WorkflowResult = {
  phase: WorkflowPhase;
  next?: WorkflowPhase;
  reason: string;
  evidenceIds?: readonly string[];
  gateUpdates?: readonly { id: string; status: GateStatus }[];
  escalateMode?: WorkflowMode;
};

/** What the workflow refused to do, told apart from what it failed to do. A
    refused transition is the contract working, not an error to retry. */
export class WorkflowRefusedError extends Error {}

/** The gate no skill may close. Approval is the human's, and a workflow that
    could grant it would make every other gate decorative. */
const HUMAN_ONLY_GATES = ["human-approval"] as const;

/** The phase the mode's route would go to next, when the matrix also allows it.
    A route that has run out, or that would propose an illegal move, says
    nothing rather than inventing a phase for the caller to trust. */
export function proposeNextPhase(state: WorkflowState): WorkflowPhase | undefined {
  const route = routeFor(state.currentMode);
  const index = route.indexOf(state.currentPhase);
  if (index === -1) return undefined;
  const next = route[index + 1];
  if (!next) return undefined;
  return canTransition(state.currentPhase, next) ? next : undefined;
}

/** Whether this phase may be dispatched, and at which attempt. Separate from
    applying a result on purpose: the third attempt refuses to *start* again,
    while a result from a run that already happened is still worth recording. */
export function assertDispatchable(state: WorkflowState, phase: WorkflowPhase): PhaseDispatch {
  const dispatch = state.dispatchFor(phase);
  if (dispatch.halt) {
    throw new WorkflowRefusedError(state.haltReason() ?? `Phase ${phase} has exhausted its attempts. A human decides what happens next.`);
  }
  return dispatch;
}

export function applyWorkflowResult(
  state: WorkflowState,
  result: WorkflowResult,
  context: { gates: GateSet; actor?: string },
): { gateUpdates: readonly { id: string; status: GateStatus }[] } {
  if (!result.reason.trim()) throw new WorkflowRefusedError("A workflow result requires a reason");

  /** A result that names a phase the work already left was computed against a
      state that no longer exists. Applying it would move the Task on evidence
      gathered somewhere else. */
  if (result.phase !== state.currentPhase) {
    throw new WorkflowRefusedError(`Stale workflow result: it reports ${result.phase} but the Task is in ${state.currentPhase}`);
  }

  const updates = result.gateUpdates ?? [];
  for (const update of updates) {
    if (HUMAN_ONLY_GATES.includes(update.id as (typeof HUMAN_ONLY_GATES)[number])) {
      throw new WorkflowRefusedError(`A workflow result cannot set ${update.id}: approval is the human's decision`);
    }
    /** Reporting a gate passed or failed is evidence. Waiving one is a decision
        to accept the risk it was protecting against, which belongs to a person. */
    if (update.status === "waived") {
      throw new WorkflowRefusedError(`A workflow result cannot waive ${update.id}: waiving a gate is a human decision`);
    }
  }

  if (result.escalateMode) {
    state.escalateMode(result.escalateMode, result.reason, context.actor ?? "system");
  }

  if (result.next) {
    /** SHIP is the one phase the gates actually guard. Everything before it can
        loop; this is where the contract has to hold. */
    if (result.next === "SHIP") {
      const failures = context.gates.requiredFailures();
      if (failures.length > 0) {
        throw new WorkflowRefusedError(`Required gates are not passed: ${failures.map((gate) => gate.id).join(", ")}`);
      }
    }
    const options = { actor: context.actor ?? "system", evidenceIds: result.evidenceIds ?? [] };
    if (isReentry(state, result.next)) {
      state.reenter(result.next, result.reason, options);
    } else {
      state.advance(result.next, result.reason, options);
    }
  }

  return { gateUpdates: updates };
}

/** Going back to a phase the route already passed. Recorded as re-entry so the
    history says the work returned for a reason, rather than showing a phase
    that happened to run twice. */
function isReentry(state: WorkflowState, next: WorkflowPhase): boolean {
  const route = routeFor(state.currentMode);
  const from = route.indexOf(state.currentPhase);
  const to = route.indexOf(next);
  if (from === -1 || to === -1) return state.attemptsFor(next) > 0;
  return to < from;
}
