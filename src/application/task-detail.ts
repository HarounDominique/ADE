import { AdeStore } from "../persistence/sqlite-store.js";
import { getTaskWorkflow, isWorkflowEnabledForTask } from "./workflow/task-workflow.js";
import { proposeNextPhase } from "./workflow/advance.js";

export function getTaskDetail(store: AdeStore, taskId: string) {
  const task = store.rehydrateTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return {
    task: {
      id: task.id,
      intent: task.intent,
      projectId: task.projectId ?? null,
      repositoryPath: task.repositoryPath ?? null,
      status: task.currentStatus,
      acceptanceCriteria: task.acceptance(),
      history: task.history(),
    },
    changeSets: store.listChangeSets(taskId),
    reviews: store.listReviews(taskId),
    runtimeEvidence: store.listRuntimeEvidence(taskId),
    gates: store.listGates(taskId),
    gitOperations: store.listGitOperations(taskId),
    /** The ways back a writing turn left behind, where the work is judged. */
    checkpoints: store.listTaskCheckpoints(taskId),
    agentSessions: store.listAgentSessions(taskId),
    /** What the Task has consumed across its conversations. Undefined when no
        turn was accounted for, so the surface says unknown rather than zero. */
    usage: store.taskUsageTotals(taskId) ?? null,
    /** Where the adaptive workflow has this Task, and whether it is conducting
        at all. `enabled: false` with a null state is a real answer -- a surface
        that cannot tell "switched off" from "nothing here" shows the operator
        the same empty panel for both. */
    workflow: readTaskWorkflow(store, taskId),
  };
}

function readTaskWorkflow(store: AdeStore, taskId: string) {
  const enabled = isWorkflowEnabledForTask(store, taskId);
  const state = enabled ? getTaskWorkflow(store, taskId) : undefined;
  if (!state) return { enabled, state: null };
  return {
    enabled,
    state: {
      phase: state.currentPhase,
      mode: state.currentMode,
      cycle: state.currentCycle,
      dispatch: state.dispatchFor(state.currentPhase),
      nextProposed: proposeNextPhase(state) ?? null,
      haltReason: state.haltReason() ?? null,
      lastTransition: state.history().at(-1) ?? null,
    },
  };
}

export function getRuntimeHistory(store: AdeStore, taskId: string) {
  if (!store.rehydrateTask(taskId)) throw new Error(`Task not found: ${taskId}`);
  return store.listRuntimeEvidence(taskId);
}
