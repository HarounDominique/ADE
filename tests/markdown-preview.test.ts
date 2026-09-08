import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");

/** The rules live in the shell bundle, which needs a DOM to load. Lifting the
    three functions out of it keeps this test on the code that ships instead of
    on a copy of it. */
function markdownRules() {
  const source = ["markdownSlug", "markdownHeadingAnchors", "markdownTaskLists"].map((name) => {
    const start = main.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} is missing from the desktop shell`);
    const end = main.indexOf("\n}\n", start) + 3;
    return main.slice(start, end);
  }).join("\n");
  return new Function(`${source}; return { markdownHeadingAnchors, markdownTaskLists };`)() as {
    markdownHeadingAnchors: unknown;
    markdownTaskLists: unknown;
  };
}

async function renderMarkdown(source: string): Promise<string> {
  const entry = new URL("../desktop/node_modules/markdown-it/index.mjs", import.meta.url).href;
  const { default: MarkdownIt } = await import(entry);
  const { markdownHeadingAnchors, markdownTaskLists } = markdownRules();
  const renderer = new MarkdownIt({ html: false, linkify: true });
  renderer.core.ruler.push("ade_heading_anchors", markdownHeadingAnchors);
  renderer.core.ruler.push("ade_task_lists", markdownTaskLists);
  return renderer.render(source, {});
}

test("a document in the tree is untrusted input, so its HTML is never executed", async () => {
  const html = await renderMarkdown("Antes\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n");
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("headings carry the ids in-document links target, including repeated ones", async () => {
  const html = await renderMarkdown("# Título Ágil\n\n## Título Ágil\n\n### Estado y evidencia\n");
  assert.match(html, /<h1 id="título-ágil">/);
  assert.match(html, /<h2 id="título-ágil-2">/);
  assert.match(html, /<h3 id="estado-y-evidencia">/);
});

test("task lists render inert checkboxes, so the file stays the state", async () => {
  const html = await renderMarkdown("- [ ] pendiente\n- [x] hecho\n- normal\n");
  assert.match(html, /<li class="markdown-task-item"><input class="markdown-task" type="checkbox" disabled> pendiente/);
  assert.match(html, /<li class="markdown-task-item"><input class="markdown-task" type="checkbox" disabled checked> hecho/);
  assert.match(html, /<li>normal<\/li>/);
});

test("tables, fenced code and links survive the round trip", async () => {
  const html = await renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n\n```js\nconst x = 1;\n```\n\n[nexus](docu/specs/SPEC-NEXUS.md)\n");
  assert.match(html, /<table>[\s\S]*<th>a<\/th>/);
  assert.match(html, /<code class="language-js">/);
  assert.match(html, /<a href="docu\/specs\/SPEC-NEXUS\.md">nexus<\/a>/);
});
