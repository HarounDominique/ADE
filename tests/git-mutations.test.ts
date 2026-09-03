import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { createBranch, createCommit, pushBranch } from "../src/application/git/git-mutations.js";
const execFile = promisify(execFileCallback);

test("git mutations require confirmation and preserve attribution", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-git-mut-"));
  await execFile("git", ["init", "-q", root]);
  await assert.rejects(() => createBranch({ directory: root, name: "feature/test", actor: "human", reason: "test", confirmed: false }), /confirmation/);
  const branch = await createBranch({ directory: root, name: "feature/test", actor: "human", reason: "test", confirmed: true });
  assert.equal(branch.name, "feature/test");
  await writeFile(join(root, "note.txt"), "tracked");
  const commit = await createCommit({ directory: root, message: "test: record note", actor: "human", reason: "test", confirmed: true });
  assert.match(commit.output, /\[feature\/test/);
});

test("direct push also requires explicit confirmation", async () => {
  await assert.rejects(pushBranch({ directory: "/tmp", actor: "human", reason: "publish", confirmed: false }), /explicit confirmation/);
});
