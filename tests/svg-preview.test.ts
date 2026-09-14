import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// The static desktop module is intentionally outside tsconfig's TypeScript include.
// @ts-expect-error The browser-loaded helper has no declaration file by design.
import { fileExtension } from "../desktop/src/paths.js";

const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");

/** Lifted out of the shipped bundle the same way tests/image-preview.test.ts
    lifts isImagePath -- this exercises the function that ships, not a copy of
    it. `fileExtension` is passed in from the real `paths.js` module since the
    extracted source still calls it by name. */
function loadIsSvgPath(): (path?: string) => boolean {
  const start = main.indexOf("function isSvgPath(");
  assert.notEqual(start, -1, "isSvgPath is missing from the desktop shell");
  const end = main.indexOf("\n}\n", start) + 3;
  const source = main.slice(start, end);
  return new Function("fileExtension", `${source}; return isSvgPath;`)(fileExtension);
}

test("isSvgPath matches only the svg extension", () => {
  const isSvgPath = loadIsSvgPath();
  assert.equal(isSvgPath("icon.svg"), true);
  // Case-insensitivity matches every other extension check in this file.
  assert.equal(isSvgPath("ICON.SVG"), true);
});

test("isSvgPath leaves every other extension -- including raster images -- unmatched", () => {
  const isSvgPath = loadIsSvgPath();
  assert.equal(isSvgPath("diagram.png"), false);
  assert.equal(isSvgPath("notes.md"), false);
  assert.equal(isSvgPath("report.pdf"), false);
  assert.equal(isSvgPath("archive.zip"), false);
  assert.equal(isSvgPath("no-extension"), false);
  assert.equal(isSvgPath(), false);
});
