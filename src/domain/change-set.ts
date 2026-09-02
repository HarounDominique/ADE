import type { FileDiff } from "../ports/agent-runtime.js";
import type { GitChanges } from "../adapters/git-changes.js";

export type ChangeSet = {
  id: string;
  taskId: string;
  sessionId: string;
  directory: string;
  capturedAt: string;
  runtimeDiff: readonly FileDiff[];
  git: GitChanges;
};

export function createChangeSet(input: {
  id: string;
  taskId: string;
  sessionId: string;
  directory: string;
  runtimeDiff: readonly FileDiff[];
  git: GitChanges;
}): ChangeSet {
  return { ...input, capturedAt: new Date().toISOString() };
}
