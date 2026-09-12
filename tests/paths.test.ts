import test from "node:test";
import assert from "node:assert/strict";
// The static desktop module is intentionally outside tsconfig's TypeScript include.
// @ts-expect-error The browser-loaded helper has no declaration file by design.
import { fileExtension, pathBaseName, pathDirname, pathSegments, pathsEqual } from "../desktop/src/paths.js";

test("pathSegments accepts either separator and drops empty segments", () => {
  assert.deepEqual(pathSegments("/Users/x/proj/src"), ["Users", "x", "proj", "src"]);
  assert.deepEqual(pathSegments("C:\\Users\\x\\proj\\src"), ["C:", "Users", "x", "proj", "src"]);
  assert.deepEqual(pathSegments("a//b\\\\c"), ["a", "b", "c"]);
  assert.deepEqual(pathSegments(""), []);
});

test("pathBaseName returns the last segment regardless of separator", () => {
  assert.equal(pathBaseName("/Users/x/proj/src/main.js"), "main.js");
  assert.equal(pathBaseName("C:\\Users\\x\\proj\\src\\main.js"), "main.js");
});

test("pathDirname strips the last segment regardless of separator", () => {
  assert.equal(pathDirname("/Users/x/proj/src/main.js"), "/Users/x/proj/src");
  assert.equal(pathDirname("C:\\Users\\x\\proj\\src\\main.js"), "C:\\Users\\x\\proj\\src");
});

test("fileExtension is lowercase and separator-agnostic", () => {
  assert.equal(fileExtension("/Users/x/proj/README.MD"), "md");
  assert.equal(fileExtension("C:\\Users\\x\\proj\\README.MD"), "md");
  assert.equal(fileExtension("noextension"), "noextension");
});

test("pathsEqual matches a mixed-separator path against a native one", () => {
  // The exact shape of the Explorer tree bug on Windows: main.js hand-builds
  // a candidate path with `/` while walking down from workspaceRootPath, but
  // Rust's dataset.directoryPath is native-backslash. Raw === never matched;
  // pathsEqual must, since it re-segments both sides regardless of how
  // either string was built.
  assert.equal(pathsEqual("C:\\Users\\x\\proj/src", "C:\\Users\\x\\proj\\src"), true);
  assert.equal(pathsEqual("/Users/x/proj/src", "/Users/x/proj/src"), true);
  assert.equal(pathsEqual("/Users/x/proj/src", "/Users/x/proj/other"), false);
  assert.equal(pathsEqual("/Users/x/proj/src", "/Users/x/proj/src/nested"), false);
});
