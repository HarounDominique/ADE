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
  for (const action of ["new-task", "open-terminal", "open-document", "check-runtime", "restart-sidecar", "refresh-tree", "run-skill", "install-skill", "github-status", "create-worktree", "push-branch", "refresh-knowledge"]) {
    assert.match(html, new RegExp(`data-action=\"${action}\"`));
  }
});

test("desktop shell wires critical actions to Tauri commands", () => {
  for (const command of ["sidecar_request", "sidecar_restart", "open_document", "open_file", "terminal_start", "terminal_input", "terminal_stop"]) {
    assert.match(main, new RegExp(`['\"]${command}['\"]`));
  }
  assert.match(main, /method: 'task\.run'/);
  assert.match(main, /renderChanges\(snapshot\.tasks/);
  assert.match(main, /list_directory/);
  assert.match(main, /method: 'skills\.run'/);
  assert.match(main, /method: 'skills\.install'/);
  assert.match(main, /method: 'github\.status'/);
  for (const id of ["changes-changeset", "changes-findings", "git-task-operations"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(main, /Persisted activity/);
  assert.match(main, /method: 'knowledge\.reconcile\.apply'/);
  assert.match(main, /renderProviders/);
  assert.match(main, /providerIsAvailable/);
  assert.match(html, /id="agent-provider-status"/);
  assert.match(main, /method: 'skills\.update'/);
  assert.match(main, /refreshSelectedSkill/);
  assert.match(html, /id="update-skill-button"/);
});

test("workspace tree expands directories lazily and keeps symlinks non-actionable", () => {
  assert.match(main, /renderWorkspaceEntries/);
  assert.match(main, /data-directory-path/);
  assert.match(main, /toggleWorkspaceDirectory/);
  assert.match(main, /maxDepth: 0/);
  assert.match(main, /Symlinks are not opened outside the selected Project/);
  assert.match(main, /\[data-directory-path\]\.directory/);
});
