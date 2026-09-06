import type { TaskStatus } from "../domain/task.js";
import { AdeStore, type PersistedProject } from "../persistence/sqlite-store.js";

export type ProjectTaskSummary = {
  id: string;
  intent: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  repositoryPath: string | null;
};

export type ProjectSnapshot = {
  project: PersistedProject;
  tasks: ProjectTaskSummary[];
  metrics: {
    activeTasks: number;
    inReview: number;
  };
};

/**
 * Builds the read model consumed by a desktop Project Hub.
 * SQL shape and Task history stay behind this application boundary.
 */
export function getProjectSnapshot(store: AdeStore, projectId: string): ProjectSnapshot {
  const project = store.getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const tasks = store
    .listTasks()
    .filter((task) => task.projectId === projectId)
    .map((task) => {
      const events = JSON.parse(task.events) as Array<{ at: string }>;
      return {
        id: task.id,
        intent: task.intent,
        status: task.status as TaskStatus,
        createdAt: events[0]?.at ?? "",
        updatedAt: events.at(-1)?.at ?? "",
        projectId: task.projectId,
        repositoryPath: task.repositoryPath,
      };
    });

  return {
    project,
    tasks,
    metrics: {
      activeTasks: tasks.filter((task) => !["COMPLETED", "ABORTED"].includes(task.status)).length,
      inReview: tasks.filter((task) => ["UNDER_REVIEW", "READY_FOR_HUMAN"].includes(task.status)).length,
    },
  };
}
