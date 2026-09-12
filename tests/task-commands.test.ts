import test from "node:test";
import assert from "node:assert/strict";
import { registerProject, refreshProjectRepositoryState } from "../src/application/tasks/project-commands.js";
import { advanceTask, createTask, getTask } from "../src/application/tasks/task-commands.js";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("task commands create, advance and rehydrate a Task", () => {
  const store = new AdeStore();
  createTask(store, { id: "task-command", intent: "Inspect", actor: "human", acceptanceCriteria: ["The inspection is recorded"] });
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

test("registerProject accepts a local folder without Git", async () => {
  const store = new AdeStore();
  const root = await mkdtemp(join(tmpdir(), "ade-project-no-git-"));
  await mkdir(join(root, "src"));
  const git = { inspect: async () => { throw new Error("not a Git repository"); } };

  const project = await registerProject(store, git, { id: "plain-project", name: "Plain", repositoryPath: root });

  assert.equal(project.repositoryPath, await realpath(root));
  assert.equal(store.getProject(project.id)?.versionControl, "none");
  await assert.rejects(() => registerProject(store, git, { id: "duplicate-plain", name: "Duplicate", repositoryPath: root }), /folder/);
  await rm(root, { recursive: true, force: true });
  store.close();
});

test("refreshProjectRepositoryState updates a stored Project once Git is initialized", async () => {
  // A Project registered before `git init` has run is persisted with
  // versionControl: "none". Initializing Git only touches the filesystem --
  // nothing re-reads that stored row -- so every later project.snapshot read
  // kept answering "none" and the topbar dropdown offered to initialize Git
  // again even after it already had been.
  const store = new AdeStore();
  const root = await mkdtemp(join(tmpdir(), "ade-project-refresh-"));
  const uninitializedGit = { inspect: async () => { throw new Error("not a Git repository"); } };
  const project = await registerProject(store, uninitializedGit, { id: "refresh-project", name: "Refresh", repositoryPath: root });
  assert.equal(store.getProject(project.id)?.versionControl, "none");

  const initializedGit = { inspect: async () => ({ path: root, gitRoot: root, branch: "main", versionControl: "git" as const }) };
  await refreshProjectRepositoryState(store, initializedGit, root);

  const refreshed = store.getProject(project.id);
  assert.equal(refreshed?.versionControl, "git");
  assert.equal(refreshed?.branch, "main");
  await rm(root, { recursive: true, force: true });
  store.close();
});

test("refreshProjectRepositoryState is a no-op for a path with no registered Project", async () => {
  const store = new AdeStore();
  const git = { inspect: async () => ({ path: "/nowhere", gitRoot: "/nowhere", branch: "main", versionControl: "git" as const }) };
  await assert.doesNotReject(() => refreshProjectRepositoryState(store, git, "/nowhere"));
  store.close();
});
