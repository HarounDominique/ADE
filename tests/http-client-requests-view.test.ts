import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Static contract tests for the Requests view (SPEC-http-client.md, Phase 4b), same
    raw-text-against-real-markup technique as tests/desktop-ui-contract.test.ts: this module has
    no jsdom render, so what is asserted here is that the right classes/attributes/functions
    exist and are wired to each other, not that a click actually repaints a browser DOM. */

const html = readFileSync(new URL("../desktop/src/index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../desktop/src/styles.css", import.meta.url), "utf8");
const desktopSidecar = readFileSync(new URL("../src/desktop-sidecar.ts", import.meta.url), "utf8");

test("Requests is the sixth nav entry, between Agents and Version control, with the two-opposing-arrows icon", () => {
  const order = [...html.matchAll(/<button class="nav-item[^"]*" data-view="([a-z]+)"/g)].map((match) => match[1]);
  const agentsIndex = order.indexOf("agents");
  const changesIndex = order.indexOf("changes");
  const requestsIndex = order.indexOf("requests");
  assert.ok(requestsIndex > agentsIndex && requestsIndex < changesIndex, "Requests sits between Agents and Version control");
  assert.match(html, /data-view="requests"[^>]*>\s*<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h12M12 4l4 4-4 4"\/><path d="M20 16H8M12 12l-4 4 4 4"\/><\/svg><span>Requests<\/span>/);
});

test("the Requests view container exists with data-panel=\"requests\" and a rail + main split", () => {
  assert.match(html, /<section class="view requests-view" data-panel="requests">/);
  assert.match(html, /<aside class="requests-rail" id="requests-rail"/);
  assert.match(html, /<ul class="workspace-tree requests-tree" id="requests-tree"/);
  assert.match(html, /<section class="requests-main" id="requests-main"/);
});

test("the rail offers a New request action, next to Refresh, like Explorer's own New File affordance", () => {
  assert.match(html, /data-action="new-http-request"[^>]*aria-label="New request"/);
  assert.match(html, /data-action="refresh-http-collection-tree"/);
});

test("the rail collapse control reuses History/Changes' own history-pane-toggle/history-pane-restore mechanism, not a new one", () => {
  assert.match(html, /<button class="history-pane-toggle" id="requests-rail-toggle" type="button" data-requests-pane-toggle/);
  assert.match(html, /<button class="history-pane-restore" id="requests-rail-restore" type="button" data-requests-pane-toggle/);
  assert.match(main, /data-requests-pane-toggle/);
  assert.match(styles, /\.requests-layout\.requests-rail-collapsed/);
});

test("empty collection tree shows an explicit create action, not a blank pane", () => {
  assert.match(main, /No HTTP collections yet in \.ade\/http\/.*data-http-tree-action="new-request"/);
});

test("the method appears as plain monospace text with no semantic color class (Signal Scarcity Rule)", () => {
  assert.match(main, /<span class="requests-tree-method">\$\{escapeHTML\(node\.method\)\}<\/span>/);
  const rule = styles.match(/\.requests-tree-method\s*\{[^}]*\}/)?.[0] ?? "";
  assert.ok(rule.length > 0, "requests-tree-method has a style rule");
  assert.doesNotMatch(rule, /--green|--amber|--red/);
});

test("a response status code IS colored with the shell's real-state tokens (green/amber/red)", () => {
  assert.match(styles, /\.requests-status-green\s*\{[^}]*var\(--green\)/);
  assert.match(styles, /\.requests-status-amber\s*\{[^}]*var\(--amber\)/);
  assert.match(styles, /\.requests-status-red\s*\{[^}]*var\(--red\)/);
  assert.match(main, /function httpStatusTone/);
});

test("the environment selector is a .picker in main's header, not the topbar", () => {
  assert.match(html, /<div class="picker requests-environment-picker">[\s\S]*?<button class="picker-button" id="http-environment-button" type="button" data-picker-kind="http-environment"/);
  assert.match(main, /toggleHttpEnvironmentPicker/);
  assert.match(main, /dataset\.pickerKind === 'http-environment'/);
});

test("environments populate the picker by flattening the fetched collection tree, and are also selectable from the tree itself", () => {
  assert.match(main, /function flattenHttpEnvironments/);
  assert.match(main, /data-http-environment-id/);
  assert.match(main, /function chooseHttpEnvironment/);
});

test("request tabs (Params/Headers/Body/Auth/Assertions) reuse .version-control-tab markup and aria wiring", () => {
  for (const [id, tab, panel, label] of [
    ["requests-tab-params", "params", "requests-panel-params", "Params"],
    ["requests-tab-headers", "headers", "requests-panel-headers", "Headers"],
    ["requests-tab-body", "body", "requests-panel-body", "Body"],
    ["requests-tab-auth", "auth", "requests-panel-auth", "Auth"],
    ["requests-tab-assertions", "assertions", "requests-panel-assertions", "Assertions"],
  ] as const) {
    const re = new RegExp(`class="version-control-tab[^"]*" id="${id}" type="button" role="tab" aria-selected="(?:true|false)" aria-controls="${panel}" data-requests-tab="${tab}"`);
    assert.match(html, re, `${label} tab is wired`);
    assert.match(html, new RegExp(`id="${panel}" data-requests-panel="${tab}" role="tabpanel" aria-labelledby="${id}"`));
  }
  assert.match(main, /function renderHttpRequestTabs/);
  assert.match(main, /data-requests-tab\]/);
});

test("response tabs (Body/Headers/Timing) reuse .version-control-tab markup and aria wiring", () => {
  for (const [id, tab, panel] of [
    ["requests-response-tab-body", "body", "requests-response-panel-body"],
    ["requests-response-tab-headers", "headers", "requests-response-panel-headers"],
    ["requests-response-tab-timing", "timing", "requests-response-panel-timing"],
  ] as const) {
    const re = new RegExp(`class="version-control-tab[^"]*" id="${id}" type="button" role="tab" aria-selected="(?:true|false)" aria-controls="${panel}" data-requests-response-tab="${tab}"`);
    assert.match(html, re);
  }
  assert.match(main, /function renderHttpResponseTabs/);
});

test("both Requests tab groups get their own keydown roving-tab-stop handler, addressed by id rather than the ambiguous .version-control-tabs selector", () => {
  assert.match(main, /getElementById\('requests-request-tabs'\)\?\.addEventListener\('keydown'/);
  assert.match(main, /getElementById\('requests-response-tabs'\)\?\.addEventListener\('keydown'/);
});

test("Send disables the button and shows a pending state, matching Agents' composer turn-in-flight pattern", () => {
  assert.match(main, /function updateHttpSendButtonState/);
  assert.match(main, /button\.disabled = httpRequestSending/);
  assert.match(main, /function sendHttpRequest/);
});

test("Save prompts for a collection-relative path on first save, via a dialog (not a browser prompt())", () => {
  assert.match(html, /<dialog class="task-dialog" id="http-save-path-dialog"/);
  assert.match(html, /<input id="http-save-path-input" type="text" required/);
  assert.match(main, /function handleSaveHttpRequest/);
  assert.doesNotMatch(main.slice(main.indexOf("function handleSaveHttpRequest"), main.indexOf("function handleSaveHttpRequest") + 600), /\bprompt\(/);
});

test("Save refreshes the collection tree after a successful write", () => {
  const marker = "contextPurpose === 'http-request-save' && response.result?.saved";
  const saveBranch = main.slice(main.indexOf(marker), main.indexOf(marker) + 400);
  assert.ok(main.includes(marker), "the success branch for http-request-save exists");
  assert.match(saveBranch, /loadHttpCollectionTree\(\)/);
});

test("all HTTP-collection RPC calls go through the same sidecar_request transport every other method uses, not a second one", () => {
  for (const method of ["http.collection.list", "http.collection.request.get", "http.collection.request.save", "http.request.execute", "http.collection.environment.get"]) {
    assert.ok(main.includes(`'${method}'`), `main.js references ${method}`);
  }
  // Every call site is either sendContextRequest(...) or nativeInvoke('sidecar_request', ...);
  // neither is a bespoke transport.
  assert.doesNotMatch(main, /new WebSocket|fetch\(['"]http/);
});

test("the request-content-fetch gap is closed: http.collection.request.get exists in the sidecar, mirroring the save method's shape", () => {
  assert.match(desktopSidecar, /request\.method === "http\.collection\.request\.get"/);
  assert.match(desktopSidecar, /readRequestFile\(join\(params\.repositoryPath, "\.ade", "http", params\.collectionPath\)\)/);
});

test("the same gap, mirrored for environments: http.collection.environment.get exists so Send can substitute {{variable}} tokens", () => {
  assert.match(desktopSidecar, /request\.method === "http\.collection\.environment\.get"/);
  assert.match(desktopSidecar, /readEnvironmentFile\(join\(params\.repositoryPath, "\.ade", "http", params\.collectionPath\)\)/);
});

test("the executor's response body is threaded through to the RPC result without joining the persisted HttpExecution/history contract", () => {
  const executor = readFileSync(new URL("../src/adapters/http-request-executor.ts", import.meta.url), "utf8");
  assert.match(executor, /responseBody\?: unknown/);
  const sqliteStore = readFileSync(new URL("../src/persistence/sqlite-store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(sqliteStore, /responseBody/);
});

test("switching the active Project clears stale Requests-view state (tree, environments, loaded request/response)", () => {
  const branch = main.slice(main.indexOf("async function switchProjectFromContext"), main.indexOf("async function switchProjectFromContext") + 3000);
  assert.match(branch, /httpCollectionTree = \[\]/);
  assert.match(branch, /httpEnvironmentContents\.clear\(\)/);
  assert.match(branch, /newHttpRequest\(\)/);
});

test("showing the Requests view (re)loads the collection tree", () => {
  assert.match(main, /if \(view === 'requests'\) loadHttpCollectionTree\(\);/);
});

test("row editors (headers/params/form-urlencoded/multipart/assertions) are a repeatable key/value/enabled row plus one Add control, not five bespoke editors", () => {
  assert.match(main, /function renderKeyValueRows/);
  assert.match(main, /function renderAssertionRows/);
  assert.match(main, /data-row-add="\$\{kind\}"/);
  assert.match(main, /data-row-remove/);
});

test("multipart rows carry isFile through but never expose a file-type toggle (out of scope per Phase 2's own deferral)", () => {
  assert.match(main, /isFile: false/);
  assert.doesNotMatch(main, /type="file"[^>]*data-row-field/);
});

test("body tab swaps sub-editor by type: textarea for json/text/xml, row editor for form-urlencoded/multipart", () => {
  assert.match(main, /function renderHttpBodyTab/);
  assert.match(main, /id="http-body-content" class="requests-body-textarea"/);
  assert.match(main, /renderKeyValueRows\(body\.fields \?\? \[\], 'body-form-urlencoded'\)/);
  assert.match(main, /renderKeyValueRows\(body\.fields \?\? \[\], 'body-multipart'\)/);
});

test("auth tab swaps its field set by type: none/basic/bearer/apikey", () => {
  assert.match(main, /function renderHttpAuthTab/);
  assert.match(main, /http-auth-username/);
  assert.match(main, /http-auth-token/);
  assert.match(main, /http-auth-placement/);
});

test("the request/response split has a real resizable grip, not a fixed 50/50 — mirrors the terminal dock's own resizer", () => {
  // Markup: a separator role between the two panels, matching the terminal-resizer's contract.
  assert.match(html, /<div class="requests-split-resizer" id="requests-split-resizer" role="separator" aria-orientation="horizontal"/);
  // CSS: the request panel's height is a custom property, not a hardcoded fraction — so JS can
  // actually resize it, and the two-row split from the creative doc's rejected-alternative fixed
  // grid never shipped as the final behavior.
  assert.match(styles, /\.requests-split\s*\{[^}]*grid-template-rows:\s*minmax\(120px,\s*var\(--requests-request-height,\s*1fr\)\)\s+7px\s+minmax\(120px,\s*1fr\)/);
  assert.doesNotMatch(styles, /\.requests-split\s*\{\s*display:\s*grid;\s*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\)/);
  // JS: pointer drag + arrow-key + Home/End resize, persisted per Project, same shape as
  // setTerminalHeight/terminalResizer's own wiring.
  assert.match(main, /function requestsSplitHeightBounds/);
  assert.match(main, /function setRequestsSplitHeight/);
  assert.match(main, /requestsSplitResizer\?\.addEventListener\('pointerdown'/);
  assert.match(main, /requestsSplitResizer\?\.addEventListener\('keydown'/);
  assert.match(main, /ade-requests-split-height:/);
  // Narrow-viewport fallback: stacks with independent scroll and hides the now-inapplicable grip,
  // per the creative doc's own responsive note — not the same behavior promoted to every width.
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.requests-split-resizer \{ display: none; \}/);
});
