import test from "node:test";
import assert from "node:assert/strict";
import { droppedPathPlatform, formatDroppedPaths, quoteDroppedPath } from "../desktop/src/drop-paths.js";

test("POSIX dropped paths are shell-quoted without executing anything", () => {
  assert.equal(quoteDroppedPath("/tmp/my file's.pdf", "posix"), "'/tmp/my file'\\''s.pdf'");
  assert.equal(formatDroppedPaths(["/tmp/a.png", "/tmp/a.png", "/tmp/b.pdf"], "posix"), "'/tmp/a.png' '/tmp/b.pdf'");
});

test("Windows dropped paths use PowerShell single-quote escaping", () => {
  assert.equal(quoteDroppedPath("C:\\Users\\me\\O'Reilly.pdf", "windows"), "'C:\\Users\\me\\O''Reilly.pdf'");
  assert.equal(droppedPathPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "windows");
  assert.equal(droppedPathPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X)"), "posix");
});

test("empty and whitespace-only dropped paths are ignored", () => {
  assert.equal(formatDroppedPaths(["", "  ", "/tmp/readme.md"], "posix"), "'/tmp/readme.md'");
});
