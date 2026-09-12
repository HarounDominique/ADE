import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { createBranch, createCommit, createWorktree, initializeRepository, pushBranch, switchBranch } from "../src/application/git/git-mutations.js";
const execFile = promisify(execFileCallback);

/** A fixture repository owns its identity. Inheriting the machine's global
    git config makes the suite pass only where a developer already committed. */
async function initRepository(root: string) {
  await execFile("git", ["init", "-q", root]);
  await execFile("git", ["config", "user.email", "ade@example.test"], { cwd: root });
  await execFile("git", ["config", "user.name", "ADE Test"], { cwd: root });
}

test("git mutations require confirmation and preserve attribution", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-git-mut-"));
  await initRepository(root);
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

test("branch switching is confirmed and does not force-discard local work", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-git-switch-"));
  await initRepository(root);
  await writeFile(join(root, "note.txt"), "initial");
  await createCommit({ directory: root, message: "test: initial branch", actor: "human", reason: "fixture", confirmed: true });
  await createBranch({ directory: root, name: "feature/selector", actor: "human", reason: "fixture", confirmed: true });
  await execFile("git", ["switch", "-q", "-"] , { cwd: root });
  await assert.rejects(() => switchBranch({ directory: root, branch: "feature/selector", actor: "human", reason: "select branch", confirmed: false }), /confirmation/);
  const result = await switchBranch({ directory: root, branch: "feature/selector", actor: "human", reason: "select branch", confirmed: true });
  assert.equal(result.operation, "branch.switch");
  assert.equal((await execFile("git", ["branch", "--show-current"], { cwd: root })).stdout.trim(), "feature/selector");
});

test("a commit reports the revision it created so a Task can reference it", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-git-commit-"));
  await initRepository(root);
  await writeFile(join(root, "note.txt"), "tracked");
  const commit = await createCommit({ directory: root, message: "test: record note", actor: "human", reason: "test", confirmed: true });
  const head = (await execFile("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
  assert.equal(commit.commit, head);
});

test("push resolves the current branch and refuses a detached HEAD", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-git-push-"));
  const remote = await mkdtemp(join(tmpdir(), "ade-git-remote-"));
  await execFile("git", ["init", "-q", "--bare", remote]);
  await initRepository(root);
  await execFile("git", ["remote", "add", "origin", remote], { cwd: root });
  await writeFile(join(root, "note.txt"), "tracked");
  await createCommit({ directory: root, message: "test: record note", actor: "human", reason: "test", confirmed: true });
  const current = (await execFile("git", ["branch", "--show-current"], { cwd: root })).stdout.trim();

  const pushed = await pushBranch({ directory: root, actor: "human", reason: "publish", confirmed: true });
  assert.equal(pushed.branch, current);

  await execFile("git", ["checkout", "-q", "--detach"], { cwd: root });
  await assert.rejects(pushBranch({ directory: root, actor: "human", reason: "publish", confirmed: true }), /without a current branch/);
});

test("worktree creation requires confirmation and returns its branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-git-worktree-root-"));
  const target = join(tmpdir(), `ade-git-worktree-target-${Date.now()}`);
  await initRepository(root);
  await writeFile(join(root, "note.txt"), "initial");
  await createCommit({ directory: root, message: "test: initial worktree", actor: "human", reason: "fixture", confirmed: true });
  await assert.rejects(createWorktree({ directory: root, path: target, branch: "feature/worktree", actor: "human", reason: "parallel work", confirmed: false }), /confirmation/);

  const worktree = await createWorktree({ directory: root, path: target, branch: "feature/worktree", actor: "human", reason: "parallel work", confirmed: true });

  assert.equal(worktree.branch, "feature/worktree");
  await execFile("git", ["worktree", "remove", "--force", target], { cwd: root });
  await rm(target, { recursive: true, force: true });
});

test("initializing a repository requires confirmation and leaves a real working tree", async () => {
  const root = await mkdtemp(join(tmpdir(), "ade-git-init-op-"));
  await assert.rejects(() => initializeRepository({ directory: root, actor: "human", reason: "test", confirmed: false }), /confirmation/);

  const result = await initializeRepository({ directory: root, actor: "human", reason: "test", confirmed: true });

  assert.equal(result.operation, "init");
  const check = await execFile("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
  assert.equal(check.stdout.trim(), "true");
  // A bare `git init` inherits the operator's own global init.defaultBranch,
  // which is `main` on at least one real machine -- Assay's own auto-init
  // pins `master` explicitly, regardless of that config.
  const branch = await execFile("git", ["branch", "--show-current"], { cwd: root });
  assert.equal(branch.stdout.trim(), "master");
  await rm(root, { recursive: true, force: true });
});
