import test from "node:test";
import assert from "node:assert/strict";
import { registerProject } from "../src/application/tasks/project-commands.js";
import { advanceTask, createTask, getTask } from "../src/application/tasks/task-commands.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";

test("task commands create, advance and rehydrate a Task", () => {
  const store = new AdeStore();
  createTask(store, { id: "task-command", intent: "Inspect", actor: "human" });
  const advanced = advanceTask(store, {
    id: "task-command",
    next: "READY",
    reason: "Acceptance criteria recorded",
    actor: "human",
  });

  assert.equal(advanced.currentStatus, "READY");
  assert.equal(getTask(store, "task-command").history().length, 2);
  assert.throws(() => advanceTask(store, {
    id: "task-command",
    next: "COMPLETED",
    reason: "skip",
  }), /Invalid Task transition/);
  store.close();
});

test("registerProject canonicalizes and rejects duplicate Git roots", async () => {
  const store = new AdeStore();
  const git = {
    inspect: async () => ({ path: "/repo", gitRoot: "/repo", branch: "main" }),
  };
  const project = await registerProject(store, git, { id: "project-command", name: "ADE", repositoryPath: "/repo/subdir" });

  assert.equal(project.repositoryPath, "/repo");
  assert.equal(store.getProjectByGitRoot("/repo")?.id, project.id);
  await assert.rejects(() => registerProject(store, git, { id: "project-duplicate", name: "Other", repositoryPath: "/repo" }), /already exists/);
  store.close();
});
