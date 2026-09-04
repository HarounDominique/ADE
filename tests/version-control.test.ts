import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectPendingGitChanges, listGitCommits, readGitCommitDiff, readPendingGitDiff } from "../src/application/git/version-control.js";

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
