import test from "node:test";
import assert from "node:assert/strict";
import { AdeStore } from "../src/persistence/sqlite-store.js";
import { Project } from "../src/domain/project.js";
import { Task } from "../src/domain/task.js";
import { handleDesktopRequest } from "../src/desktop-sidecar.js";

test("desktop sidecar answers project.snapshot with a structured result", () => {
  const store = new AdeStore();
  const project = Project.create({ id: "sidecar-project", name: "ADE", repositoryPath: "/tmp/ade" });
  store.saveProject(project, { path: "/tmp/ade", gitRoot: "/tmp/ade", branch: "main" });
  store.saveTask(Task.create({ id: "sidecar-task", intent: "Inspect UI", projectId: project.id }));

  const response = handleDesktopRequest(store, { id: "request-1", method: "project.snapshot", params: { projectId: project.id } });

  assert.equal(response.id, "request-1");
  assert.equal((response.result as { project: { id: string } }).project.id, project.id);
  assert.equal(response.error, undefined);
  store.close();
});

test("desktop sidecar returns actionable protocol errors", () => {
  const store = new AdeStore();

  assert.deepEqual(handleDesktopRequest(store, { id: 1, method: "unknown" }), {
    id: 1,
    error: { code: "METHOD_NOT_FOUND", message: "Unknown method: unknown" },
  });
  assert.deepEqual(handleDesktopRequest(store, { id: 2, method: "project.snapshot" }), {
    id: 2,
    error: { code: "INVALID_PARAMS", message: "projectId is required" },
  });
  store.close();
});
