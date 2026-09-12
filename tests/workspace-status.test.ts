import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectGitWorkspace } from "../src/application/git/workspace-status.js";
import { GitRepositoryMissingError } from "../src/adapters/git-command.js";

const execFile = promisify(execFileCallback);

async function git(directory: string, ...args: string[]) {
  return execFile("git", args, { cwd: directory });
}

test("workspace inspection reports the current branch, changes and remotes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-workspace-status-"));
  await git(directory, "init", "-q");
  await git(directory, "config", "user.email", "ade@example.test");
  await git(directory, "config", "user.name", "ADE Test");
  await writeFile(join(directory, "README.md"), "first\n");
  await git(directory, "add", "README.md");
  await git(directory, "commit", "-qm", "docs: initial");
  await writeFile(join(directory, "README.md"), "second\n");

  const workspace = await inspectGitWorkspace(directory);

  assert.equal(workspace.currentBranch, (await git(directory, "branch", "--show-current")).stdout.trim());
  assert.equal(workspace.changedFiles.length, 1);
  assert.deepEqual(workspace.remotes, []);
});

test("workspace inspection rejects clearly when .git was removed, instead of crashing", async () => {
  // Same class of bug as pending-changes inspection: for-each-ref, worktree
  // list, remote -v, branch --show-current and status --short all fail
  // outright on a plain directory. Verified up front instead of letting the
  // first of the five Promise.all calls surface a raw exec error.
  const directory = await mkdtemp(join(tmpdir(), "ade-workspace-status-no-repo-"));
  await assert.rejects(() => inspectGitWorkspace(directory), GitRepositoryMissingError);
});
