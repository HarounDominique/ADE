import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectPendingGitChanges, listGitCommits, listUnpushedCommits, readGitCommitDiff, readPendingGitDiff } from "../src/application/git/version-control.js";

const execFile = promisify(execFileCallback);

async function git(directory: string, ...args: string[]) {
  return execFile("git", args, { cwd: directory });
}

test("version control read model lists commits, changed files and diffs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-version-control-"));
  await git(directory, "init", "-q");
  await git(directory, "config", "user.email", "ade@example.test");
  await git(directory, "config", "user.name", "ADE Test");
  await writeFile(join(directory, "README.md"), "first\n");
  await git(directory, "add", "README.md");
  await git(directory, "commit", "-qm", "docs: initial");
  await writeFile(join(directory, "README.md"), "second\n");
  await mkdir(join(directory, "src"));
  await writeFile(join(directory, "src", "main.ts"), "export {};\n");
  await git(directory, "add", "README.md", "src/main.ts");
  await git(directory, "commit", "-qm", "feat: add source");

  const commits = await listGitCommits(directory);
  assert.equal(commits.length, 2);
  const latest = commits[0];
  assert.ok(latest);
  assert.equal(latest.subject, "feat: add source");
  assert.deepEqual(latest.files.map((file) => file.path).sort(), ["README.md", "src/main.ts"]);
  const diff = await readGitCommitDiff(directory, latest.hash, "README.md");
  assert.match(diff.diff, /second/);
});

test("version control read model flags commits the remote has not seen", async () => {
  const remote = await mkdtemp(join(tmpdir(), "ade-version-control-remote-"));
  await git(remote, "init", "-q", "--bare");
  const directory = await mkdtemp(join(tmpdir(), "ade-version-control-unpushed-"));
  await git(directory, "init", "-q");
  await git(directory, "config", "user.email", "ade@example.test");
  await git(directory, "config", "user.name", "ADE Test");
  await writeFile(join(directory, "README.md"), "first\n");
  await git(directory, "add", "README.md");
  await git(directory, "commit", "-qm", "docs: pushed");
  await git(directory, "remote", "add", "origin", remote);
  await git(directory, "push", "-q", "-u", "origin", "HEAD");
  await writeFile(join(directory, "README.md"), "second\n");
  await git(directory, "commit", "-qam", "docs: local only");

  const commits = await listGitCommits(directory);
  assert.equal(commits.length, 2);
  assert.equal(commits[0]?.subject, "docs: local only");
  assert.equal(commits[0]?.unpushed, true);
  assert.equal(commits[1]?.unpushed, false);
  assert.deepEqual([...await listUnpushedCommits(directory)], [commits[0]!.hash]);
});

test("version control read model reports nothing unpushed without a remote", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-version-control-remoteless-"));
  await git(directory, "init", "-q");
  await git(directory, "config", "user.email", "ade@example.test");
  await git(directory, "config", "user.name", "ADE Test");
  await writeFile(join(directory, "README.md"), "first\n");
  await git(directory, "add", "README.md");
  await git(directory, "commit", "-qm", "docs: local repository");
  assert.equal((await listGitCommits(directory))[0]?.unpushed, false);
});

test("version control read model exposes tracked, staged and untracked pending files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-version-control-pending-"));
  await git(directory, "init", "-q");
  await git(directory, "config", "user.email", "ade@example.test");
  await git(directory, "config", "user.name", "ADE Test");
  await writeFile(join(directory, "tracked.txt"), "first\n");
  await git(directory, "add", "tracked.txt");
  await git(directory, "commit", "-qm", "chore: seed");
  await writeFile(join(directory, "tracked.txt"), "changed\n");
  await writeFile(join(directory, "new.txt"), "new\n");
  const pending = await inspectPendingGitChanges(directory);
  assert.deepEqual(pending.files.map((file) => file.path).sort(), ["new.txt", "tracked.txt"]);
  assert.match(pending.diff, /changed/);
  assert.match((await readPendingGitDiff(directory, "tracked.txt")).diff, /changed/);
  assert.match((await readPendingGitDiff(directory, "new.txt")).diff, /new/);
});

test("version control read model handles a repository with no commits yet", async () => {
  // `git diff HEAD` fails outright on a freshly `git init`-ed repository --
  // there is no HEAD to diff against until the first commit exists. Every
  // file present is effectively new, same as the untracked case above.
  const directory = await mkdtemp(join(tmpdir(), "ade-version-control-no-head-"));
  await git(directory, "init", "-q");
  await writeFile(join(directory, "staged.txt"), "staged\n");
  await git(directory, "add", "staged.txt");
  await writeFile(join(directory, "untracked.txt"), "untracked\n");
  const pending = await inspectPendingGitChanges(directory);
  assert.deepEqual(pending.files.map((file) => file.path).sort(), ["staged.txt", "untracked.txt"]);
  assert.match(pending.diff, /staged/);
  assert.match((await readPendingGitDiff(directory, "staged.txt")).diff, /staged/);
  // untracked.txt is never in the index, so -- same as the untracked case
  // above -- it never appears in the batch `git diff` output; only a
  // per-file diff surfaces it, via the existing --no-index fallback.
  assert.match((await readPendingGitDiff(directory, "untracked.txt")).diff, /untracked/);
});
