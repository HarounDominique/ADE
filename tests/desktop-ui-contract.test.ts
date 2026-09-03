import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../desktop/src/index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");

test("desktop shell keeps the five MVP areas and critical actions", () => {
  for (const view of ["project", "work", "knowledge", "changes", "runtime"]) {
    assert.match(html, new RegExp(`data-view=\"${view}\"`));
    assert.match(html, new RegExp(`data-panel=\"${view}\"`));
  }
  for (const action of ["new-task", "open-terminal", "open-document", "check-runtime", "restart-sidecar", "refresh-tree"]) {
    assert.match(html, new RegExp(`data-action=\"${action}\"`));
  }
});

test("desktop shell wires critical actions to Tauri commands", () => {
  for (const command of ["sidecar_request", "sidecar_restart", "open_terminal", "open_document", "open_file", "terminal_exec"]) {
    assert.match(main, new RegExp(`['\"]${command}['\"]`));
  }
  assert.match(main, /method: 'task\.run'/);
  assert.match(main, /renderChanges\(snapshot\.tasks/);
  assert.match(main, /list_directory/);
});
