import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { firstRunnable, missingCommandError } from "../src/adapters/command-lookup.js";

test("a command is resolved to the first candidate that can actually run", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-lookup-"));
  const runnable = join(directory, "tool-runnable");
  const present = join(directory, "tool-present");
  await writeFile(runnable, "#!/bin/sh\nexit 0\n");
  await chmod(runnable, 0o755);
  // Present but not executable: it must not shadow the one that runs.
  await writeFile(present, "not a program\n");
  await chmod(present, 0o644);

  assert.equal(firstRunnable([join(directory, "missing"), present, runnable]), runnable);
  assert.equal(firstRunnable([join(directory, "missing")]), undefined);
});

test("a bare command is looked up on the PATH, which a desktop launch barely has", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-lookup-path-"));
  const tool = join(directory, "ade-fake-tool");
  await writeFile(tool, "#!/bin/sh\nexit 0\n");
  await chmod(tool, 0o755);
  const previous = process.env.PATH;
  try {
    process.env.PATH = directory;
    assert.equal(firstRunnable(["ade-fake-tool"]), tool);
    process.env.PATH = "/nonexistent-directory";
    assert.equal(firstRunnable(["ade-fake-tool"]), undefined);
  } finally { process.env.PATH = previous; }
});

test("a missing program is reported with every place ADE looked", () => {
  const error = missingCommandError(new Error("spawn /Applications/Whatever ENOENT"), "Codex", "ADE_CODEX_COMMAND", ["codex", "/opt/homebrew/bin/codex"]);
  assert.match(error.message, /Codex was not found or could not be run/);
  assert.match(error.message, /codex, \/opt\/homebrew\/bin\/codex/);
  assert.match(error.message, /set ADE_CODEX_COMMAND/);
  // Any other failure is the provider's to explain, not ADE's to rewrite.
  const other = missingCommandError(new Error("Command failed (1): boom"), "Codex", "ADE_CODEX_COMMAND", ["codex"]);
  assert.equal(other.message, "Command failed (1): boom");
});
