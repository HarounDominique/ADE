import type { FileDiff } from "../ports/agent-runtime.js";
import type { GitChanges } from "../adapters/git-changes.js";

export type ChangeSet = {
  id: string;
  taskId: string;
  sessionId: string;
  capturedAt: string;
  runtimeDiff: readonly FileDiff[];
  git: GitChanges;
};

export function createChangeSet(input: {
  id: string;
  taskId: string;
  sessionId: string;
  runtimeDiff: readonly FileDiff[];
  git: GitChanges;
}): ChangeSet {
  return { ...input, capturedAt: new Date().toISOString() };
}
