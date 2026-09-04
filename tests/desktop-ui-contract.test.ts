import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../desktop/src/index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../desktop/src/styles.css", import.meta.url), "utf8");

test("desktop shell keeps the project workbench areas and critical actions", () => {
  for (const view of ["projects", "editor", "work", "knowledge", "changes", "runtime"]) {
    assert.match(html, new RegExp(`data-view=\"${view}\"`));
    assert.match(html, new RegExp(`data-panel=\"${view}\"`));
  }
  for (const action of ["new-task", "open-document", "check-runtime", "restart-sidecar", "refresh-tree", "run-skill", "install-skill", "github-status", "create-worktree", "push-branch", "refresh-knowledge"]) {
    assert.match(html, new RegExp(`data-action=\"${action}\"`));
  }
});

test("desktop shell exposes the Git context bar and Explorer search affordance", () => {
  assert.match(html, /id="repository-context-button"/);
  assert.match(html, /id="branch-context-button"/);
  assert.match(html, /id="repository-context-menu"/);
  assert.match(html, /id="branch-context-menu"/);
  assert.match(html, /class="explorer-search-trigger"/);
  assert.match(html, /data-action="focus-search"/);
  assert.doesNotMatch(html, /Quick Open/);
  assert.match(main, /project.list/);
  assert.match(main, /git.branch.switch/);
  assert.match(main, /switchProjectFromContext/);
  assert.match(main, /switchBranchFromContext/);
  assert.match(main, /select_project_directory/);
  assert.match(main, /project\.register/);
  assert.match(main, /mergeActiveProject\(activeProject, response\.result\.project\)/);
  assert.match(main, /repositoryName\.textContent = activeProject\.name/);
  assert.match(main, /breadcrumbRoot\.textContent = activeProject\.name/);
  assert.match(main, /showView\('editor'\)/);
  assert.match(html, /data-action="add-project"/);
  assert.match(html, /id="projects-list"/);
  assert.match(html, /id="selected-project-title"/);
  assert.match(main, /data-remove-project-id/);
  assert.doesNotMatch(html, /PROJECT HUB/);
  assert.doesNotMatch(html, /Task workbench/);
  assert.match(main, /project\.remove/);
  assert.match(html, /data-panel="editor"/);
  assert.match(html, /id="editor-empty-state"/);
  assert.match(styles, /\.git-context-bar/);
  assert.match(styles, /\.git-context-menu/);
});

test("desktop shell wires critical actions to Tauri commands", () => {
  for (const command of ["sidecar_request", "sidecar_restart", "open_document", "open_file", "read_file", "write_file", "terminal_start", "terminal_input", "terminal_stop", "terminal_stop_all"]) {
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
  assert.match(main, /method: 'knowledge\.reconcile\.changed'/);
  assert.match(main, /renderProviders/);
  assert.match(main, /providerIsAvailable/);
  assert.match(html, /id="agent-provider-status"/);
  assert.match(main, /method: 'skills\.update'/);
  assert.match(main, /refreshSelectedSkill/);
  assert.match(html, /id="update-skill-button"/);
  assert.match(main, /method: 'service\.list'/);
  assert.match(main, /renderServices/);
  assert.match(html, /id="runtime-service-list"/);
  assert.match(html, /id="document-viewer"/);
  assert.match(html, /data-action="open-file-external"/);
  assert.match(html, /data-action="save-file"/);
  assert.match(html, /data-action="discard-file"/);
  assert.match(html, /id="document-content"/);
  assert.match(main, /nativeInvoke\('read_file'/);
  assert.match(main, /nativeInvoke\('write_file'/);
  assert.match(main, /openFileInADE/);
  assert.match(main, /saveActiveDocument/);
  assert.match(main, /discardDocumentChanges/);
  assert.match(main, /documentDirty/);
  assert.match(main, /item\.dataset\.action === 'open-file-external'/);
});

test("workspace tree expands directories lazily and keeps symlinks non-actionable", () => {
  assert.match(main, /renderWorkspaceEntries/);
  assert.match(main, /data-directory-path/);
  assert.match(main, /toggleWorkspaceDirectory/);
  assert.match(main, /maxDepth: 0/);
  assert.match(main, /Symlinks are not opened outside the selected Project/);
  assert.match(main, /\[data-directory-path\]\.directory/);
});

test("desktop navigation is labeled and terminal dock supports persisted resizing", () => {
  assert.doesNotMatch(html, /class="activity-rail"/);
  assert.match(html, /class="primary-nav"/);
  assert.match(html, />Projects<\/span>/);
  assert.match(html, />Editor<\/span>/);
  assert.match(html, /id="terminal-resizer" role="separator"/);
  assert.match(main, /ade-terminal-height/);
  assert.match(main, /ArrowUp/);
  assert.match(main, /setPointerCapture/);
  assert.match(html, /class="terminal-surface"/);
  assert.match(html, /class="terminal-input-line"/);
  assert.match(html, /id="terminal-suggestions"[^>]*role="listbox"/);
  assert.match(html, /placeholder="Type a command…"/);
  assert.doesNotMatch(html, /ADE terminal ready/);
  assert.doesNotMatch(main, /appendTerminalCommand/);
  assert.match(main, /terminalTabs/);
  assert.match(main, /TerminalEmulator/);
  assert.match(main, /tab\.emulator\.write/);
  assert.match(main, /sessionId: tab\.id/);
  assert.match(main, /payload\?\.session_id/);
  assert.match(main, /terminal-new-tab/);
  assert.match(main, /data-terminal-tab-id/);
  assert.match(main, /data-terminal-close-id/);
  assert.match(main, /ArrowDown/);
  assert.match(main, /completeTerminalInput/);
  assert.match(main, /event\.key === 'Tab'/);
  assert.match(main, /data-terminal-suggestion/);
  assert.match(main, /terminal_input', \{ sessionId: tab\.id, input: `\$\{command\}\\r` \}/);
});

test("navigation sidebar supports persisted pointer and keyboard resizing", () => {
  assert.match(html, /id="sidebar-resizer" role="separator"/);
  assert.match(html, /aria-orientation="vertical"/);
  assert.match(main, /ade-sidebar-width/);
  assert.match(main, /setSidebarWidth/);
  assert.match(main, /sidebarResizeState/);
  assert.match(main, /sidebarResizer\.setPointerCapture/);
  assert.match(main, /ArrowRight/);
  assert.match(main, /sidebarWidthBounds/);
  assert.match(main, /max: Math\.min\(720/);
  assert.match(html, /aria-valuemax="720"/);
  assert.match(styles, /\.sidebar-resizer \{ position: absolute/);
  assert.match(styles, /grid-template-columns: var\(--sidebar-width, 246px\)/);
  assert.match(styles, /\.terminal-dock \{ left: var\(--sidebar-width, 246px\)/);
});

test("explorer keeps the active file path as a compact branch and has a full-tree mode", () => {
  assert.match(html, /data-action="toggle-explorer"/);
  assert.match(html, /aria-label="Expand workspace tree"/);
  assert.match(main, /renderCompactWorkspacePath/);
  assert.match(main, /selectedFilePath/);
  assert.match(main, /explorerExpanded/);
  assert.match(main, /expandExplorerFrom/);
  assert.match(main, /revealSelectedFileBranch/);
  assert.match(main, /await revealSelectedFileBranch\(\)/);
  assert.match(main, /collapseExplorer/);
});

test("workspace search returns files directly and restores their compact branch on selection", () => {
  assert.match(html, /id="workspace-search-status"[^>]*role="status"/);
  assert.match(html, /class="search-spinner"/);
  assert.match(styles, /\.explorer-search-status\[hidden\] \{ display: none; \}/);
  assert.match(main, /searchWorkspaceFiles/);
  assert.match(main, /scheduleWorkspaceFileSearch/);
  assert.match(main, /workspaceSearchIndex/);
  assert.match(main, /workspaceSearchTimer/);
  assert.match(main, /setWorkspaceSearchLoading/);
  assert.match(main, /setWorkspaceSearchLoading\(false\);[\s\S]*void collapseExplorer\(\)/);
  assert.match(main, /aria-busy/);
  assert.match(main, /window\.setTimeout/);
  assert.match(main, /maxDepth: 99/);
  assert.match(main, /entry\.kind === 'file'/);
  assert.match(main, /No matching files/);
  assert.match(main, /workspace-path-hint/);
  assert.match(main, /workspace-result-copy/);
  assert.match(main, /parentPath/);
  assert.match(main, /showPathHint: true/);
  assert.match(main, /const wasSearching = Boolean\(filter\?\.value\.trim\(\)\)/);
  assert.match(main, /if \(filter\) filter\.value = ''/);
  assert.match(main, /void collapseExplorer\(\)/);
  assert.match(styles, /\.workspace-tree\.is-searching \.workspace-entry\.directory \{ display: none; \}/);
  assert.match(styles, /\.workspace-entry\.search-result \.workspace-path-hint/);
  assert.match(styles, /overflow-wrap: anywhere/);
});

test("explorer mode changes preserve continuity with a reduced-motion path", () => {
  assert.match(styles, /\.sidebar\.explorer-expanded \.primary-nav/);
  assert.match(styles, /visibility: hidden/);
  assert.match(styles, /\.workspace-tree\.is-transitioning/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(main, /loadWorkspaceTree\([^\n]+\{ animate: true \}/);
  assert.match(main, /requestAnimationFrame\(\(\) => tree\.classList\.remove\('is-transitioning'\)\)/);
  assert.match(main, /primaryNav\?\.setAttribute\('aria-hidden', String\(expanded\)\)/);
});

test("document editor fills its viewport and exposes save state", () => {
  assert.match(html, /<textarea[^>]+id="document-content"/);
  assert.match(html, /id="save-file"/);
  assert.match(html, /id="discard-file"/);
  assert.match(styles, /\.document-viewer-body \{ display: flex; height: min\(52vh, 520px\)/);
  assert.match(styles, /\.document-content \{ display: block; width: 100%;/);
  assert.match(main, /event\.key\.toLowerCase\(\) === 's'/);
});

test("theme switch is visible in the topbar and exposes light/dark state", () => {
  assert.match(html, /class="top-actions"[\s\S]*class="theme-switch"/);
  assert.match(html, /class="theme-switch"[^>]*role="switch"[^>]*aria-checked="false"/);
  assert.match(html, /class="theme-switch-thumb"/);
  assert.match(main, /querySelector\('\.theme-switch-label'\)/);
  assert.match(main, /setAttribute\('aria-checked', String\(nextTheme === 'light'\)\)/);
  assert.match(main, /localStorage\.setItem\('ade-theme'/);
});

test("light theme keeps Explorer hover surfaces light", () => {
  assert.match(styles, /:root\[data-theme="light"\] \.workspace-entry\.directory:hover/);
  assert.match(styles, /:root\[data-theme="light"\] \.workspace-entry\.file:hover/);
  assert.doesNotMatch(styles, /:root\[data-theme="light"\][^\n]*workspace-entry[^\n]*background: #1b2935/);
});
