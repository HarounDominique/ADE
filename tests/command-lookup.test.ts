import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { firstRunnable, missingCommandError } from "../src/adapters/command-lookup.js";

/** Each system decides what "can be run" means, so a fixture that expresses the
    rule has to be spelled its way: a permission bit on POSIX, an extension from
    PATHEXT on Windows, which has no such bit and calls every existing file
    executable when asked. */
const windows = process.platform === "win32";

async function toolThatRuns(directory: string, name: string): Promise<string> {
  const path = join(directory, windows ? `${name}.cmd` : name);
  await writeFile(path, windows ? "@echo off\r\nexit /b 0\r\n" : "#!/bin/sh\nexit 0\n");
  if (!windows) await chmod(path, 0o755);
  return path;
}

async function toolThatDoesNot(directory: string, name: string): Promise<string> {
  const path = join(directory, windows ? `${name}.txt` : name);
  await writeFile(path, "not a program\n");
  if (!windows) await chmod(path, 0o644);
  return path;
}

test("a command is resolved to the first candidate that can actually run", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-lookup-"));
  const runnable = await toolThatRuns(directory, "tool-runnable");
  // There but not runnable: it must not shadow the one that runs.
  const present = await toolThatDoesNot(directory, "tool-present");

  assert.equal(firstRunnable([join(directory, "missing"), present, runnable]), runnable);
  assert.equal(firstRunnable([join(directory, "missing")]), undefined);
});

test("a bare command is looked up on the PATH, which a desktop launch barely has", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-lookup-path-"));
  // On Windows the command is typed without its extension and found through
  // PATHEXT, which is the same lookup the system itself performs.
  const tool = await toolThatRuns(directory, "ade-fake-tool");
  const previous = process.env.PATH;
  try {
    process.env.PATH = directory;
    assert.equal(firstRunnable(["ade-fake-tool"]), tool);
    process.env.PATH = "/nonexistent-directory";
    assert.equal(firstRunnable(["ade-fake-tool"]), undefined);
  } finally { process.env.PATH = previous; }
});

test("a missing program is reported with every place ADE looked", () => {
  const error = missingCommandError(new Error("spawn /Applications/Whatever ENOENT"), "Codex", "ADE_CODEX_COMMAND", ["codex", "/opt/homebrew/bin/codex"], { command: "/Applications/Whatever", cwd: "/definitely/not/here" });
  assert.match(error.message, /Codex could not be run/);
  assert.match(error.message, /codex, \/opt\/homebrew\/bin\/codex/);
  assert.match(error.message, /set ADE_CODEX_COMMAND/);
  // ENOENT is also what the system says when the working directory is gone, or
  // when it refuses a binary that is plainly there: the report tells them apart.
  assert.match(error.message, /Chosen binary: \/Applications\/Whatever \(missing\)/);
  assert.match(error.message, /Working directory: \/definitely\/not\/here \(missing\)/);
  assert.match(error.message, /System said: spawn \/Applications\/Whatever ENOENT/);
  // Any other failure is the provider's to explain, not ADE's to rewrite.
  const other = missingCommandError(new Error("Command failed (1): boom"), "Codex", "ADE_CODEX_COMMAND", ["codex"], {});
  assert.equal(other.message, "Command failed (1): boom");
});

test("a binary that is there but cannot be used is reported as such", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ade-lookup-perm-"));
  const tool = await toolThatDoesNot(directory, "tool");
  const error = missingCommandError(new Error("spawn ENOENT"), "Codex", "ADE_CODEX_COMMAND", [tool], { command: tool, cwd: directory });
  // The same fact, told the way each system knows it.
  assert.match(error.message, windows ? /present but not a program this system runs/ : /present but this process may not use it/);
  assert.match(error.message, /Working directory: .*\(present and permitted\)/);
});
