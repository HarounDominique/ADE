import test from "node:test";
import assert from "node:assert/strict";
import { ghExecutable } from "../src/adapters/gh-command.js";

test("the GitHub CLI is resolved like every other tool ADE runs", () => {
  // An application opened from the desktop inherits a short PATH, so a gh the
  // operator installed is often unreachable under the bare name. Reporting
  // "GitHub CLI unavailable" then is a lie about their machine.
  const exists = (path: string) => path === "C:\\Program Files\\GitHub CLI\\gh.exe";
  assert.equal(ghExecutable({ PATH: "" }, "win32", exists), "C:\\Program Files\\GitHub CLI\\gh.exe");

  const onScoop = (path: string) => path === "C:\\Users\\dev\\scoop\\shims\\gh.exe";
  assert.equal(ghExecutable({ PATH: "", USERPROFILE: "C:\\Users\\dev" }, "win32", onScoop), "C:\\Users\\dev\\scoop\\shims\\gh.exe");

  // The operator's own PATH is the best evidence of which build they mean.
  const onPath = (path: string) => path === "C:\\tools\\gh.exe";
  assert.equal(ghExecutable({ PATH: "C:\\tools" }, "win32", onPath), "C:\\tools\\gh.exe");

  // An explicit choice outranks everything, and is never second-guessed.
  assert.equal(ghExecutable({ ADE_GH_COMMAND: "D:\\custom\\gh.exe", PATH: "C:\\tools" }, "win32", onPath), "D:\\custom\\gh.exe");

  // Nothing found is the bare name, so the spawn's own error still names it.
  assert.equal(ghExecutable({ PATH: "" }, "win32", () => false), "gh.exe");
  assert.equal(ghExecutable({ PATH: "" }, "darwin", () => false), "gh");
  assert.equal(ghExecutable({ PATH: "" }, "darwin", (path) => path === "/opt/homebrew/bin/gh"), "/opt/homebrew/bin/gh");
});
