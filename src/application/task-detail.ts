import { AdeStore } from "../persistence/sqlite-store.js";

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
      history: task.history(),
    },
    changeSets: store.listChangeSets(taskId),
    reviews: store.listReviews(taskId),
    runtimeEvidence: store.listRuntimeEvidence(taskId),
    gates: store.listGates(taskId),
    gitOperations: store.listGitOperations(taskId),
    agentSessions: store.listAgentSessions(taskId),
  };
}

export function getRuntimeHistory(store: AdeStore, taskId: string) {
  if (!store.rehydrateTask(taskId)) throw new Error(`Task not found: ${taskId}`);
  return store.listRuntimeEvidence(taskId);
}
