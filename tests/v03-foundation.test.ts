import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadServiceDefinitions } from "../src/application/local-runtime/service-config.js";
import { inspectGitWorkspace } from "../src/application/git/workspace-status.js";

test("service configuration loads without secret-like environment values", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-services-"));
  const file = join(root, "services.json");
  await writeFile(file, JSON.stringify({ services: [{ id: "web", command: "node", cwd: root }] }));
  assert.equal((await loadServiceDefinitions(file))[0]?.id, "web");
});

test("git workspace inspection returns branches and worktrees", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-git-workspace-"));
  const { execFile } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => execFile("git", ["init", "-q", root], (error) => error ? reject(error) : resolve()));
  const result = await inspectGitWorkspace(root);
  const canonicalRoot = await realpath(root);
  assert.ok(Array.isArray(result.branches));
  assert.ok(result.worktrees.some((path) => path === canonicalRoot));
});
