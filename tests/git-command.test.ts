import test from "node:test";
import assert from "node:assert/strict";
import { GitUnavailableError, gitExecutable } from "../src/adapters/git-command.js";

test("packaged Windows app finds Git for Windows outside PATH", () => {
  const installed = "D:\\Tools\\Git\\cmd\\git.exe";
  const command = gitExecutable(
    { ProgramFiles: "D:\\Tools" },
    "win32",
    (candidate) => candidate === installed,
  );
  assert.equal(command, installed);
});

test("an explicit Git path takes precedence over discovery", () => {
  assert.equal(
    gitExecutable({ ADE_GIT_COMMAND: "E:\\Portable\\git.exe" }, "win32", () => false),
    "E:\\Portable\\git.exe",
  );
});

test("Git availability failures remain identifiable to the desktop shell", () => {
  const error = new GitUnavailableError();
  assert.equal(error.code, "GIT_UNAVAILABLE");
  assert.match(error.message, /ADE_GIT_COMMAND/);
});
