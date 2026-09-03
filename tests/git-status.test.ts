import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { getGitStatus } from "../src/application/git/git-status.js";

const execFile = promisify(execFileCallback);

test("git status read model links repository and untracked changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-git-status-"));
  await execFile("git", ["init", "-q", directory]);
  await writeFile(join(directory, "new.txt"), "new");
  const status = await getGitStatus(directory);
  assert.equal(status.repository.gitRoot, await realpath(directory));
  assert.match(status.changes.status, /new\.txt/);
  assert.deepEqual(status.changes.untracked, ["new.txt"]);
});
