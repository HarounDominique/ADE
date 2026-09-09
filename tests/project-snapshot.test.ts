import test from "node:test";
import assert from "node:assert/strict";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { Project } from "../src/domain/project.js";
import { Task } from "../src/domain/task.js";
import { getProjectSnapshot } from "../src/application/project-snapshot.js";

test("ProjectSnapshot composes only the selected Project Tasks", () => {
  const store = new AdeStore();
  const project = Project.create({ id: "project-snapshot", name: "ADE", repositoryPath: "/tmp/ade" });
  store.saveProject(project, { path: "/tmp/ade", gitRoot: "/tmp/ade", branch: "main" });
  const selected = Task.create({ id: "task-selected", intent: "Show this Task", projectId: project.id, repositoryPath: "/tmp/ade", acceptanceCriteria: ["The Task is listed"] });
  selected.transition("READY", "Intent accepted", "human");
  selected.transition("IN_PROGRESS", "Work started", "ade");
  store.saveTask(selected);
  store.saveTask(Task.create({ id: "task-other", intent: "Hide this Task", projectId: "other-project" }));

  const snapshot = getProjectSnapshot(store, project.id);

  assert.equal(snapshot.project.id, project.id);
  assert.deepEqual(snapshot.tasks.map((task) => task.id), [selected.id]);
  assert.equal(snapshot.tasks[0]?.status, "IN_PROGRESS");
  assert.equal(snapshot.metrics.activeTasks, 1);
  assert.equal(snapshot.metrics.inReview, 0);
  assert.ok(snapshot.tasks[0]?.createdAt);
  assert.ok(snapshot.tasks[0]?.updatedAt);
  store.close();
});

test("ProjectSnapshot reports review work and missing Projects clearly", () => {
  const store = new AdeStore();
  assert.throws(() => getProjectSnapshot(store, "missing"), /Project not found/);
  const project = Project.create({ id: "project-review", name: "Review", repositoryPath: "/tmp/review" });
  store.saveProject(project, { path: "/tmp/review", gitRoot: "/tmp/review", branch: "main" });
  const task = Task.create({ id: "task-review", intent: "Review this", projectId: project.id, acceptanceCriteria: ["The review is recorded"] });
  task.transition("READY", "Intent accepted", "human");
  task.transition("IN_PROGRESS", "Work started", "ade");
  task.transition("IMPLEMENTED", "Change captured", "ade");
  task.transition("UNDER_REVIEW", "Review started", "reviewer");
  store.saveTask(task);

  assert.equal(getProjectSnapshot(store, project.id).metrics.inReview, 1);
  store.close();
});
