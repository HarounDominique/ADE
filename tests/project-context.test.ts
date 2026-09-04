import test from "node:test";
import assert from "node:assert/strict";
// The static desktop module is intentionally outside tsconfig's TypeScript include.
// @ts-expect-error The browser-loaded helper has no declaration file by design.
import { mergeActiveProject } from "../desktop/src/project-context.js";

test("snapshot refreshes preserve the selected project identity", () => {
  const ade = { id: "ade", name: "ADE", repositoryPath: "/workspace/ADE" };
  const selected = { id: "docs", name: "Docs", repositoryPath: "/workspace/Docs", branch: "main" };

  const active = mergeActiveProject(ade, selected);
  const refreshed = mergeActiveProject(active, { branch: "feature/editor" });

  assert.equal(refreshed.id, "docs");
  assert.equal(refreshed.name, "Docs");
  assert.equal(refreshed.repositoryPath, "/workspace/Docs");
  assert.equal(refreshed.branch, "feature/editor");
});
