import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { captureGitChanges } from "../src/adapters/git-changes.js";

const execFile = promisify(execFileCallback);

test("Git capture includes untracked files missed by a regular diff", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-git-test-"));
  await execFile("git", ["init", "-q", directory]);
  await writeFile(join(directory, "new.txt"), "new content\n");

  const changes = await captureGitChanges(directory);

  assert.match(changes.status, /\?\? new\.txt/);
  assert.deepEqual(changes.untracked, ["new.txt"]);
});
