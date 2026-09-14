import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// The static desktop module is intentionally outside tsconfig's TypeScript include.
// @ts-expect-error The browser-loaded helper has no declaration file by design.
import { fileExtension } from "../desktop/src/paths.js";

const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");

/** Lifted out of the shipped bundle the same way tests/svg-preview.test.ts and
    tests/html-preview.test.ts lift their own functions -- this exercises the
    code that ships, not a reimplementation of it. */
function findFunction(name: string): string | null {
  // `async` is part of the declaration, so a lifted async function has to keep
  // it -- these tests call the lifted render functions, they do not only
  // pattern-match their text.
  const asyncStart = main.indexOf(`async function ${name}(`);
  const start = asyncStart === -1 ? main.indexOf(`function ${name}(`) : asyncStart;
  if (start === -1) return null;
  const end = main.indexOf("\n}\n", start) + 3;
  return main.slice(start, end);
}

function extractFunction(name: string): string {
  const source = findFunction(name);
  assert.notEqual(source, null, `${name} is missing from the desktop shell`);
  return source as string;
}

function loadIsMermaidPath(): (path?: string) => boolean {
  const source = extractFunction("isMermaidPath");
  return new Function("fileExtension", `${source}; return isMermaidPath;`)(fileExtension);
}

/** The markdown-it core rule that intercepts ```mermaid fences, lifted the
    same way tests/markdown-preview.test.ts lifts markdownHeadingAnchors and
    markdownTaskLists -- constructed against a real MarkdownIt instance so
    this exercises the actual render pipeline, not a copy of it. */
function loadMermaidRule(): (state: unknown) => void {
  const source = extractFunction("markdownMermaidDiagrams");
  return new Function(`${source}; return markdownMermaidDiagrams;`)();
}

type MermaidEnv = { mermaidDiagrams?: Array<{ id: string; source: string }> };

async function renderWithMermaidRule(sourceText: string): Promise<{ html: string; env: MermaidEnv }> {
  const entry = new URL("../desktop/node_modules/markdown-it/index.mjs", import.meta.url).href;
  const { default: MarkdownIt } = await import(entry);
  const markdownMermaidDiagrams = loadMermaidRule();
  const renderer = new MarkdownIt({ html: false, linkify: true });
  renderer.core.ruler.push("ade_mermaid_diagrams", markdownMermaidDiagrams);
  const env: MermaidEnv = {};
  const html = renderer.render(sourceText, env);
  return { html, env };
}

test("isMermaidPath matches only the mmd extension", () => {
  const isMermaidPath = loadIsMermaidPath();
  assert.equal(isMermaidPath("diagram.mmd"), true);
  // Case-insensitivity matches every other extension check in this codebase.
  assert.equal(isMermaidPath("DIAGRAM.MMD"), true);
});

test("isMermaidPath leaves every other extension -- including markdown, svg and html -- unmatched", () => {
  const isMermaidPath = loadIsMermaidPath();
  assert.equal(isMermaidPath("notes.md"), false);
  assert.equal(isMermaidPath("icon.svg"), false);
  assert.equal(isMermaidPath("page.html"), false);
  assert.equal(isMermaidPath("diagram.png"), false);
  assert.equal(isMermaidPath("no-extension"), false);
  assert.equal(isMermaidPath(), false);
});

test("documentIsRenderableMermaid gates the preview the same way documentIsRenderableSvg/documentIsRenderableHtml do", () => {
  const source = extractFunction("documentIsRenderableMermaid");
  assert.match(source, /record\.state === 'ready'/);
  assert.match(source, /record\.kind === 'text'/);
  assert.match(source, /isMermaidPath\(record\.path\)/);
});

test("a ```mermaid fence is intercepted before the default fenced-code renderer sees it, and the diagram source queued is exactly that fence's own text -- never surrounding document content", async () => {
  const { html, env } = await renderWithMermaidRule("Antes\n\n```mermaid\ngraph TD;\n  A-->B;\n```\n\nDespues\n");
  // Not the default <pre><code class="language-mermaid"> treatment.
  assert.doesNotMatch(html, /language-mermaid/);
  assert.doesNotMatch(html, /<pre>/);
  // A placeholder with a stable, unique locator id takes its place.
  assert.match(html, /<div class="mermaid-diagram" data-mermaid-id="[^"]+"><\/div>/);
  assert.equal(env.mermaidDiagrams?.length, 1);
  assert.equal(env.mermaidDiagrams?.[0]?.source, "graph TD;\n  A-->B;\n");
  assert.doesNotMatch(env.mermaidDiagrams?.[0]?.source ?? "", /Antes|Despues/);
});

test("a fence with any other language tag renders exactly as before -- the rule only ever intercepts mermaid", async () => {
  const { html, env } = await renderWithMermaidRule("```js\nconst x = 1;\n```\n");
  assert.match(html, /<pre><code class="language-js">/);
  assert.equal(env.mermaidDiagrams, undefined);
});

test("multiple mermaid fences in one document each get their own placeholder and their own queued source", async () => {
  const { html, env } = await renderWithMermaidRule('```mermaid\ngraph TD;\nA-->B;\n```\n\n```mermaid\npie\n  "a" : 1\n```\n');
  const ids = [...html.matchAll(/data-mermaid-id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  assert.equal(env.mermaidDiagrams?.length, 2);
});

test("loadMarkdownRenderer pushes ade_mermaid_diagrams alongside the existing heading-anchor and task-list rules", () => {
  const source = extractFunction("loadMarkdownRenderer");
  assert.match(source, /ruler\.push\('ade_mermaid_diagrams', markdownMermaidDiagrams\)/);
});

test("renderMarkdownPreview resolves queued mermaid diagrams after markdown-it's own (synchronous) render pass, instead of dropping the promise mermaid.render(...) returns", () => {
  const source = extractFunction("renderMarkdownPreview");
  assert.match(source, /await loadMarkdownRenderer\(\)/);
  assert.match(source, /renderer\.render\(source, env\)/);
  assert.match(source, /await renderMermaidDiagramsInto\(preview, env\.mermaidDiagrams/);
  // Ordering: the diagrams resolve after the innerHTML carrying their
  // placeholders is actually on the page, not before.
  const innerHtmlIndex = source.indexOf("preview.innerHTML = renderer.render(source, env)");
  const resolveIndex = source.indexOf("await renderMermaidDiagramsInto(preview, env.mermaidDiagrams");
  assert.ok(innerHtmlIndex !== -1 && resolveIndex !== -1 && innerHtmlIndex < resolveIndex);
});

test("renderMermaidDiagramsInto awaits mermaid.render(...) for each queued diagram instead of leaving its promise unresolved", () => {
  const source = extractFunction("renderMermaidDiagramsInto");
  assert.match(source, /await renderMermaidSvg\(diagram\.source\)/);
});

test("Mermaid's securityLevel is set explicitly rather than left to whatever the installed version happens to default to", () => {
  const source = extractFunction("loadMermaid");
  assert.match(source, /securityLevel: 'strict'/);
  assert.match(source, /startOnLoad: false/);
});

test("a standalone .mmd file feeds mermaid.render(...) its full source text directly -- no markdown-it fence wrapper involved", () => {
  const source = extractFunction("renderMermaidPreview");
  assert.doesNotMatch(source, /markdown-it|loadMarkdownRenderer|renderer\.render|markdownMermaidDiagrams/);
  assert.match(source, /await renderMermaidSvg\(source\)/);
});

test("the Mermaid preview toggle follows the same Preview/Source pattern as Markdown, SVG and HTML, namespaced to its own preference", () => {
  assert.match(main, /const mermaidPreviewStorageKey = 'ade-mermaid-preview'/);
  assert.match(main, /function syncMermaidPreview/);
  assert.match(main, /function toggleMermaidPreview/);
  assert.match(main, /function mermaidPreviewVisible/);
  assert.match(main, /localStorage\.setItem\(mermaidPreviewStorageKey/);
  assert.match(main, /item\.dataset\.action === 'toggle-mermaid-preview'/);
});

/* ----------------------------------------------------------------------------
   Staleness guard: `mermaid.render(...)` is a real async computation (DSL parse
   plus SVG layout), unlike the synchronous SVG/HTML preview paths, and tab
   clicks dispatch `void activateDocumentTab(...)` fire-and-forget -- so two
   preview renders genuinely overlap. These tests construct that overlap rather
   than reasoning about it statically: they lift the shipped render functions,
   run them against a purpose-built stub of the handful of DOM members those
   functions actually touch (getElementById / querySelector / innerHTML /
   textContent / scrollTop -- this repo has no jsdom), and hold each
   `mermaid.render(...)` open so the resolution order can be chosen.
   -------------------------------------------------------------------------- */

type Deferred = { promise: Promise<string>; resolve: (svg: string) => void; reject: (error: Error) => void };

function deferred(): Deferred {
  let resolve!: (svg: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((settle, fail) => { resolve = settle; reject = fail; });
  // Nothing awaits this promise until the render function does, and a rejection
  // handed over before that point would otherwise be reported as unhandled.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

/** Lets every already-queued microtask and timer callback run, so a render
    that is "in flight" has actually reached its `await`. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The generation counter and its two helpers ship as top-level declarations,
    so they are lifted by pattern rather than by findFunction. When they are
    absent the lifted render functions run exactly as they did before -- which
    is what makes the assertions below a real RED rather than a ReferenceError. */
function extractGenerationGuard(): string {
  const declaration = main.match(/^let previewRenderGeneration = \d+;$/m)?.[0] ?? "";
  return [declaration, findFunction("beginPreviewRenderGeneration"), findFunction("previewRenderIsCurrent")]
    .filter(Boolean)
    .join("\n");
}

/** Writing one of innerHTML/textContent replaces whatever the other put there,
    the way a real element's subtree is replaced -- so an error message written
    over a diagram is visible to these assertions as the loss it is. */
function createElementStub() {
  let html = "";
  let text = "";
  return {
    get innerHTML() { return html; },
    set innerHTML(value: string) { html = value; text = ""; },
    get textContent() { return text; },
    set textContent(value: string) { text = value; html = ""; },
  };
}

/** The Markdown preview element, reduced to what renderMarkdownPreview and
    renderMermaidDiagramsInto ask of it: a settable innerHTML, the placeholder
    lookup, and scrollTop. Writing innerHTML replaces the placeholder set, the
    way a real innerHTML write replaces the subtree -- that replacement is
    exactly what the cross-document collision depends on. */
function createPreviewStub() {
  let html = "";
  const placeholders = new Map<string, { innerHTML: string; textContent: string }>();
  return {
    scrollTop: 0,
    get innerHTML() { return html; },
    set innerHTML(value: string) {
      html = value;
      placeholders.clear();
      for (const match of value.matchAll(/data-mermaid-id="([^"]+)"/g)) {
        const id = match[1];
        if (id) placeholders.set(id, createElementStub());
      }
    },
    querySelector(selector: string) {
      const id = selector.match(/data-mermaid-id="([^"]+)"\]/)?.[1];
      return (id ? placeholders.get(id) : null) ?? null;
    },
    onScreenPlaceholderIds() { return [...placeholders.keys()]; },
    placeholder(id: string) { return placeholders.get(id) ?? null; },
  };
}

function createMermaidRenderStub() {
  const pending = new Map<string, Deferred>();
  const renderMermaidSvg = (source: string) => {
    const entry = deferred();
    pending.set(source, entry);
    return entry.promise;
  };
  const entryFor = (source: string) => {
    const entry = pending.get(source);
    assert.ok(entry, `no mermaid.render(...) is in flight for ${JSON.stringify(source)}`);
    return entry;
  };
  const resolveFor = (source: string, svg: string) => { entryFor(source).resolve(svg); };
  const rejectFor = (source: string, error: Error) => { entryFor(source).reject(error); };
  const isPending = (source: string) => pending.has(source);
  return { renderMermaidSvg, resolveFor, rejectFor, isPending };
}

type DocumentRecord = { state: string; kind: string; path: string; buffer: string };

/** The standalone `.mmd` path: renderMermaidPreview, lifted whole. */
function loadStandaloneMermaidHarness(records: Record<string, DocumentRecord>) {
  const target = createElementStub();
  const mermaid = createMermaidRenderStub();
  const deps = {
    document: { getElementById: (id: string) => (id === "document-mermaid" ? target : null) },
    documentTabById: (id: string) => records[id] ?? null,
    isMermaidPath: loadIsMermaidPath(),
    // Empty editor text falls through to the record's own buffer, the branch a
    // freshly activated tab takes.
    codeEditorValue: () => "",
    renderMermaidSvg: mermaid.renderMermaidSvg,
    console: { warn: () => {} },
  };
  const body = [
    "const { document, documentTabById, isMermaidPath, codeEditorValue, renderMermaidSvg, console } = deps;",
    "let activeDocumentId = null;",
    extractGenerationGuard(),
    extractFunction("documentIsRenderableMermaid"),
    extractFunction("renderMermaidPreview"),
    "return { renderMermaidPreview, activate: (id) => { activeDocumentId = id; } };",
  ].join("\n");
  const api = new Function("deps", body)(deps) as {
    renderMermaidPreview: () => Promise<void>;
    activate: (id: string) => void;
  };
  return { ...api, target, resolveFor: mermaid.resolveFor, rejectFor: mermaid.rejectFor };
}

/** The Markdown-fence path: renderMarkdownPreview plus the real
    renderMermaidDiagramsInto and the real markdown-it rule, so the placeholder
    ids under test are the ids that actually ship. */
async function loadMarkdownFenceHarness(records: Record<string, DocumentRecord>) {
  const entry = new URL("../desktop/node_modules/markdown-it/index.mjs", import.meta.url).href;
  const { default: MarkdownIt } = await import(entry);
  const renderer = new MarkdownIt({ html: false, linkify: true });
  renderer.core.ruler.push("ade_mermaid_diagrams", loadMermaidRule());
  const preview = createPreviewStub();
  const mermaid = createMermaidRenderStub();
  const deps = {
    document: { getElementById: (id: string) => (id === "document-preview" ? preview : null) },
    documentTabById: (id: string) => records[id] ?? null,
    isMarkdownPath: new Function("fileExtension", `${extractFunction("isMarkdownPath")}; return isMarkdownPath;`)(fileExtension),
    codeEditorValue: () => "",
    loadMarkdownRenderer: () => Promise.resolve(renderer),
    renderMermaidSvg: mermaid.renderMermaidSvg,
    CSS: { escape: (value: string) => value },
    console: { warn: () => {} },
  };
  const body = [
    "const { document, documentTabById, isMarkdownPath, codeEditorValue, loadMarkdownRenderer, renderMermaidSvg, CSS, console } = deps;",
    "let activeDocumentId = null;",
    extractGenerationGuard(),
    extractFunction("documentIsRenderableMarkdown"),
    extractFunction("renderMermaidDiagramsInto"),
    extractFunction("renderMarkdownPreview"),
    "return { renderMarkdownPreview, activate: (id) => { activeDocumentId = id; } };",
  ].join("\n");
  const api = new Function("deps", body)(deps) as {
    renderMarkdownPreview: () => Promise<void>;
    activate: (id: string) => void;
  };
  return { ...api, preview, resolveFor: mermaid.resolveFor, isPending: mermaid.isPending };
}

test("a standalone .mmd render that resolves after the user moved to another document does not overwrite the diagram now on screen", async () => {
  const records = {
    A: { state: "ready", kind: "text", path: "a.mmd", buffer: "graph TD;\n  A-->B;" },
    B: { state: "ready", kind: "text", path: "b.mmd", buffer: 'pie\n  "x" : 1' },
  };
  const harness = loadStandaloneMermaidHarness(records);

  // Document A's diagram starts rendering and stays in flight.
  harness.activate("A");
  const renderOfA = harness.renderMermaidPreview();
  await settle();

  // The user clicks document B's tab before A resolves; B renders and lands.
  harness.activate("B");
  const renderOfB = harness.renderMermaidPreview();
  await settle();
  harness.resolveFor(records.B.buffer, "<svg id='B'></svg>");
  await renderOfB;
  assert.equal(harness.target.innerHTML, "<svg id='B'></svg>");

  // Only now does A's much slower render resolve.
  harness.resolveFor(records.A.buffer, "<svg id='A'></svg>");
  await renderOfA;
  assert.equal(
    harness.target.innerHTML,
    "<svg id='B'></svg>",
    "the stale render for document A overwrote the diagram belonging to the document that is actually on screen",
  );
});

test("a standalone .mmd render that fails after the user moved on reports nothing into the document now on screen", async () => {
  const records = {
    A: { state: "ready", kind: "text", path: "a.mmd", buffer: "not a diagram" },
    B: { state: "ready", kind: "text", path: "b.mmd", buffer: 'pie\n  "x" : 1' },
  };
  const harness = loadStandaloneMermaidHarness(records);
  harness.activate("A");
  const renderOfA = harness.renderMermaidPreview();
  await settle();
  harness.activate("B");
  const renderOfB = harness.renderMermaidPreview();
  await settle();
  harness.resolveFor(records.B.buffer, "<svg id='B'></svg>");
  await renderOfB;

  // A's render rejects late. The failure belongs to a document nobody is
  // looking at, so it must neither surface nor blank out B's diagram.
  harness.rejectFor(records.A.buffer, new Error("Parse error on line 1"));
  await renderOfA;
  assert.equal(
    harness.target.innerHTML,
    "<svg id='B'></svg>",
    "a stale parse failure replaced the diagram belonging to the document that is actually on screen",
  );
  assert.equal(harness.target.textContent, "");
});

test("a stale markdown-fence diagram cannot land in the placeholder of the document now on screen, even at the same fence position", async () => {
  // renderMermaidDiagramsInto resolves the queued diagrams one at a time, and
  // looks each placeholder up between awaits -- so the second lookup of a stale
  // pass happens after the document on screen has already been replaced. Both
  // documents carry a fence at the same position, which is where a locator id
  // derived from position alone collides across documents.
  const records = {
    A: { state: "ready", kind: "text", path: "a.md", buffer: "```mermaid\ngraph TD;\n  A1-->A1b;\n```\n\n```mermaid\ngraph TD;\n  A2-->A2b;\n```\n" },
    B: { state: "ready", kind: "text", path: "b.md", buffer: '```mermaid\npie\n  "b1" : 1\n```\n\n```mermaid\npie\n  "b2" : 2\n```\n' },
  };
  const firstOfA = "graph TD;\n  A1-->A1b;\n";
  const secondOfA = "graph TD;\n  A2-->A2b;\n";
  const firstOfB = 'pie\n  "b1" : 1\n';
  const secondOfB = 'pie\n  "b2" : 2\n';
  const harness = await loadMarkdownFenceHarness(records);

  // Document A renders; its first diagram is in flight.
  harness.activate("A");
  const renderOfA = harness.renderMarkdownPreview();
  await settle();

  // The user clicks document B's tab. B's markup -- and B's placeholders --
  // replace A's on screen, and B's first diagram goes in flight.
  harness.activate("B");
  const renderOfB = harness.renderMarkdownPreview();
  await settle();
  const onScreen = harness.preview.onScreenPlaceholderIds();
  assert.equal(onScreen.length, 2);
  const [onScreenFirst, onScreenSecond] = onScreen;
  assert.ok(onScreenFirst && onScreenSecond);

  // B walks on to its second diagram.
  harness.resolveFor(firstOfB, "<svg id='B1'></svg>");
  await settle();

  // Only now does A's first diagram resolve, sending A's stale pass on to look
  // up its *second* placeholder against the DOM that now belongs to B.
  harness.resolveFor(firstOfA, "<svg id='A1'></svg>");
  await settle();

  harness.resolveFor(secondOfB, "<svg id='B2'></svg>");
  await renderOfB;
  assert.equal(harness.preview.placeholder(onScreenFirst)?.innerHTML, "<svg id='B1'></svg>");
  assert.equal(harness.preview.placeholder(onScreenSecond)?.innerHTML, "<svg id='B2'></svg>");

  if (harness.isPending(secondOfA)) harness.resolveFor(secondOfA, "<svg id='A2'></svg>");
  await renderOfA;
  assert.equal(
    harness.preview.placeholder(onScreenSecond)?.innerHTML,
    "<svg id='B2'></svg>",
    "document A's stale diagram landed in document B's placeholder -- the locator id collided across render passes",
  );
  assert.equal(harness.preview.placeholder(onScreenFirst)?.innerHTML, "<svg id='B1'></svg>");
});

test("placeholder locator ids are unique across render passes, not just within one", async () => {
  // Driven through renderMarkdownPreview rather than the rule alone, because it
  // is renderMarkdownPreview that hands the rule the pass it belongs to.
  const diagramSource = "graph TD;\n  A-->B;\n";
  const records = { A: { state: "ready", kind: "text", path: "a.md", buffer: "```mermaid\ngraph TD;\n  A-->B;\n```\n" } };
  const harness = await loadMarkdownFenceHarness(records);
  harness.activate("A");

  const firstPass = harness.renderMarkdownPreview();
  await settle();
  const idsOfFirstPass = harness.preview.onScreenPlaceholderIds();
  harness.resolveFor(diagramSource, "<svg></svg>");
  await firstPass;

  const secondPass = harness.renderMarkdownPreview();
  await settle();
  const idsOfSecondPass = harness.preview.onScreenPlaceholderIds();
  harness.resolveFor(diagramSource, "<svg></svg>");
  await secondPass;

  assert.equal(idsOfFirstPass.length, 1);
  assert.equal(idsOfSecondPass.length, 1);
  assert.notDeepEqual(
    idsOfFirstPass,
    idsOfSecondPass,
    "two render passes produced the same locator id, so a stale resolution can address a live placeholder",
  );
});
