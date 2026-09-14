import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// The static desktop module is intentionally outside tsconfig's TypeScript include.
// @ts-expect-error The browser-loaded helper has no declaration file by design.
import { fileExtension } from "../desktop/src/paths.js";

const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");

/** Lifted out of the shipped bundle the same way tests/svg-preview.test.ts and
    tests/markdown-preview.test.ts lift their own functions -- this exercises
    the code that ships, not a reimplementation of it. Security-critical, so
    every assertion below runs against the real extracted source. */
function extractFunction(name: string): string {
  const start = main.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing from the desktop shell`);
  const end = main.indexOf("\n}\n", start) + 3;
  return main.slice(start, end);
}

function loadIsHtmlPath(): (path?: string) => boolean {
  const source = extractFunction("isHtmlPath");
  return new Function("fileExtension", `${source}; return isHtmlPath;`)(fileExtension);
}

/** The one and only builder of the sandbox value this codebase ever sets on
    the HTML preview iframe. */
function loadHtmlPreviewSandbox(): () => string {
  const source = extractFunction("htmlPreviewSandbox");
  return new Function(`${source}; return htmlPreviewSandbox;`)();
}

/** The exact text handed to the iframe's `srcdoc` -- a pure function so this
    test can prove, by calling it, that a `<script>` or an inline event
    handler in a document's content survives unstripped: the safety guarantee
    here is the sandbox attribute, not content transformation. */
function loadHtmlPreviewSrcdoc(): (source?: string) => string {
  const source = extractFunction("htmlPreviewSrcdoc");
  return new Function(`${source}; return htmlPreviewSrcdoc;`)();
}

test("isHtmlPath matches only html/htm extensions", () => {
  const isHtmlPath = loadIsHtmlPath();
  assert.equal(isHtmlPath("page.html"), true);
  assert.equal(isHtmlPath("page.htm"), true);
  // Case-insensitivity matches every other extension check in this codebase.
  assert.equal(isHtmlPath("PAGE.HTML"), true);
});

test("isHtmlPath leaves every other extension -- including markdown and svg -- unmatched", () => {
  const isHtmlPath = loadIsHtmlPath();
  assert.equal(isHtmlPath("notes.md"), false);
  assert.equal(isHtmlPath("icon.svg"), false);
  assert.equal(isHtmlPath("diagram.png"), false);
  assert.equal(isHtmlPath("no-extension"), false);
  assert.equal(isHtmlPath(), false);
});

test("the HTML preview iframe's sandbox attribute never grants allow-scripts -- an empty sandbox value is the maximally restrictive form, not a no-op", () => {
  const htmlPreviewSandbox = loadHtmlPreviewSandbox();
  const value = htmlPreviewSandbox();
  assert.equal(typeof value, "string");
  assert.doesNotMatch(value, /allow-scripts/);
  // Supplying the `sandbox` attribute at all opts an iframe INTO every
  // restriction the platform has (script execution, same-origin access, top
  // navigation, popups, form submission, modals, pointer lock...); each
  // space-separated token in its *value* opts back OUT of exactly one. An
  // empty value opts back out of nothing -- everything stays blocked,
  // including the script execution this whole feature exists to prevent.
  assert.equal(value, "");
});

test("renderHtmlPreview sets the sandbox attribute from htmlPreviewSandbox() in the same step it fills srcdoc, and is the only place in the shell that ever assigns an iframe's srcdoc", () => {
  const source = extractFunction("renderHtmlPreview");
  assert.match(source, /setAttribute\('sandbox', htmlPreviewSandbox\(\)\)/);
  assert.match(source, /\.srcdoc = htmlPreviewSrcdoc\(source\)/);
  // Ordering matters defensively: the restrictive attribute lands on the
  // frame before any content that could exploit its absence does.
  const sandboxIndex = source.indexOf("setAttribute('sandbox'");
  const srcdocIndex = source.indexOf(".srcdoc = htmlPreviewSrcdoc(source)");
  assert.ok(sandboxIndex !== -1 && srcdocIndex !== -1 && sandboxIndex < srcdocIndex);
  // No other code path in the whole shell constructs an iframe's srcdoc --
  // this function is the only mechanism that can ever fill one in, so a
  // second, unguarded construction path can never be added silently.
  const srcdocAssignments = main.match(/\.srcdoc\s*=/g) ?? [];
  assert.equal(srcdocAssignments.length, 1);
  // Nothing sanitizes or escapes `source` before it reaches srcdoc here --
  // that would only be needed if the sandbox attribute were doing less than
  // all the work, which the assertion above confirms it isn't.
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /DOMPurify/);
});

test("a document in the tree is untrusted input: the srcdoc builder passes an embedded <script> and an inline event handler through unstripped, because the sandbox attribute -- not content transformation -- is what keeps them from executing", () => {
  const htmlPreviewSrcdoc = loadHtmlPreviewSrcdoc();
  // Same payloads tests/markdown-preview.test.ts uses for Markdown. Markdown's
  // mechanism is escaping (`html: false`) so these tags never reach the DOM as
  // tags. HTML preview's mechanism is different -- the sandboxed iframe blocks
  // execution *inside the frame*, so stripping here would be redundant with,
  // not a substitute for, the sandbox attribute asserted above.
  const payload = "<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n";
  assert.equal(htmlPreviewSrcdoc(payload), payload);
});

test("documentIsRenderableHtml gates the preview the same way documentIsRenderableSvg gates SVG", () => {
  const source = extractFunction("documentIsRenderableHtml");
  assert.match(source, /record\.state === 'ready'/);
  assert.match(source, /record\.kind === 'text'/);
  assert.match(source, /isHtmlPath\(record\.path\)/);
});
