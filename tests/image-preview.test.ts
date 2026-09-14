import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// The static desktop module is intentionally outside tsconfig's TypeScript include.
// @ts-expect-error The browser-loaded helper has no declaration file by design.
import { fileExtension } from "../desktop/src/paths.js";

const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");

/** Lifted out of the shipped bundle the same way tests/markdown-preview.test.ts
    lifts its markdown-it rules -- this exercises the function that ships, not a
    copy of it. `fileExtension` is passed in from the real `paths.js` module
    since the extracted source still calls it by name. */
function loadIsImagePath(): (path?: string) => boolean {
  const start = main.indexOf("function isImagePath(");
  assert.notEqual(start, -1, "isImagePath is missing from the desktop shell");
  const end = main.indexOf("\n}\n", start) + 3;
  const source = main.slice(start, end);
  return new Function("fileExtension", `${source}; return isImagePath;`)(fileExtension);
}

test("isImagePath matches exactly ADR-0060's raster whitelist", () => {
  const isImagePath = loadIsImagePath();
  assert.equal(isImagePath("diagram.png"), true);
  assert.equal(isImagePath("photo.jpg"), true);
  assert.equal(isImagePath("photo.jpeg"), true);
  assert.equal(isImagePath("anim.gif"), true);
  assert.equal(isImagePath("banner.webp"), true);
  assert.equal(isImagePath("legacy.bmp"), true);
  assert.equal(isImagePath("app.ico"), true);
  // Case-insensitivity matches every other extension check in this file.
  assert.equal(isImagePath("SCREENSHOT.PNG"), true);
});

test("isImagePath leaves every other extension -- including other binaries -- unmatched", () => {
  const isImagePath = loadIsImagePath();
  assert.equal(isImagePath("notes.md"), false);
  assert.equal(isImagePath("diagram.svg"), false);
  assert.equal(isImagePath("report.pdf"), false);
  assert.equal(isImagePath("archive.zip"), false);
  assert.equal(isImagePath("no-extension"), false);
  assert.equal(isImagePath(), false);
});
