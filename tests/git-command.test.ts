import test from "node:test";
import assert from "node:assert/strict";
import { GitUnavailableError, gitExecutable, isTransientGitLockError } from "../src/adapters/git-command.js";

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

test("a desktop launcher's PATH is searched when Git sits outside the standard prefixes", () => {
  const installed = "/opt/custom/bin/git";
  const command = gitExecutable(
    { PATH: "/usr/bin:/opt/custom/bin" },
    "darwin",
    (candidate) => candidate === installed,
  );
  assert.equal(command, installed);
});

test("Xcode command line tools count as an installed Git", () => {
  const installed = "/Library/Developer/CommandLineTools/usr/bin/git";
  assert.equal(gitExecutable({ PATH: "" }, "darwin", (candidate) => candidate === installed), installed);
});

test("a Windows PATH is searched with its own separator and executable name", () => {
  const installed = "C:\\Tools\\git\\bin\\git.exe";
  const command = gitExecutable(
    { Path: "C:\\Windows\\system32;C:\\Tools\\git\\bin" },
    "win32",
    (candidate) => candidate === installed,
  );
  assert.equal(command, installed);
});

test("Git stays a bare command when nothing on disk answers", () => {
  assert.equal(gitExecutable({ PATH: "/usr/bin" }, "linux", () => false), "git");
  assert.equal(gitExecutable({ Path: "C:\\Windows" }, "win32", () => false), "git.exe");
});

test("Git index access-denied failures are classified as transient", () => {
  assert.equal(isTransientGitLockError({ stderr: "fatal: .git/index: index file open failed: Permission denied" }), true);
  assert.equal(isTransientGitLockError({ message: "fatal: Unable to create '.git/index.lock': Access is denied" }), true);
});

test("non-lock Git failures are not retried", () => {
  assert.equal(isTransientGitLockError({ stderr: "fatal: not a git repository" }), false);
  assert.equal(isTransientGitLockError({ code: "ENOENT", stderr: "fatal: .git/index: Permission denied" }), false);
});
