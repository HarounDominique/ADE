import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const html = readFileSync(new URL("../desktop/src/index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../desktop/src/styles.css", import.meta.url), "utf8");
const snapshot = readFileSync(new URL("../desktop/src/project-snapshot.js", import.meta.url), "utf8");
const components = readFileSync(new URL("../desktop/src/components.css", import.meta.url), "utf8");
const codeEditor = readFileSync(new URL("../desktop/src/code-editor.js", import.meta.url), "utf8");
const paths = readFileSync(new URL("../desktop/src/paths.js", import.meta.url), "utf8");
const nativeShell = readFileSync(new URL("../desktop/src-tauri/src/lib.rs", import.meta.url), "utf8");
const checkpointModule = readFileSync(new URL("../src/application/agents/turn-checkpoint.ts", import.meta.url), "utf8");
const releaseScript = readFileSync(new URL("../scripts/package-desktop-release.mjs", import.meta.url), "utf8");
const desktopReleaseWorkflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const safeCommand = readFileSync(new URL("../src/adapters/safe-command.ts", import.meta.url), "utf8");
const gitCommand = readFileSync(new URL("../src/adapters/git-command.ts", import.meta.url), "utf8");
const ghCommand = readFileSync(new URL("../src/adapters/gh-command.ts", import.meta.url), "utf8");
const githubStatus = readFileSync(new URL("../src/application/git/github-status.ts", import.meta.url), "utf8");
const nativeCargo = readFileSync(new URL("../desktop/src-tauri/Cargo.toml", import.meta.url), "utf8");
const peSignature = readFileSync(new URL("../scripts/pe-signature.mjs", import.meta.url), "utf8");
const releaseManifest = readFileSync(new URL("../scripts/release-manifest.mjs", import.meta.url), "utf8");
const tauriConfig = JSON.parse(readFileSync(new URL("../desktop/src-tauri/tauri.conf.json", import.meta.url), "utf8")) as {
  bundle: {
    category: string;
    license: string;
    linux: { deb: { section: string; depends: string[] } };
    windows: { webviewInstallMode: { type: string; silent: boolean } };
  };
};
const editorWindow = readFileSync(new URL("../desktop/src/editor-window.js", import.meta.url), "utf8");
const editorWindowHtml = readFileSync(new URL("../desktop/src/editor-window.html", import.meta.url), "utf8");
const editorCapability = JSON.parse(readFileSync(new URL("../desktop/src-tauri/capabilities/editor-window.json", import.meta.url), "utf8")) as { windows: string[]; permissions: string[] };
const defaultCapability = JSON.parse(readFileSync(new URL("../desktop/src-tauri/capabilities/default.json", import.meta.url), "utf8")) as { permissions: string[] };
const desktopBuild = readFileSync(new URL("../desktop/build.mjs", import.meta.url), "utf8");
const sidecarBuild = readFileSync(new URL("../scripts/build-desktop-sidecar.mjs", import.meta.url), "utf8");
const smokeBundle = readFileSync(new URL("../scripts/smoke-desktop-bundle.mjs", import.meta.url), "utf8");
const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
const devTauriConfig = JSON.parse(readFileSync(new URL("../desktop/src-tauri/tauri.dev.conf.json", import.meta.url), "utf8")) as {
  productName: string;
  identifier: string;
  app: { windows: Array<{ title: string }> };
};

test("desktop development runs as a distinct Assay Dev app", () => {
  assert.match(rootPackage.scripts["desktop:dev"] ?? "", /npm --prefix desktop run dev/);
  assert.equal(devTauriConfig.productName, "Assay Dev");
  assert.equal(devTauriConfig.identifier, "com.ade.desktop.dev");
  assert.equal(devTauriConfig.app.windows[0]?.title, "Assay Dev");
});

test("desktop shell keeps the project workbench areas and critical actions", () => {
  for (const view of ["projects", "editor", "agents", "knowledge", "changes"]) {
    assert.match(html, new RegExp(`data-view=\"${view}\"`));
    assert.match(html, new RegExp(`data-panel=\"${view}\"`));
  }
  for (const action of ["new-task", "open-document", "refresh-tree", "new-agent-session", "github-status", "create-worktree", "push-branch", "refresh-knowledge"]) {
    assert.match(html, new RegExp(`data-action=\"${action}\"`));
  }
});

test("runtime infrastructure stays cross-cutting instead of becoming a visible menu", () => {
  assert.doesNotMatch(html, /data-view="runtime"/);
  assert.doesNotMatch(html, /data-panel="runtime"/);
  assert.doesNotMatch(html, />Local runtime</);
  assert.match(main, /renderRuntimeStatus/);
  assert.match(main, /sidecar_request/);
});

test("terminal tab labels from run configurations are escaped before HTML rendering", () => {
  const renderer = main.slice(main.indexOf("function renderTerminalTabs"), main.indexOf("function syncActiveTerminalInput"));
  assert.match(renderer, /<span>\$\{escapeHTML\(tab\.label\)\}<\/span>/);
  assert.match(renderer, /aria-label="Close \$\{escapeHTML\(tab\.label\)\}"/);
  assert.match(renderer, /title="Close \$\{escapeHTML\(tab\.label\)\}"/);
});

test("agent terminal history is a modal that reopens native agent sessions", () => {
  assert.match(html, /id="terminal-history-toggle"[\s\S]*aria-haspopup="dialog"/);
  assert.match(html, /id="terminal-history-dialog" aria-labelledby="terminal-history-title"/);
  assert.match(main, /function terminalAgentProvider/);
  assert.ok(main.includes('(?:\\S+[\\\\/])?'));
  assert.match(main, /\['claude', 'codex', 'opencode'\]/);
  assert.match(main, /method: 'terminal\.history\.save'/);
  assert.match(main, /method: 'terminal\.history\.delete'/);
  assert.match(main, /function terminalHistoryTitle/);
  assert.match(main, /parsed\.title \?\? parsed\.TITLE/);
  assert.match(main, /function terminalHistoryResumeCommand/);
  // Reopening resumes that conversation by id; the bare picker is only the
  // fallback for a session no provider store could account for.
  assert.match(main, /claude --resume \$\{sessionId\}/);
  assert.match(main, /codex resume \$\{sessionId\}/);
  assert.match(main, /'claude --resume\\r'/);
  assert.match(main, /function providerSessionIdForResume/);
  // Resolution measures the window this tab ran its agent in, not the row's own
  // start, which a reopen would stretch across other conversations.
  assert.match(main, /agentStartedAt: tab\.historyAgentStartedAt/);
  // A row that can only reach the provider's picker says so before it is clicked.
  assert.match(main, /pick from list/);
  assert.match(main, /resumeTerminalHistorySession/);
  assert.match(main, /function prepareTerminalReadiness/);
  assert.match(main, /markTerminalReady\(tab\)/);
  // A stored transcript is a record, never replayed into a live PTY to look
  // like a resumed conversation.
  assert.doesNotMatch(main, /appendTerminalTranscript\(tab\.id, session\.transcript\)/);
  assert.match(main, /escapeHTML\(title\)/);
  assert.match(styles, /\.terminal-history-dialog::backdrop[\s\S]*backdrop-filter: blur/);
});

test("desktop startup placeholders and platform label are not macOS-specific", () => {
  assert.match(html, /id="status-platform">Desktop</);
  assert.doesNotMatch(html, />macOS</);
});

test("a missing Git installation updates Git status instead of reopening the operation dialog", () => {
  assert.match(main, /response\.error\.code === 'GIT_UNAVAILABLE'/);
  assert.match(main, /git-history-status/);
  assert.match(main, /git-pending-status/);
});

test("Agents keeps sessions and conversation as the primary surface", () => {
  assert.match(html, /class="agents-workbench"/);
  assert.match(html, /id="agent-session-list"/);
  assert.match(html, /id="agent-rail-toggle"[\s\S]*data-action="toggle-agent-rail"/);
  assert.doesNotMatch(html, /agent-session-location/);
  assert.match(styles, /\.agent-thread-header \{\n  min-height: 62px/);
  assert.match(html, /class="agent-thread-settings"[\s\S]*id="agent-provider"[\s\S]*id="agent-model"/);
  assert.match(styles, /max-height: clamp\(96px, 24vh, 220px\)/);
  assert.doesNotMatch(html, /id="agent-task"/);
  assert.match(html, /id="agent-provider"/);
  assert.match(main, /data-agent-group-toggle/);
  assert.match(html, /id="agent-message-list"/);
  assert.match(html, /id="agent-prompt-form"/);
  assert.match(html, /id="agent-prompt-input"/);
  assert.doesNotMatch(html, /class="agent-inspector"/);
  assert.doesNotMatch(html, /id="agent-activity-list"|id="agent-files-list"|id="agent-skills-list"/);
  assert.match(html, /value="write_code"/);
  assert.match(html, /value="run_commands"/);
  assert.match(main, /method: 'agent\.sessions'/);
  assert.match(main, /method: 'agent\.messages'/);
  assert.match(main, /method: 'agent\.prompt'/);
  assert.match(main, /method: 'agent\.abort'/);
  assert.match(main, /handleAgentComposerKeydown/);
  assert.match(main, /agentPromptHistoryByConversation/);
  assert.match(main, /savedPromptsForActiveConversation/);
  assert.match(main, /activeAgentSessionId/);
  assert.doesNotMatch(main, /agentPromptHistoryByProject/);
  assert.match(main, /stopAgentPrompt/);
  assert.match(main, /selectAgentSession/);
  assert.match(main, /toggleAgentSessionGroup/);
  assert.match(main, /setAgentRailCollapsed/);
  assert.match(main, /sendAgentPrompt/);
  assert.match(main, /classList\.toggle\('agent-focus', view === 'agents'\)/);
  assert.match(styles, /\.main-content\.agent-focus > \.git-panel/);
  assert.match(styles, /grid-template-columns: 248px minmax\(0, 1fr\);/);
  assert.match(styles, /agent-task-group-toggle/);
  assert.match(styles, /\.agents-workbench\.agent-rail-collapsed/);
});

test("Git workspace is visible only inside Version control", () => {
  assert.match(main, /classList\.toggle\('version-control-focus', view === 'changes'\)/);
  assert.match(html, /class="version-control-utilities"/);
  assert.match(html, /<summary>Repository actions<\/summary>/);
  assert.match(styles, /\.version-control-utilities \.git-panel \{ display: block;/);
});

test("Version control History lets the user collapse its supporting panes for diff reading", () => {
  for (const id of ["history-commits-toggle", "history-commits-restore", "history-files-toggle", "history-files-restore"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-history-pane-toggle="commits"/);
  assert.match(html, /data-history-pane-toggle="files"/);
  assert.match(main, /function setHistoryPaneCollapsed/);
  assert.match(main, /historyPaneStorageKey/);
  assert.match(styles, /history-commits-collapsed/);
  assert.match(styles, /history-files-collapsed/);
  assert.match(styles, /transition: grid-template-columns 180ms/);
  assert.match(styles, /\.history-pane-restore \{ position: absolute;/);
  assert.match(html, /history-commits-toggle[\s\S]*?history-commits-restore/);
  assert.match(html, /history-files-toggle[\s\S]*?history-files-restore/);
  assert.match(styles, /#history-files-restore \{ opacity: 1; pointer-events: auto; transform: translate\(0, -50%\); \}/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});

test("Version control Changes gives the selected diff every byte outside the file pane", () => {
  assert.match(styles, /#version-changes-panel \.changes-workspace \{\s+display: flex;/);
  assert.match(styles, /#version-changes-panel \.pending-files-pane \{\s+display: flex;\s+flex: 0 0 clamp\(300px, 21vw, 344px\);/);
  assert.match(styles, /#version-changes-panel \.pending-diff-pane \{\s+display: grid;\s+flex: 1 1 0;\s+width: 0;/);
  assert.match(styles, /#version-changes-panel \.pending-diff-heading \{\s+display: flex;[\s\S]*?width: 100%;/);
  assert.match(styles, /#version-changes-panel \.pending-diff \{ grid-column: 1; grid-row: 2; width: 100%; min-width: 0; \}/);
});

test("Version control diffs wrap to the live width of their History and Changes panes", () => {
  assert.match(styles, /#git-commit-diff,\s+#version-changes-panel \.pending-diff \{\s+overflow-x: hidden;\s+white-space: pre-wrap;\s+overflow-wrap: anywhere;/);
  assert.match(styles, /#git-commit-diff \.git-diff-line,\s+#version-changes-panel \.pending-diff \.git-diff-line \{\s+max-width: 100%;\s+white-space: pre-wrap;/);
});

test("Agents exposes an accessible delete action for saved conversations", () => {
  assert.match(html, /id="agent-delete-dialog"/);
  assert.match(html, /data-action="confirm-delete-agent-session"/);
  assert.match(html, /data-action="cancel-delete-agent-session"/);
  assert.match(main, /data-delete-agent-session-id/);
  assert.match(main, /Delete saved conversation/);
  assert.match(main, /agent\.session\.delete/);
  const deletion = main.slice(main.indexOf("function openDeleteAgentSessionDialog"), main.indexOf("function startNewAgentSession"));
  assert.match(deletion, /showModal/);
  assert.doesNotMatch(deletion, /window\.confirm/);
  assert.match(styles, /\.agent-session-delete:focus-visible/);
});

test("the shell never assumes a path separator", () => {
  // Tauri hands back native paths, so on Windows these arrive spelled with a
  // backslash and every hardcoded "/" silently fails a comparison.
  assert.doesNotMatch(main, /split\('\/'\)/);
  assert.doesNotMatch(main, /startsWith\(`\$\{workspaceRootPath\}\//);
  // The helpers moved to a module a second window can import; the rule they
  // encode did not move.
  assert.match(paths, /export const pathSegments = \(value\) =>/);
  assert.match(main, /function pathInsideRoot/);
  // The rule reaches every window and every module that spells a file name.
  for (const module of [editorWindow, codeEditor]) {
    assert.doesNotMatch(module, /split\('\/'\)/);
    assert.match(module, /from '\.\/paths\.js'/);
  }
  for (const script of [sidecarBuild, smokeBundle]) {
    assert.match(script, /fileURLToPath/);
    assert.doesNotMatch(script, /\/private\/tmp/);
  }
});

test("Projects owns both the catalog and the Tasks of the active Project", () => {
  // A Task cannot exist outside a Project, so the two never belonged in
  // separate menus.
  assert.doesNotMatch(html, /data-view="work"/);
  assert.doesNotMatch(html, /data-panel="work"/);
  assert.doesNotMatch(main, /work-task-list/);
  assert.match(html, /id="project-task-list"/);
  assert.match(html, /class="projects-catalog"/);
  assert.match(html, /data-action="new-task"/);
  assert.match(html, /data-action="add-project"/);
  // The list and the topbar are one selection, not two.
  assert.match(main, /if \(taskId !== selectedTaskId\) selectTaskContext\(taskId\);/);
  assert.match(main, /function toggleTaskDetail/);
  assert.match(main, /aria-controls="task-detail-/);
  // Counts are real; the fabricated deltas beside them are gone.
  assert.doesNotMatch(html, /metric-card/);
  assert.doesNotMatch(html, /this week|Awaiting decision|Not shipped yet/);
  assert.match(html, /class="project-metrics"/);
});

test("only a real snapshot repaints project state", () => {
  // task.create and task.advance answer with the Task, and the generic fallback
  // used to treat any unrecognized result as a snapshot -- rebuilding the view
  // from the startup fixture and emptying the Task list on every mutation.
  assert.match(main, /if \(response\.result\?\.project && Array\.isArray\(response\.result\?\.tasks\)\)/);
  assert.doesNotMatch(main, /\n      if \(response\.result\) \{\n        const nextProject/);
  assert.match(main, /response\.result\?\.id && response\.result\?\.intent && response\.result\?\.status && !response\.result\.tasks/);
  // Evidence already fetched survives a refresh instead of resetting to a
  // loading line nobody re-requests.
  assert.match(main, /taskDetailMarkup\.set\(task\.id, markup\)/);
  assert.match(main, /taskDetailMarkup\.get\(task\.id\) \?\?/);
});

test("a turn in flight is visible in the conversation", () => {
  // The prompt belongs in the transcript on send, not when the turn ends.
  assert.match(main, /pendingAgentTurn = \{ prompt, provider, startedAt: Date\.now\(\), activity: \[\], output: '', historyKey, sessionId: null \}/);
  assert.match(main, /function pendingTurnMarkup/);
  assert.match(main, /list\.innerHTML \+= pendingTurnMarkup\(\)/);
  // State owns the pending turn, so a re-render rebuilds it instead of losing it.
  assert.match(main, /let pendingAgentTurn = null/);
  assert.match(main, /function clearPendingAgentTurn/);
  assert.match(main, /response\.type === 'agent\.activity'/);
  assert.match(main, /response\.type === 'agent\.output'/);
  assert.match(main, /agentStreamingOutputMarkup/);
  assert.match(main, /function startAgentElapsedTimer/);
  assert.match(styles, /@keyframes agent-thinking-pulse/);
  assert.match(styles, /\.agent-thinking-dot \{ animation: none/);
});

test("every message can be copied, whatever the clipboard does", () => {
  assert.match(main, /data-copy-message=/);
  assert.match(main, /function copyAgentMessage/);
  // The clipboard API can hang instead of rejecting here, so the attempt is
  // bounded and falls back to a selection copy rather than waiting forever.
  assert.match(main, /Promise\.race\(\[\s*navigator\.clipboard\.writeText/);
  assert.match(main, /document\.execCommand\('copy'\)/);
  // A copy that did not happen says so instead of pretending it did.
  assert.match(main, /notify\('Unable to copy this message\.'\)/);
  // Reachable without a pointer.
  assert.match(styles, /\.agent-message-copy:focus-visible/);
  assert.match(styles, /\.agent-message:hover \.agent-message-copy/);
});

test("navigation runs from the work outward", () => {
  // Order is part of the contract: Projects and Agents are where work starts,
  // Version control is where it is judged, and Editor is the escape hatch.
  const order = [...html.matchAll(/<button class="nav-item[^"]*" data-view="([a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(order, ["projects", "agents", "changes", "knowledge", "editor"]);
  assert.match(html, /data-view="knowledge"[\s\S]*?<span>Context<\/span>/);
  assert.doesNotMatch(html, /<span>Project context<\/span>/);
});

test("the terminal opens in the theme already on screen, in full colour", () => {
  // A hardcoded theme at construction meant every terminal opened black
  // whatever the shell was wearing.
  assert.match(main, /theme: activeTerminalPalette\(\)/);
  assert.match(main, /function activeTerminalPalette/);
  assert.doesNotMatch(main, /theme: \{ background: '#0d1416'/);
  // Four colours left the sixteen ANSI ones on xterm's dark-tuned defaults,
  // which is what made light mode unreadable.
  for (const colour of ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white", "brightBlack", "brightWhite"]) {
    assert.match(main, new RegExp(`${colour}: '#`));
  }
  // The frame and the canvas must agree on one colour per theme: the light
  // theme's move to Everest changed the frame, and the canvas follows it.
  assert.match(styles, /\[data-theme="light"\] \.terminal-surface[\s\S]*?background: #eaf1f2/);
  assert.match(main, /background: '#eaf1f2', foreground: '#131b25'/);
  assert.match(styles, /not\(\[data-theme="light"\]\) \.terminal-surface[\s\S]*?background: #141a22/);
});

test("guarded actions confirm in-app because the webview has no window prompts", () => {
  assert.doesNotMatch(main, /window\.confirm/);
  assert.doesNotMatch(main, /window\.prompt/);
  assert.match(html, /id="confirm-dialog"/);
  assert.match(html, /data-action="accept-confirm"/);
  assert.match(html, /data-action="cancel-confirm"/);
  assert.match(html, /id="worktree-dialog"/);
  for (const id of ["confirm-dialog-title", "confirm-dialog-copy", "confirm-dialog-accept", "worktree-branch", "worktree-path"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(main, /function requestConfirmation/);
  assert.match(main, /pendingConfirmation = onConfirm/);
  const removal = main.slice(main.indexOf("function removeProjectFromUI"), main.indexOf("function renderChanges"));
  assert.match(removal, /requestConfirmation\(/);
  const discard = main.slice(main.indexOf("async function discardDocumentChanges"), main.indexOf("async function formatActiveDocument"));
  assert.match(discard, /requestConfirmation\(/);
  assert.match(main, /worktree-form'\)\?\.addEventListener\('submit'/);
});

test("switching Project refreshes and isolates the Agent session history", () => {
  const switcher = main.slice(main.indexOf("async function switchProjectFromContext"), main.indexOf("async function switchBranchFromContext"));
  assert.match(switcher, /resetAgentWorkspaceForProject\(\)/);
  assert.match(switcher, /requestAgentSessions\(workspaceRootPath\)/);
  assert.match(main, /pendingAgentSessionPaths\.set\(id, path\)/);
  assert.match(main, /if \(agentSessionRequestPath !== workspaceRootPath\) return;/);
  assert.match(main, /pendingAgentMessageSessions\.set\(id, sessionId\)/);
  assert.match(main, /if \(agentMessageRequestSession !== activeAgentSessionId\) return;/);
  assert.match(main, /pendingAgentPromptProjects\.set\(requestId, activeProjectId\)/);
  assert.match(main, /agentPromptProject !== activeProjectId/);
});

test("Agent permissions are explicit checkboxes without a blocking second prompt", () => {
  const handler = main.slice(main.indexOf("function sendAgentPrompt"), main.indexOf("function renderProjectTasks"));
  assert.match(handler, /input\[type="checkbox"\]:checked/);
  assert.match(handler, /grantedPermissions: permissions/);
  assert.doesNotMatch(handler, /window\.confirm/);
});

test("desktop shell exposes the Git context bar and Explorer search affordance", () => {
  assert.match(html, /id="repository-context-button"/);
  assert.match(html, /id="task-context-button"/);
  assert.match(html, /id="branch-context-button"/);
  assert.match(html, /id="repository-context-menu"/);
  assert.match(html, /id="task-context-menu"/);
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
  assert.match(main, /repositoryName\.textContent = hasProject \? activeProject\.name : noneLabel/);
  assert.doesNotMatch(html, /class="breadcrumb"/);
  assert.match(main, /showView\('editor'\)/);
  assert.match(html, /data-action="add-project"/);
  assert.match(html, /id="projects-list"/);
  assert.match(html, /id="selected-project-title"/);
  assert.match(main, /data-remove-project-id/);
  assert.doesNotMatch(html, /PROJECT HUB/);
  assert.doesNotMatch(html, /Task workbench/);
  assert.match(main, /project\.remove/);
  assert.match(html, /data-panel="editor"/);
  assert.doesNotMatch(html, /id="editor-empty-state"/);
  assert.doesNotMatch(html, /Focus Explorer search/);
  assert.match(main, /classList\.toggle\('editor-focus', view === 'editor'\)/);
  assert.match(styles, /\.git-context-bar/);
  assert.match(styles, /\.git-context-menu/);
  assert.match(styles, /\.main-content\.editor-focus \.git-panel/);
});

test("desktop shell wires critical actions to Tauri commands", () => {
  for (const command of ["sidecar_request", "sidecar_restart", "open_document", "open_file", "read_file", "write_file", "terminal_start", "terminal_input", "terminal_stop", "terminal_stop_all"]) {
    assert.match(main, new RegExp(`['\"]${command}['\"]`));
  }
  assert.match(main, /method: 'task\.run'/);
  assert.match(main, /renderChanges\(agentProjectTasks\)/);
  assert.match(main, /maxTaskContextItems = 12/);
  assert.match(main, /taskCreatedAt/);
  assert.match(main, /list_directory/);
  assert.match(main, /method: 'github\.status'/);
  for (const id of ["git-commit-list", "git-commit-files", "git-commit-diff", "git-pending-files", "git-pending-diff", "git-history-filter", "git-pending-filter", "git-remote-status", "git-fetch-origin", "commit-dialog", "commit-title", "commit-body", "git-push-origin", "commit-branch-name"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /data-action="commit-local"/);
  assert.match(html, /data-action="push-origin"/);
  assert.match(html, /data-action="open-commit-dialog"/);
  assert.doesNotMatch(html, /Commit &amp; Push/);
  assert.match(main, /Persisted activity/);
  assert.match(main, /method: 'knowledge\.reconcile\.changed'/);
  assert.match(main, /renderProviders/);
  assert.match(main, /providerIsAvailable/);
  assert.match(html, /id="agent-provider-status"/);
  assert.match(html, /Claude Code/);
  assert.match(html, /id="agent-model"/);
  assert.match(main, /renderModelSelection/);
  // The model is always sent, empty included: omitting it let a conversation
  // keep its previous model when the operator went back to the provider default.
  assert.match(main, /prompt,\n?\s*model,|prompt, model,/);
  assert.match(main, /selectedAgentModel = session\.model \?\? defaultModelForProvider\(session\.provider\)/);
  assert.doesNotMatch(main, /agentSessionModels/);
  assert.match(main, /method: 'service\.list'/);
  assert.match(main, /renderServices/);
  assert.match(html, /id="document-viewer"/);
  assert.match(main, /git\.history/);
  assert.match(main, /git\.commit\.diff/);
  assert.match(main, /git\.pending/);
  assert.match(main, /git\.pending\.diff/);
  assert.match(main, /data-git-pending-file/);
  assert.match(main, /requestPendingGitChanges/);
  assert.match(main, /renderFilteredGitHistory/);
  assert.match(main, /pendingGitFilter/);
  assert.match(main, /activeView === 'changes'/);
  assert.match(main, /setInterval\(\(\) =>/);
  assert.match(main, /git\.fetch\.origin/);
  assert.match(main, /git\.commit\.create/);
  assert.match(main, /git\.push/);
  assert.doesNotMatch(main, /git\.commit\.push/);
  const commitSubmit = main.slice(main.indexOf("document.getElementById('git-commit-form')"), main.indexOf("document.addEventListener('click'"));
  assert.match(commitSubmit, /git\.commit\.create/);
  assert.doesNotMatch(commitSubmit, /window\.confirm/);
  const remoteActions = main.slice(main.indexOf("item.dataset.action === 'fetch-origin'"), main.indexOf("item.dataset.action === 'refresh-knowledge'"));
  assert.doesNotMatch(remoteActions, /window\.confirm/);
  assert.match(main, /gitUnpushedCommitCount = response\.result\.filter/);
  assert.match(main, /git-commit-unpushed/);
  assert.match(main, /not pushed to origin/);
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
  assert.doesNotMatch(main, /agent-skill|native-skills-list|agent-activity-list|agent-files-list/);
  assert.match(main, /resumeAgentConversation/);
});

test("workspace tree expands directories lazily and keeps symlinks non-actionable", () => {
  assert.match(main, /renderWorkspaceEntries/);
  assert.match(main, /data-directory-path/);
  assert.match(main, /toggleWorkspaceDirectory/);
  assert.match(main, /maxDepth: 0/);
  assert.match(main, /Symlinks are not opened outside the selected Project/);
  assert.match(main, /\[data-directory-path\]\.directory/);
});

test("approving and shipping a Task are two decisions, and both say why they are blocked", () => {
  assert.match(main, /function taskGovernanceMarkup/);
  assert.match(main, /data-action="approve" data-task-id=/);
  assert.match(main, /data-action="ship" data-task-id=/);
  // The approve action used to read a review panel the shell no longer has.
  assert.doesNotMatch(main, /document\.getElementById\('changes-task-id'\)\?\.textContent/);
  // A disabled control explains itself instead of vanishing.
  assert.match(main, /Approve the Task before publishing it/);
  assert.match(main, /`Blocked by: \$\{shipBlockers\.join\(', '\)\}`/);
  assert.match(main, /method: 'task\.ship'/);
  // Re-review was unreachable for the same reason, and belongs to the same row.
  assert.match(main, /data-action="rereview" data-task-id=/);
  // One dialog, two actions, never pretending they are the same one.
  assert.match(main, /let shippingTaskId = null;/);
  assert.match(main, /if \(shippingTaskId\) \{/);
  // A commit made under a Task belongs to that Task's trail.
  assert.match(main, /\.\.\.\(selectedTaskId \? \{ taskId: selectedTaskId \} : \{\}\)/);
  assert.match(styles, /\.task-governance \{ display: flex;/);
});

test("a run can stand as the build or tests gate, and editing it does not drop that", () => {
  assert.match(html, /id="run-config-verifies"/);
  assert.match(html, /<option value="build">The build gate<\/option>/);
  // The form rebuilds the configuration, so the role has to survive the trip.
  assert.match(main, /const verifies = value\('run-config-verifies'\);/);
  assert.match(main, /if \(kind === 'command' && \(verifies === 'build' \|\| verifies === 'tests'\)\) configuration\.verifies = verifies;/);
  assert.match(main, /set\('run-config-verifies', configuration\?\.verifies \?\? ''\);/);
  // A verification run cites the Task it ran under; without one no gate claims it.
  assert.match(main, /configuration\.verifies && selectedTaskId \? \{ taskId: selectedTaskId \} : \{\}/);
});

test("the repository is state, never the label a human reads", () => {
  // The header label doubled as the repository path, so the fixture's
  // placeholder travelled into a process spawn as its working directory and
  // failed there as if the CLI were missing.
  assert.doesNotMatch(main, /getElementById\('project-path'\)\?\.textContent/);
  assert.match(main, /function activeRepositoryPath/);
  // The panel no longer repeats a path the selector above it already owns; the
  // selector cannot show it whole, so it says it on rest.
  assert.doesNotMatch(html, /id="project-path"/);
  assert.match(main, /repositoryButton\.dataset\.hoverTitle = activeProject\.repositoryPath \?\? '';/);
  assert.match(html, /id="repository-context-button"[^>]*data-hover-title=""/);
  // The menu rows truncate the same path, so they say it on rest too.
  assert.match(main, /data-project-id="\$\{escapeHTML\(project\.id\)\}" data-hover-title="\$\{escapeHTML\(project\.repositoryPath\)\}"/);
  assert.match(main, /data-task-context-id="\$\{escapeHTML\(task\.id\)\}" data-hover-title=/);
  // The selected row of a menu is drawn, not a check character.
  assert.match(main, /function selectedMarkMarkup/);
  assert.doesNotMatch(main, /aria-hidden="true">\$\{[^}]*'✓'/);
  assert.match(snapshot, /repositoryPath: ''/);
  assert.doesNotMatch(snapshot, /repositoryPath: 'Project root'/);
  // A turn without a Project says so, instead of failing as a missing CLI.
  assert.match(main, /Select a Project before sending a prompt/);
});

test("a Task row leads with its intent and carries its action on the same line", () => {
  // The id sat first and as loud as the intent, and the action stacked under
  // the row, so three Tasks filled the pane and one control had two languages.
  assert.match(main, /<span class="task-row-copy">\s*\n\s*<span class="task-row-intent">/);
  assert.match(styles, /\.task-row-id \{[^}]*color: var\(--faint\)/);
  assert.match(styles, /\.task-row \{ display: grid; grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(styles, /\.task-row \.task-action \{ grid-column: 2;/);
  assert.doesNotMatch(styles, /\.task-row \.task-action \{ margin: 0 13px 13px; \}/);
  // One drawn mark says "this is the active one" in both lists; the Project
  // list had been using Unicode bullets the design system bans.
  assert.match(main, /function activeMarkMarkup/);
  assert.match(main, /activeMarkMarkup\(isActive, 'Active Project'\)/);
  assert.match(main, /activeMarkMarkup\(isCurrent, 'Active task'\)/);
  assert.doesNotMatch(main, /isActive \? '●' : '○'/);
  // A bare time only reads as today; anything older says its date.
  assert.match(main, /function taskRowTimestamp/);
});

test("a commit belongs to the repository it was read from", () => {
  // Switching Project kept the previous repository's selected commit, and the
  // new one was asked for an object it never had: "fatal: bad object".
  assert.match(main, /selectedGitCommit = null;\n    selectedGitCommitFile = null;\n    gitHistoryCommits = \[\];/);
  // A history or diff that arrives after the Project changed is discarded
  // rather than rendered against the new repository.
  assert.match(main, /let gitHistoryRequestPath = null;/);
  assert.match(main, /if \(gitHistoryRequestPath !== workspaceRootPath\) return;/);
  assert.match(main, /contextPurpose === 'git-diff' && gitDiffRequestPath === workspaceRootPath/);
});

test("a finished answer can be unfolded into what produced it", () => {
  assert.match(main, /function agentTraceMarkup/);
  // The reply is what the conversation reads; the trace is what makes it
  // checkable, and it is kept rather than discarded when the spinner stops.
  assert.match(main, /\$\{agentTraceMarkup\(message\)\}<\/li>/);
  assert.match(main, /<details class="agent-trace">/);
  // A turn that answered from what it knew has nothing to unfold, so it keeps
  // the facts flat instead of offering an expander onto emptiness.
  assert.match(main, /if \(!activity && !files\) return `<p class="agent-trace-flat">/);
  // The summary advertises what is inside rather than saying only "Trace".
  assert.match(main, /\$\{trace\.activity\.length\} action/);
  assert.match(main, /Files touched/);
  // The turn's usage is stated in the same shape everywhere it is read, with
  // cache told apart from what was paid for at full price.
  assert.match(main, /\.\.\.\(trace\.usage \? usageParts\(trace\.usage\) : \[\]\)/);
  // A disclosure, so it opens with the keyboard as well as the pointer.
  assert.match(styles, /\.agent-trace > summary \{ display: flex;/);
  assert.match(styles, /\.agent-trace\[open\] \.agent-trace-summary-label::before \{ transform: rotate\(90deg\); \}/);
});

test("a finished turn chimes, and a turn the operator stopped does not", () => {
  assert.match(html, /id="agent-sound-toggle"[^>]*data-action="toggle-agent-sound"/);
  assert.match(main, /function playAgentTurnChime/);
  // Synthesised, so the chime needs no asset, no decoding and no network.
  assert.match(main, /window\.AudioContext \?\? window\.webkitAudioContext/);
  assert.doesNotMatch(main, /new Audio\(/);
  // It sounds when the turn completes and when it fails, never when the
  // operator stopped it themselves.
  assert.match(main, /if \(!agentStopRequested\) playAgentTurnChime\(\);/);
  // A turn that failed silently reads as one that hung, so the chime is not the
  // only thing that arrives: the provider's message does too.
  assert.match(main, /failed this turn: \$\{response\.error\.message\}/);
  assert.match(main, /if \(response\.result\.pressure\) applyAgentPressure\(response\.result\.pressure\);\n        playAgentTurnChime\(\);/);
  // On by default, silenceable, and the choice survives a restart.
  assert.match(main, /const agentSoundStorageKey = 'ade-agent-sound';/);
  assert.match(main, /localStorage\.getItem\(agentSoundStorageKey\) !== 'off'/);
  assert.match(styles, /\.agent-sound-toggle\.is-silenced \.agent-sound-cross \{ display: inline; \}/);
});

test("Agents shows what the session, the week and the context have left", () => {
  assert.match(html, /id="agent-pressure" role="group"/);
  assert.match(main, /function renderAgentPressure/);
  assert.match(main, /agentPressureDial\('session', 'Session'/);
  assert.match(main, /agentPressureDial\('weekly', 'Weekly'/);
  assert.match(main, /agentPressureDial\('context', 'Context'/);
  // The dial fills with what is spent and the label says what is left.
  assert.match(main, /const remaining = known \? Math\.round\(100 - percent\) : null;/);
  // A window the agent does not report is a dash, never a zero.
  assert.match(main, /const value = known \? `\$\{remaining\}%` : '—';/);
  assert.match(main, /not reported by this agent/);
  assert.match(main, /agent-pressure-dial\$\{known \? '' : ' unknown'\}/);
  // The number arrives on hover or keyboard focus; the ring is always visible.
  assert.match(styles, /\.agent-pressure-copy \{[^}]*opacity: 0;/);
  assert.match(styles, /\.agent-pressure-dial:hover \.agent-pressure-copy, \.agent-pressure-dial:focus-visible \.agent-pressure-copy \{ opacity: 1; \}/);
  assert.match(styles, /\.agent-pressure-dial\.unknown \.agent-pressure-ring \{[^}]*dashed/);
  // Asked for when the surface opens, when the conversation changes and when the agent does.
  assert.match(main, /method: 'agent\.pressure'/);
  assert.match(main, /requestAgentPressure\(session\.provider, session\.id\)/);
  assert.match(main, /response\.type === 'agent\.pressure'/);
});

test("a changed file is named before it is located", () => {
  // The list's width ran out on the name, which is what the reader came for.
  assert.match(main, /function gitFileLabelMarkup/);
  assert.match(main, /const name = segments\.at\(-1\) \?\? path;/);
  assert.match(main, /const where = segments\.slice\(0, -1\)\.join\('\/'\);/);
  assert.match(main, /class="git-file-name"/);
  assert.match(main, /class="git-file-where"/);
  assert.doesNotMatch(main, /data-git-pending-file="\$\{escapeHTML\(file\.path\)\}"><span class="git-file-status">\$\{escapeHTML\(file\.status\)\}<\/span><code>/);
  // The whole path is still one hover away, and it still addresses the diff.
  assert.match(main, /title="\$\{escapeHTML\(workspaceGitRelativePath\(file\.path\)\)\}"/);
  assert.match(main, /data-git-pending-file="\$\{escapeHTML\(file\.path\)\}"/);
  assert.match(styles, /\.git-file-name \{ flex: 0 1 auto;[^}]*font-weight: 600;/);
  // History listed whole paths and gave no sign of which file the diff showed.
  assert.match(main, /class="git-commit-file\$\{workspaceGitRelativePath\(file\.path\) === selectedGitCommitFile \? ' active' : ''\}"/);
  assert.match(main, /\$\{gitFileLabelMarkup\(file\)\}<\/button>/);
  assert.match(main, /if \(selectedGitCommit\?\.hash !== hash\) selectedGitCommitFile = null;/);
  assert.match(styles, /\.git-commit-file\.active \{ color: var\(--text\);/);
  // The commit header spent four lines on what one says, including forty
  // characters of hash the short one already carried.
  assert.match(html, /id="git-commit-file-name" hidden/);
  assert.doesNotMatch(html, /id="git-commit-hash"/);
  assert.match(main, /meta\.textContent = `\$\{commit\.shortHash\} · \$\{commit\.author\}/);
  assert.match(main, /meta\.title = commit\.hash;/);
  assert.match(styles, /\.git-commit-heading \{ display: flex;/);
  assert.match(styles, /\.git-file-where \{ flex: 1 100 0;/);
});

test("resting on a file in the tree names it after a second and a half", () => {
  assert.match(html, /id="workspace-tooltip" role="tooltip" hidden/);
  assert.match(main, /const workspaceTooltipDelay = 1500;/);
  assert.match(main, /setTimeout\(\(\) => showWorkspaceTooltip\(entry, clientX, clientY\), workspaceTooltipDelay\)/);
  // The row's own name with its extension, never the path the tree already shows.
  assert.match(main, /pathBaseName\(entry\?\.dataset\.filePath \?\? ''\)/);
  assert.match(main, /#workspace-tree \.workspace-entry\.file/);
  // The native tooltip cannot be delayed and carries the Git state, so it is
  // parked while the pointer rests and the state travels into this one.
  assert.match(main, /function parkNativeWorkspaceTitle/);
  assert.match(main, /function restoreNativeWorkspaceTitle/);
  assert.match(main, /parkNativeWorkspaceTitle\(workspaceTooltipEntry\);/);
  assert.match(main, /workspaceStateLabels\[state\] \?\? ''/);
  // Leaving, clicking, scrolling or losing the window ends the hover.
  assert.match(main, /document\.addEventListener\('pointerdown', hideWorkspaceTooltip\)/);
  assert.match(main, /document\.addEventListener\('scroll', hideWorkspaceTooltip, true\)/);
  assert.match(main, /window\.addEventListener\('blur', hideWorkspaceTooltip\)/);
  assert.match(styles, /\.workspace-tooltip \{ position: fixed;[^\n]*pointer-events: none; \}/);
  assert.match(styles, /\.workspace-tooltip\[hidden\] \{ display: none; \}/);
});

test("desktop navigation is labeled and terminal dock supports persisted resizing", () => {
  assert.doesNotMatch(html, /class="activity-rail"/);
  assert.match(html, /class="primary-nav"/);
  assert.match(html, />Projects<\/span>/);
  assert.match(html, />Editor<\/span>/);
  assert.match(html, /id="terminal-resizer" role="separator"/);
  assert.match(html, /id="terminal-size-toggle"/);
  assert.match(main, /ade-terminal-height/);
  assert.match(main, /setPointerCapture/);
  assert.match(html, /class="terminal-surface" tabindex="0"/);
  assert.match(html, /id="terminal-hosts"/);
  assert.match(main, /from '@xterm\/xterm'/);
  assert.match(main, /from '@xterm\/addon-fit'/);
  assert.match(main, /terminalTabs/);
  assert.match(main, /new Terminal/);
  assert.match(main, /tab\.terminal\.onData/);
  assert.match(main, /tab\.terminal\?\.write/);
  assert.match(main, /tab\.terminal\.open/);
  assert.match(main, /terminal_resize/);
  assert.match(main, /scheduleTerminalFit/);
  assert.match(main, /terminalHeightBounds/);
  assert.match(main, /updateTerminalSizeToggle/);
  assert.match(main, /animateTerminalHeight/);
  assert.match(styles, /\.terminal-dock\.terminal-size-transitioning/);
  assert.match(main, /ResizeObserver/);
  assert.match(main, /sessionId: tab\.id/);
  assert.match(main, /payload\?\.session_id/);
  assert.match(main, /terminal-new-tab/);
  assert.match(main, /data-terminal-tab-id/);
  assert.match(main, /data-terminal-close-id/);
  assert.match(main, /sendTerminalInput/);
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
  assert.match(styles, /\.explorer-actions \[data-action="toggle-explorer"\] svg \{ transform: rotate\(-90deg\); \}/);
  assert.match(main, /expanded \? 'rotate\(90deg\)' : 'rotate\(-90deg\)'/);
  assert.match(main, /renderCompactWorkspacePath/);
  assert.match(main, /selectedFilePath/);
  assert.match(main, /explorerExpanded/);
  assert.match(main, /expandExplorerFrom/);
  assert.match(main, /revealSelectedFileBranch/);
  assert.match(main, /await revealSelectedFileBranch\(\)/);
  assert.match(main, /collapseExplorer/);
});

test("run control exposes detected project toolchains without executing them", () => {
  assert.match(main, /sendContextRequest\('toolchain\.inspect'/);
  assert.match(main, /contextPurpose === 'toolchain-inspect'/);
  assert.match(main, /toolchainStatuses/);
  assert.match(main, /Toolchains/);
});

test("workspace search returns files directly and restores their compact branch on selection", () => {
  assert.match(html, /id="workspace-search-status"[^>]*role="status"/);
  assert.match(html, /class="search-spinner"/);
  assert.match(styles, /\.explorer-search-status\[hidden\] \{ display: none; \}/);
  assert.match(main, /searchWorkspaceFiles/);
  assert.match(main, /scheduleWorkspaceFileSearch/);
  assert.match(main, /workspaceSearchTimer/);
  assert.match(main, /setWorkspaceSearchLoading/);
  assert.match(main, /setWorkspaceSearchLoading\(false\);[\s\S]*void collapseExplorer\(\)/);
  assert.match(main, /aria-busy/);
  assert.match(main, /window\.setTimeout/);
  assert.match(main, /invoke\('search_directory', \{ path: workspaceRootPath, query: needle \}\)/);
  assert.doesNotMatch(main, /workspaceSearchIndex/);
  assert.doesNotMatch(main, /tree\) tree\.innerHTML = '<li class="workspace-empty">Searching files…<\/li>'/);
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

test("saving a file clears the tree without waiting for another click", () => {
  const editState = main.slice(main.indexOf("function updateDocumentEditState"), main.indexOf("/** Called on every keystroke"));
  // The repaint has to follow the write to the tab record it reads.
  assert.match(editState, /syncActiveDocumentTabState\(\);\n  if \(documentDirty !== wasDirty\) decorateWorkspaceTree\(\);/);
  const save = main.slice(main.indexOf("async function saveActiveDocument"), main.indexOf("async function discardDocumentChanges"));
  assert.match(save, /dirty: false/);
  assert.match(save, /requestPendingGitChanges\(workspaceRootPath\)/);
});

test("opening a file never reports it as unsaved", () => {
  // The load itself is a change event, so the baseline has to be in place
  // before the text is handed to the editor.
  const render = main.slice(main.indexOf("async function renderActiveDocument"), main.indexOf("async function loadDocumentRecord"));
  assert.match(render, /documentOriginalContent = isText \? \(record\.original \?\? ''\) : '';\n  documentDirty = false;\n  await setCodeEditorContent/);
  assert.doesNotMatch(render, /await setCodeEditorContent\(isText[\s\S]*\n  documentOriginalContent =/);
  // And the tree is reconciled once the load settles, so no state survives it.
  assert.match(render, /updateDocumentEditState\(\);\n  decorateWorkspaceTree\(\);/);
});

test("the workspace tree colours Git state and unsaved buffers", () => {
  assert.match(main, /function workspaceGitStateClass/);
  assert.match(main, /if \(code === '\?\?'\) return 'git-untracked'/);
  assert.match(main, /return 'git-conflict'/);
  assert.match(main, /function workspaceGitRelativePath/);
  assert.match(main, /' -> '/);
  assert.match(main, /function buildWorkspaceGitDecorations/);
  assert.match(main, /directoriesByPath\.set\(prefix, state\)/);
  assert.match(main, /function decorateWorkspaceTree/);
  assert.match(main, /unsaved\.has\(filePath\) \? 'workspace-unsaved'/);
  // A folder reports the unsaved work buried under it, at any depth.
  assert.match(main, /function ancestorDirectoryKeys/);
  assert.match(main, /const unsavedDirectories = ancestorDirectoryKeys\(unsaved\)/);
  assert.match(main, /unsavedDirectories\.has\(relativePath\) \? 'workspace-unsaved'/);
  assert.match(main, /'Contains unsaved changes'/);
  assert.match(styles, /\.workspace-entry\.directory\.workspace-unsaved \.workspace-name \{ color: var\(--vcs-unsaved\); \}/);
  // Colour alone is never the carrier: each state also lands in the title and
  // the accessible name.
  assert.match(main, /entry\.title = label/);
  assert.match(main, /aria-label', `\$\{baseLabel\} — \$\{label\}`/);
  assert.match(main, /workspaceGitDecorations = buildWorkspaceGitDecorations\(pendingGitFiles\)/);
  assert.match(main, /workspaceGitPollTick % 5 === 0/);
  assert.match(styles, /\.workspace-entry\.git-modified \.workspace-name \{ color: var\(--vcs-modified\); \}/);
  assert.match(styles, /\.workspace-entry\.git-untracked \.workspace-name \{ color: var\(--vcs-untracked\); \}/);
  assert.match(styles, /\.workspace-entry\.git-deleted \.workspace-name \{[^\n]*line-through/);
  assert.match(styles, /\.workspace-entry\.workspace-unsaved \.workspace-name \{ color: var\(--vcs-unsaved\); \}/);
  assert.match(styles, /\.workspace-entry\.directory\.git-modified \.workspace-name/);
  assert.match(styles, /:root\[data-theme="dark"\] \{ --vcs-untracked/);
});

test("explorer mode changes preserve continuity with a reduced-motion path", () => {
  assert.match(styles, /\.sidebar\.explorer-expanded \.primary-nav/);
  assert.match(styles, /\.primary-nav \.nav-item:not\(\.active\) \{ display: none; \}/);
  assert.match(styles, /\.workspace-tree\.is-transitioning/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(main, /loadWorkspaceTree\([^\n]+\{ animate: true \}/);
  assert.match(main, /requestAnimationFrame\(\(\) => tree\.classList\.remove\('is-transitioning'\)\)/);
  assert.match(main, /primaryNav\?\.setAttribute\('aria-hidden', 'false'\)/);
});

test("document editor fills its viewport and exposes save state", () => {
  assert.match(html, /class="document-content" id="document-content" role="textbox"/);
  assert.match(html, /data-action="format-document"/);
  assert.match(html, /id="save-file"/);
  assert.match(html, /id="discard-file"/);
  assert.match(styles, /\.document-content \.cm-editor \{ height: 100%;/);
  assert.match(styles, /\.document-content \.cm-gutters/);
  // The editing surface lives apart from the shell that hosts it.
  assert.match(codeEditor, /from 'codemirror'/);
  assert.match(main, /function codeEditor\(\) \{/);
  assert.match(codeEditor, /defaultHighlightStyle/);
  assert.match(main, /function formatActiveDocument/);
  assert.match(main, /prettier\.format/);
  assert.match(codeEditor, /Mod-s/);
  // The surface only reports; saving stays the shell's decision.
  assert.match(main, /onSave: \(\) => \{ void saveActiveDocument\(\); \}/);
  assert.match(codeEditor, /from '@codemirror\/lang-cpp'/);
  assert.match(codeEditor, /from '@codemirror\/lang-java'/);
  assert.match(codeEditor, /from '@codemirror\/lang-php'/);
  assert.match(codeEditor, /monaco-editor\/esm\/vs\/editor\/editor\.api\.js/);
  assert.match(codeEditor, /function initializeMonacoEditor/);
  // The shell no longer reaches into either engine: one surface answers for both.
  assert.doesNotMatch(main, /monacoEditor|codeEditorView|activeEditorEngine/);
  assert.match(codeEditor, /monacoLanguageDefinitions/);
  assert.match(codeEditor, /setModelLanguage/);
  assert.match(codeEditor, /editor-engine-hidden/);
});

test("Markdown opens rendered and keeps one control back to its source", () => {
  assert.match(html, /id="markdown-preview-toggle"[^>]*data-action="toggle-markdown-preview"|data-action="toggle-markdown-preview"[^>]*id="markdown-preview-toggle"/);
  assert.match(html, /id="markdown-preview-toggle"[^>]*aria-controls="document-preview"/);
  assert.match(html, /id="markdown-preview-toggle"[^>]*aria-label="Show Markdown source text"/);
  assert.match(html, /class="document-preview" id="document-preview"[^>]*hidden/);
  // Raw HTML stays off: a file in the tree is untrusted input.
  assert.match(main, /new MarkdownIt\(\{ html: false, linkify: true \}\)/);
  assert.match(main, /import\('markdown-it'\)/);
  assert.match(main, /function syncMarkdownPreview/);
  assert.match(main, /function toggleMarkdownPreview/);
  assert.match(main, /toggle\.textContent = rendered \? 'Source text' : 'Pretty view'/);
  assert.match(main, /markdownMode = isMarkdownPath\(activeDocument\.path\) \? \(markdownPreviewVisible\(\) \? 'PRETTY' : 'SOURCE'\) : null/);
  assert.match(main, /localStorage\.setItem\(markdownPreviewStorageKey/);
  // The preview hides the editor, so Save must not read that as "not editable".
  assert.match(main, /const editable = Boolean\(activeDocument\?\.kind === 'text' && editor && \(!editor\.hidden \|\| markdownPreviewVisible\(\)\)\)/);
  // Links resolve inside the shell instead of navigating the webview away.
  assert.match(main, /function openMarkdownPreviewLink/);
  assert.match(main, /pathInsideRoot\(target\)/);
  assert.match(styles, /\.document-preview \{/);
  assert.match(styles, /#markdown-preview-toggle \{ min-width: 96px; white-space: nowrap; \}/);
  assert.match(styles, /\.document-preview li\.markdown-task-item/);
});

test("theme switch is visible in the topbar and exposes light/dark state", () => {
  assert.match(html, /class="top-actions"[\s\S]*class="theme-switch"/);
  assert.match(html, /class="theme-switch"[^>]*role="switch"[^>]*aria-checked="false"/);
  assert.match(html, /class="theme-switch-thumb"/);
  assert.match(main, /querySelector\('\.theme-switch-label'\)/);
  assert.match(main, /setAttribute\('aria-checked', String\(nextTheme === 'light'\)\)/);
  assert.match(main, /localStorage\.setItem\('ade-theme'/);
});

test("dark theme keeps a dedicated night-evidence palette", () => {
  const darkTheme = styles.slice(styles.indexOf(':root[data-theme="dark"]'), styles.indexOf('html, body', styles.indexOf(':root[data-theme="dark"]')));
  assert.match(darkTheme, /--bg: #0f1724/);
  assert.match(darkTheme, /--panel: #1a2a3b/);
  assert.match(darkTheme, /--cyan: #69d5c8/);
  assert.match(codeEditor, /editor\.background': '#142333'/);
  assert.match(main, /const terminalPalettes = \{/);
  assert.match(main, /dark: \{\s*background: '#141a22'/);
});

test("desktop shell removes simulated chrome and keeps Task selection accessible", () => {
  assert.doesNotMatch(html, /Local workspace|All systems nominal|Local operator|Human in command|brand-beta/);
  assert.doesNotMatch(html, /data-action="show-notifications"|data-action="show-help"/);
  assert.doesNotMatch(html, /TASK-042|TASK-041/);
  assert.match(html, /id="project-task-list" aria-live="polite"/);
  assert.match(main, /class="task-row-select" type="button" data-task-select=/);
  assert.match(main, /No tasks yet\. Create one when you are ready to delegate work/);
  assert.match(styles, /\.task-row-select:focus-visible/);
  assert.match(html, /OpenCode · Codex · Claude Code/);
});

test("desktop shell scopes knowledge, dialogs and tabs to their actual work", () => {
  const knowledgeStart = html.indexOf('data-panel="knowledge"');
  const knowledgeEnd = html.indexOf('data-panel="changes"');
  const graphIndex = html.indexOf('knowledge-graph-panel');
  assert.ok(graphIndex > knowledgeStart && graphIndex < knowledgeEnd);
  assert.match(html, /id="new-task-dialog" aria-labelledby="new-task-dialog-title" aria-describedby="new-task-dialog-copy"/);
  assert.match(html, /id="version-history-tab"/);
  assert.match(html, /aria-labelledby="version-history-tab"/);
  assert.match(html, /id="version-changes-tab"/);
  assert.match(main, /event\.key === 'ArrowRight'/);
  assert.match(main, /event\.key === 'ArrowLeft'/);
});

test("heavy editor modules load only when a matching action needs them", () => {
  assert.match(codeEditor, /export async function loadMonaco\(\)/);
  assert.match(codeEditor, /import\('monaco-editor\/esm\/vs\/editor\/editor\.api\.js'\)/);
  assert.match(main, /async function loadPrettier\(\)/);
  assert.match(main, /import\('prettier\/standalone'\)/);
  assert.doesNotMatch(main, /^import \* as monaco/m);
  assert.doesNotMatch(codeEditor, /^import \* as monaco/m);
  assert.match(desktopBuild, /splitting: true/);
  assert.match(html, /href="\/main\.css"/);
});

test("Agent messages distinguish the user turn and align it to the right", () => {
  assert.match(main, /agent-message-\$\{escapeHTML\(message\.role\)\}/);
  assert.match(styles, /\.agent-message-user \{[^}]*align-self: flex-end/);
  assert.match(styles, /\.agent-message-user \{[^}]*background: color-mix\(in srgb, var\(--blue\) 8%, var\(--panel\)\)/);
});

test("light theme keeps Explorer hover surfaces light", () => {
  assert.match(styles, /:root\[data-theme="light"\] \.workspace-entry\.directory:hover/);
  assert.match(styles, /:root\[data-theme="light"\] \.workspace-entry\.file:hover/);
  assert.doesNotMatch(styles, /:root\[data-theme="light"\][^\n]*workspace-entry[^\n]*background: #1b2935/);
});

test("Agent and model are chosen with the app's own menu, not a native select", () => {
  assert.match(html, /id="agent-provider-button"[\s\S]*aria-haspopup="menu"/);
  assert.match(html, /id="agent-provider-menu" role="menu"/);
  assert.match(html, /id="agent-model-button"[\s\S]*aria-haspopup="menu"/);
  assert.match(html, /id="agent-model-menu" role="menu"/);
  assert.match(html, /class="picker-native" id="agent-provider"/);
  assert.match(html, /class="picker-native" id="agent-model"/);
  assert.match(styles, /\.picker-native \{ display: none; \}/);
  assert.match(main, /function renderAgentPicker\(kind\)/);
  assert.match(main, /function chooseAgentPickerOption\(kind, value\)/);
  // The hidden select stays the value every other reader already uses, so the
  // menu changes the control and not the conversation's state.
  assert.match(main, /select\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  assert.match(main, /role="menuitemradio" aria-checked="\$\{selected\}"/);
});

test("a starred model becomes the agent default without overriding a conversation", () => {
  assert.match(main, /const agentDefaultModelStorageKey = 'ade-agent-default-model'/);
  assert.match(main, /function defaultModelForProvider\(providerId\)/);
  assert.match(main, /function toggleDefaultModel\(modelId\)/);
  assert.match(main, /data-default-model="\$\{escapeHTML\(option\.value\)\}" aria-pressed="\$\{isDefault\}"/);
  // `Provider default` is the absence of an override, so it cannot be starred.
  assert.match(main, /if \(kind !== 'model' \|\| !option\.value\) return ''/);
  // A new conversation and a provider switch start on the default; a session
  // that already carries a model keeps it.
  assert.match(main, /selectedAgentModel = defaultModelForProvider\(selectedProvider\)/);
  assert.match(main, /selectedAgentModel = session\.model \?\? defaultModelForProvider\(session\.provider\)/);
  assert.doesNotMatch(main, /setDefaultModelForProvider\([^)]*\);\n\s*selectedAgentModel/);
  assert.match(styles, /\.picker-default\.is-default \{ color: var\(--amber\)/);
  assert.match(html, /id="agent-model-menu"/);
});

test("the topbar starts, debugs and stops the Project's run configurations", () => {
  for (const id of ["run-control", "run-configuration-button", "run-configuration-menu", "run-start", "run-debug", "run-stop", "run-status"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  // The control lives in the topbar, not inside a view, because starting the
  // application is context the operator carries between views.
  assert.match(html, /class="top-actions"><div class="run-control"/);
  assert.match(main, /function requestRunConfigurations/);
  assert.match(main, /sendContextRequest\('run\.list'/);
  assert.match(main, /method: 'run\.start'/);
  assert.match(main, /method: 'run\.stop'/);
  assert.match(main, /response\.type === 'run\.session'/);
  assert.match(main, /response\.type === 'run\.output'/);
  // A port bound outside loopback is confirmed per run, not once in the file.
  assert.match(main, /port\.bind === 'all'/);
  assert.match(main, /eyebrow: 'EXPOSED PORT'/);
  assert.match(main, /RUN_PORT_CONFLICT/);
  assert.match(styles, /\.run-status\[data-state="RUNNING"\]/);
  assert.match(styles, /\.run-action:disabled \{ cursor: not-allowed/);
});

test("a run's console is a dock tab that does not take the terminal's input or its stop", () => {
  assert.match(main, /kind = 'pty'/);
  assert.match(main, /createTerminalTab\(\{ focus: false, kind: 'run', id, label \}\)/);
  assert.match(main, /if \(tab\.kind === 'pty'\) void sendTerminalInput\(tab, data\)/);
  // Closing the console hides output; the run stays stoppable from the topbar.
  assert.match(main, /if \(tab\.kind === 'pty' && tab\.started\) nativeInvoke\?\.\('terminal_stop'/);
});

test("the agent header and the run control share one dropdown component", () => {
  assert.doesNotMatch(styles, /agent-picker/);
  assert.doesNotMatch(html, /agent-picker/);
  assert.match(html, /class="picker run-picker"/);
  assert.match(html, /class="picker"/);
  assert.match(main, /trigger\?\.dataset\.pickerKind === 'run'/);
});

test("run configurations are authored in a dialog, not by hand-editing JSON", () => {
  assert.match(html, /id="run-config-dialog"/);
  for (const id of ["run-config-label", "run-config-kind", "run-config-command", "run-config-args", "run-config-cwd", "run-config-ports", "run-config-bind", "run-config-debug-args", "run-config-debug-port", "run-config-members", "run-config-error", "run-config-delete"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(main, /function openRunConfigDialog/);
  assert.match(main, /function readRunConfigForm/);
  assert.match(main, /sendContextRequest\('run\.save'/);
  assert.match(main, /data-action="new-run-config"/);
  assert.match(main, /data-run-edit-id/);
  // A save the sidecar refuses keeps the dialog open with the field it named.
  assert.match(main, /contextPurpose === 'run-save'[\s\S]{0,400}setRunConfigError\(response\.error\.message\)/);
  assert.match(styles, /\.run-dialog-error \{/);
});

test("a Project with no configurations is offered the ones its files already declare", () => {
  assert.match(main, /sendContextRequest\('run\.detect'/);
  assert.match(main, /if \(!runConfigurations\.length\) void sendContextRequest\('run\.detect'/);
  assert.match(main, /data-run-suggestion-id/);
  assert.match(main, /function addRunSuggestion/);
  // The proposal names the file it came from so it can be checked, not trusted.
  assert.match(main, /escapeHTML\(draft\.source\)/);
});

test("the run menu opens even when the Project declares nothing", () => {
  // An empty catalog is exactly when the menu matters: creating the first
  // configuration and the detected proposals are both inside it.
  assert.match(main, /removeAttribute\('disabled'\)/);
  assert.doesNotMatch(main, /run-configuration-button'\)\?\.toggleAttribute\('disabled'/);
  assert.match(main, /'Add configuration'/);
});

test("the run menu separates what the repository offers from what the operator does", () => {
  assert.match(main, /class="picker-divider" role="separator"/);
  assert.match(main, /class="picker-row picker-row-action"/);
  assert.match(styles, /\.picker-row-action \.picker-option strong \{ color: var\(--blue\); \}/);
  // Icons are drawn at the system's stroke weight, never typed as glyphs.
  assert.match(main, /const pickerPlusMark = '<span class="git-option-mark" aria-hidden="true"><svg/);
  assert.doesNotMatch(main, /aria-hidden="true">\+<\/span>/);
  // A compound's several source files belong in the tooltip, not clipped in the row.
  assert.match(main, /draft\.kind === 'compound' \? `\$\{draft\.members\?\.length \?\? 0\} members`/);
  assert.match(main, /title="\$\{escapeHTML\(draft\.source\)\}"/);
});

test("the editor holds more than one file at a time", () => {
  assert.match(html, /id="document-tabs" role="tablist" aria-label="Open files"/);
  assert.match(main, /let openDocuments = \[\];/);
  // One editor instance serves every tab, so the outgoing buffer is folded back
  // into its record before the incoming one is painted.
  assert.match(main, /async function activateDocumentTab[\s\S]*?captureActiveDocumentBuffer\(\);/);
  assert.match(main, /function captureActiveDocumentBuffer\(\)[\s\S]*?record\.buffer = codeEditorValue\(\);/);
  // Opening a file that is already open moves to its tab instead of duplicating it.
  assert.match(main, /async function openFileInADE[\s\S]*?const existing = documentTabByPath\(filePath\);/);
  // Closing a tab with unsaved work asks first, naming the file it would lose.
  assert.match(main, /function closeDocumentTab\(id\)[\s\S]*?requestConfirmation\(/);
  assert.match(main, /Discard unsaved changes to \$\{record\.name\}\?/);
});

test("open files are remembered per Project and per Task", () => {
  // A Task carries its own working set, and files opened with no Task selected
  // are still worth keeping, so the Project holds a slot of its own for them.
  assert.match(main, /const noTaskDocumentScope = '__no-task__';/);
  assert.match(main, /function documentSessionScope\(\)[\s\S]*?task: selectedTaskId \?\? noTaskDocumentScope/);
  assert.match(main, /function persistOpenDocuments\(\)[\s\S]*?stored\[project\] = \{[\s\S]*?\[task\]: \{/);
  // The earlier store held one set per Project; its files are folded in rather
  // than dropped.
  assert.match(main, /function readOpenDocumentSessions\(\)[\s\S]*?Array\.isArray\(entry\.paths\)\) stored\[project\] = \{ \[noTaskDocumentScope\]: entry \}/);
  // One entry point decides when a restore is due, and it claims the scope
  // before its first await so overlapping calls cannot interleave.
  const sync = main.match(/async function syncDocumentScope\(\)[^]*?\n\}/)?.[0] ?? '';
  assert.ok(sync, 'the scope sync must be findable');
  assert.ok(sync.indexOf('documentScopeKey = scope;') < sync.indexOf('documentScopeTransition = documentScopeTransition'), 'the scope is claimed before the restore is queued');
  assert.match(sync, /documentScopeTransition\s*\n?\s*\.then\(\(\) => restoreOpenDocuments\(project, task\)\)/);
  // Restoring is the only caller, so nothing else can load a set out of scope.
  assert.equal((main.match(/restoreOpenDocuments\(/g) ?? []).length, 2, 'restoreOpenDocuments is defined once and called once');
});

test("everything the editor panel toggles with hidden can actually hide", () => {
  // An author `display` outranks the user agent's `[hidden]`, so a rule that
  // sets one without the other leaves the element on screen for good: the
  // empty state stayed up over an open file, and the open-files menu could be
  // opened but never closed.
  const sheets = `${styles}\n${components}`;
  for (const selector of ['.document-empty-state', '.document-tabs-menu', '.document-viewer-status', '.document-content', '.icon-button']) {
    const declaresDisplay = new RegExp(`\\${selector} \\{[^}]*display:`).test(sheets);
    const guarded = sheets.includes(`${selector}[hidden]`) || new RegExp(`\\${selector}\\[hidden\\][^{]*\\{`).test(sheets);
    assert.ok(!declaresDisplay || guarded, `${selector} sets display but never says what [hidden] means`);
  }
});

test("moving between tabs leaves the Explorer where the operator put it", () => {
  // The tree follows the editor only when asked to: opening a file, or the
  // Explorer's own crosshair. Switching and closing tabs do neither, so a tree
  // scrolled and expanded for one job survives reading a second file.
  const activate = main.match(/async function activateDocumentTab\(id[^]*?\n\}/)?.[0] ?? '';
  const closeNow = main.match(/async function closeDocumentTabNow\(id\)[^]*?\n\}/)?.[0] ?? '';
  assert.ok(activate && closeNow, 'the tab activation and close paths must be findable');
  assert.doesNotMatch(activate, /updateWorkspaceFileSelection/);
  assert.doesNotMatch(closeNow, /updateWorkspaceFileSelection/);
  // Exactly two callers move the tree, and this is which.
  const callers = main.match(/^ {2}updateWorkspaceFileSelection\(/gm) ?? [];
  assert.equal(callers.length, 2, 'only opening a file and revealing it may select in the tree');
  assert.match(main, /async function openFileInADE[^]*?updateWorkspaceFileSelection\(filePath\);/);
  assert.match(main, /async function revealSelectedFileBranch[^]*?updateWorkspaceFileSelection\(filePath\);/);
});

test("an editor tab states its file, its location and its unsaved work", () => {
  // Ambiguous basenames earn a parent segment; the rest stay short.
  assert.match(main, /function documentTabLabels\(\)[\s\S]*?counts\.get\(record\.name\) \?\? 0\) < 2/);
  // Unsaved work is a dot that becomes the close cross, so the state is a shape
  // and not only a colour.
  assert.match(styles, /\.document-tab\.dirty \.document-tab-close \.document-tab-dot \{ display: block; \}/);
  assert.match(styles, /\.document-tab\.dirty:hover \.document-tab-close svg[\s\S]*?\{ display: block; \}/);
  assert.match(main, /aria-label="Close \$\{name\}\$\{dirty \? ', discarding unsaved changes' : ''\}"/);
  assert.match(styles, /\.document-tab\.active \{ border-bottom-color: var\(--cyan\);/);
  // Filenames keep the case they have on disk.
  assert.doesNotMatch(styles, /\.document-tab-button \{[^}]*text-transform: uppercase/);
});

test("open files are reachable by keyboard and survive a restart", () => {
  // The strip is a roving tab stop, matching the pattern History and Changes use.
  assert.match(main, /tabindex="\$\{active \? '0' : '-1'\}"/);
  assert.match(main, /documentTabStrip\?\.addEventListener\('keydown'[\s\S]*?event\.key === 'Delete' \|\| event\.key === 'Backspace'/);
  assert.match(main, /documentTabStrip\?\.addEventListener\('keydown'[\s\S]*?event\.key === 'ArrowRight'/);
  assert.match(main, /event\.key !== 'Tab' \|\| !event\.ctrlKey/);
  // A strip that overflows gets a menu; it stays hidden while it does not.
  assert.match(main, /function updateDocumentTabsOverflow\(\)[\s\S]*?more\.hidden = !overflowing;/);
  assert.match(main, /const openDocumentsStorageKey = 'ade-open-documents';/);
  // Restored tabs are read from disk only when they are looked at.
  assert.match(main, /async function restoreOpenDocuments\(project, task\)[\s\S]*?state: 'pending'/);
  assert.match(html, /id="document-empty-state"/);
});

test("the topbar's menus open over the terminal dock, however tall it is", () => {
  // The topbar carries a backdrop filter, which makes it a stacking context
  // whatever its own menus ask for: a menu at z-index 8 inside a topbar below
  // the dock still renders under the dock. Expanded to its full height the
  // dock reaches the topbar, so the two orders have to be right relative to
  // each other, not merely set.
  // Anchored, so a descendant rule elsewhere is not mistaken for the surface's
  // own; the sidebar's collapse animation carries one for the dock.
  const zIndexOf = (selector: string) => {
    const rule = styles.match(new RegExp(`^\\${selector} \\{[^}]*\\}`, 'm'))?.[0] ?? '';
    return Number(rule.match(/z-index: (\d+)/)?.[1] ?? NaN);
  };
  const topbar = zIndexOf('.topbar');
  const dock = zIndexOf('.terminal-dock');
  assert.ok(Number.isFinite(topbar) && Number.isFinite(dock), 'both surfaces state a stacking order');
  assert.ok(topbar > dock, `the topbar (${topbar}) must stack above the terminal dock (${dock})`);
});

test("the sidebar collapses to a rail that still navigates", () => {
  assert.match(html, /data-action="toggle-sidebar"[^>]*aria-expanded="true"[^>]*aria-controls="sidebar"/);
  assert.match(html, /<aside class="sidebar" id="sidebar">/);
  assert.match(main, /if \(item\.dataset\.action === 'toggle-sidebar'\)/);
  // Collapsing narrows the shell without overwriting the chosen width, so
  // expanding returns to it rather than to a default.
  assert.match(main, /function applySidebarWidth\(\)[\s\S]*?sidebarCollapsed \? collapsedSidebarWidth : sidebarWidth/);
  assert.match(main, /const sidebarCollapsedStorageKey = `ade-sidebar-collapsed:\$\{activeProjectId\}`;/);
  // Navigation survives the collapse: labels are clipped, never removed, so
  // each item keeps the name it is announced by, and gains a tooltip.
  assert.match(styles, /\.sidebar-collapsed \.nav-item span \{ position: absolute;[^}]*clip: rect\(0, 0, 0, 0\)/);
  assert.doesNotMatch(styles, /\.sidebar-collapsed \.nav-item span \{[^}]*display: none/);
  assert.match(main, /function setSidebarCollapsed[\s\S]*?if \(collapsed && label\) item\.title = label;/);
  assert.match(styles, /\.sidebar-collapsed \.explorer-section \{ display: none; \}/);
  // Tree focus mode shows only the active item, which would leave one icon.
  assert.match(styles, /\.sidebar-collapsed\.explorer-expanded \.nav-item:not\(\.active\) \{ display: flex; \}/);
  // A hidden grip must leave the tab order rather than resize an invisible pane.
  assert.match(main, /if \(sidebarResizer\) sidebarResizer\.hidden = collapsed;/);
  // The shell animates only while the toggle works it, so dragging stays immediate.
  assert.match(styles, /\.app-shell\.sidebar-animating \{ transition: grid-template-columns/);
  // The collapse control and the resize grip are one pair on one line, so they
  // read the same measured anchor instead of each carrying its own offset.
  assert.match(styles, /\.sidebar-collapse \{ position: absolute; top: var\(--sidebar-control-y, 50%\);/);
  assert.match(styles, /\.sidebar-resizer::after \{ position: absolute; top: var\(--sidebar-control-y, 50%\);/);
  // Measured, because the navigation is taller in the light themes and much
  // shorter in tree focus mode.
  // The line sits in the gap between the two rules, not on either of them.
  assert.match(main, /function syncSidebarControlAnchor\(\)[\s\S]*?\(navBottom \+ gapEnd\) \/ 2 - sidebar\.getBoundingClientRect\(\)\.top/);
  // A hidden Explorer measures as nothing, so the rail falls back to the
  // navigation own margin rather than to a zero.
  assert.match(main, /explorer && explorer\.height > 0 \? explorer\.top : navBottom \+ navMargin/);
  assert.match(main, /function applyTheme[\s\S]*?syncSidebarControlAnchor\(\);/);
  // The navigation animates its own margin and padding on the way to the rail,
  // so one reading taken on the click reads the layout being left behind.
  assert.match(main, /function trackSidebarControlAnchor[\s\S]*?requestAnimationFrame\(step\);/);
  assert.match(main, /function setSidebarCollapsed[\s\S]*?trackSidebarControlAnchor\(\);/);
  assert.match(main, /function updateExplorerMode[\s\S]*?trackSidebarControlAnchor\(\);/);
  assert.match(main, /function setSidebarCollapsed[\s\S]*?prefers-reduced-motion: reduce/);
});

test("the explorer can point at the file the editor is showing", () => {
  assert.match(html, /data-action="reveal-open-file"/);
  // Disabled in the markup: at first paint no document is open yet.
  assert.match(html, /data-action="reveal-open-file"[^>]*disabled/);
  assert.match(main, /if \(item\.dataset\.action === 'reveal-open-file'\)/);
  // It reads the editor's document, not the tree's own selection, which lags
  // behind it once a file is closed.
  assert.match(main, /async function revealOpenFileInExplorer\(\)[\s\S]*?const filePath = activeDocument\?\.path;/);
  // A collapsed or filtered tree has no branch to walk down.
  assert.match(main, /async function revealOpenFileInExplorer\(\)[\s\S]*?if \(!explorerExpanded \|\| filtered\)/);
  assert.match(main, /async function revealOpenFileInExplorer\(\)[\s\S]*?scrollIntoView/);
  assert.match(main, /function updateRevealOpenFileButton\(\)[\s\S]*?button\.disabled = !available;/);
  assert.match(styles, /\.workspace-entry\.just-revealed \{ animation: workspace-reveal/);
  assert.match(styles, /\.icon-button:disabled \{/);
});

test("the brand mark is the product's logo, and it wears the tile's colour", () => {
  assert.match(html, /<span class="brand-mark" aria-hidden="true"><\/span>/);
  assert.doesNotMatch(html, /class="brand-mark">A</);
  assert.match(styles, /--brand-glyph: url\("data:image\/png;base64,[A-Za-z0-9+/=]+"\);/);
  // Masked rather than painted, so a single asset serves every theme's tile.
  assert.match(styles, /\.brand-mark::before \{[^}]*background: currentColor;/);
  assert.match(styles, /\.brand-mark::before \{[^}]*mask: var\(--brand-glyph\) center \/ contain no-repeat;/);
});

test("the terminal dock's tab strip spends its width on the working directory", () => {
  // The mode caption said what the dock already is. It cost a row of space and
  // its second line climbed into the size toggle once run consoles added tabs.
  assert.doesNotMatch(html, /terminal-mode/);
  assert.doesNotMatch(styles, /\.terminal-mode/);
  assert.match(styles, /\.terminal-cwd \{ margin-left: auto;/);
});

test("the expanded terminal stops at the topbar instead of a fixed fraction", () => {
  // Measured, because the topbar's height changes with the theme and the dock
  // is pinned above the status bar.
  assert.doesNotMatch(main, /window\.innerHeight \* 0\.72/);
  assert.match(main, /function terminalHeightBounds\(\)[\s\S]*?\.topbar'\)\?\.getBoundingClientRect\(\)\.bottom/);
  assert.match(main, /function terminalHeightBounds\(\)[\s\S]*?getComputedStyle\(terminalDock\)\.bottom/);
  assert.match(main, /window\.innerHeight - headerBottom - statusBarInset/);
});

test("one button component paints every action control", () => {
  // The shell loads the shared control layer, and the bundle ships it.
  assert.match(html, /href="\/components\.css"/);
  assert.match(desktopBuild, /cpSync\('src\/components\.css', 'dist\/components\.css'\)/);
  // Every role a view can ask for is defined once, in that layer.
  for (const role of ['.button', '.button.primary', '.button.secondary', '.button.accent', '.button.ghost', '.button.danger', '.button.compact', '.button.icon', '.button.block', '.icon-button', '.text-button']) {
    assert.match(components, new RegExp(`\\${role} \\{`), `${role} is not defined in components.css`);
  }
  // `.button.ghost` was carried in the markup long before anything drew it.
  assert.match(html, /class="button ghost"/);
  // A view may place a control; it may not repaint one.
  assert.doesNotMatch(styles, /\.button[.:a-z-]* ?\{[^}]*background:/);
  assert.doesNotMatch(styles, /\.text-button[.:a-z-]* ?\{[^}]*color:/);
  // The retired theme scheme left this hover painting light-theme buttons navy.
  assert.doesNotMatch(styles, /:root:not\(\[data-theme="light"\]\) \.button:hover/);
});

test("adding a Project is a labelled button, not a bare glyph", () => {
  // The catalog's primary action wears the same component as New task, and
  // says what it does instead of leaving a plus sign to imply it.
  assert.match(html, /<button class="button primary compact" type="button" data-action="add-project">New project<\/button>/);
  assert.match(html, /<button class="button primary compact" type="button" data-action="new-task"/);
  assert.match(html, /class="button accent compact agent-new-session"/);
  assert.doesNotMatch(styles, /\.agent-new-session[^{]*\{[^}]*(background|border-radius|font):/);
});

test("a writing turn's way back is offered where the Task is judged", () => {
  // A turn that could write had no restore point: the operator's only way back
  // was a Git incantation ADE never mentioned.
  assert.match(main, /function taskCheckpointsMarkup/);
  assert.match(main, /<h3 class="task-trace-heading">Checkpoints<\/h3>\$\{taskCheckpointsMarkup\(detail\)\}/);
  assert.match(main, /data-action="restore-checkpoint"/);
  // Going back discards what the turn wrote, so it is confirmed explicitly and
  // says that the restore is itself undoable.
  assert.match(main, /if \(item\.dataset\.action === 'restore-checkpoint'\)/);
  assert.match(main, /requestConfirmation\(\{\s*\n\s*eyebrow: 'RESTORE'/);
  assert.match(main, /tone: 'danger',\s*\n\s*\}, \(\) => nativeInvoke\('sidecar_request', \{ request: JSON\.stringify\(\{ id: `checkpoint-restore/);
  assert.match(main, /method: 'task\.checkpoint\.restore', params: \{ checkpointId, actor: 'human', reason: .*confirmed: true \}/);
  // Having a checkpoint is the expectation and stays quiet; not having one is
  // what the operator must hear before the turn writes.
  assert.match(main, /if \(response\.type === 'agent\.checkpoint'\)/);
  assert.match(main, /if \(!response\.available\) notify\(`No checkpoint for this turn/);
  assert.match(main, /function requestTaskDetail/);
});

test("what a turn cost is read where the work is, and silence is not zero", () => {
  // Every turn had been recorded in agent_turn_usage since ADR-0040 and no
  // surface read it: the conversation and the Task could not say what they had
  // spent.
  assert.match(main, /function usageParts/);
  assert.match(main, /cached` : ''/);
  // Cache is told apart from input rather than folded into it.
  assert.doesNotMatch(main, /trace\.usage\.inputTokens \+ trace\.usage\.cacheReadInputTokens/);
  assert.match(main, /\.\.\.\(trace\.usage \? usageParts\(trace\.usage\) : \[\]\)/);
  // The conversation total lives under the dials that say what is left.
  assert.match(html, /<p class="agent-usage" id="agent-usage">Spend unknown<\/p>/);
  assert.match(main, /function renderAgentUsage/);
  assert.match(main, /method: 'agent\.usage', params: \{ sessionId \}/);
  // A conversation or Task nobody priced says so; it is never rendered as free.
  assert.match(main, /'Spend not reported by this agent'/);
  assert.match(main, /escapeHTML\(usage \?\? 'not reported for this Task'\)/);
  assert.match(main, /host\.dataset\.known = summary \? 'true' : 'false'/);
  assert.match(styles, /\.agent-usage\[data-known="false"\] \{ color: var\(--faint\)/);
  // A turn is the unit that gets accounted for, so a turn ending refreshes it.
  assert.match(main, /requestAgentUsage\(activeAgentSessionId\);/);
});

test("the app says which version it is and whether a newer one exists", () => {
  // Installing was replacing a bundle by hand, and the app could not tell it
  // was out of date because nothing ever asked.
  assert.match(html, /<span class="status-version" id="status-version">Assay<\/span>/);
  assert.match(main, /function renderAppVersion/);
  assert.match(main, /method: 'app\.update\.check', params: \{ currentVersion: version \}/);
  assert.match(main, /window\.__TAURI__\?\.app\?\.getVersion/);
  assert.match(styles, /\.status-version\[data-update="true"\] \{ color: var\(--amber\)/);
  // Saying it is the whole of it: the shell never downloads or replaces itself.
  assert.doesNotMatch(main, /sidecar_request[^\n]*app\.update\.(install|download)/);
  // Unreachable and unconfigured are said as themselves, not as being current.
  assert.match(main, /Could not reach the release feed/);
  assert.match(main, /No release feed is configured for this install/);
});

test("a reading the shell asked for on its own never becomes a failed operation", () => {
  // Switching between past conversations raised the modal error dialog with
  // "Unknown method: agent.usage" whenever the app was still running a sidecar
  // older than the shell. Nothing the operator did had failed.
  assert.match(main, /if \(String\(response\.id\) === String\(agentUsageRequestId\)\) \{\s*\n\s*agentSessionUsage = null;/);
  assert.match(main, /if \(String\(response\.id\) === String\(appUpdateRequestId\)\) \{\s*\n\s*renderAppVersion\(appVersion, \{ status: 'UNREACHABLE'/);
  // Both branches answer before the dialog, which stays for operations the
  // operator actually attempted.
  const errorBranch = main.slice(main.indexOf("if (String(response.id) === String(agentUsageRequestId))"), main.indexOf("showOperationError(response.error, contextPurpose)"));
  assert.match(errorBranch, /return;/);
});

test("a Task says what done means before work starts, and where it is judged", () => {
  // The Task carried one free-text intent, and the reviewer, the gates and the
  // human all judged against nothing written down.
  assert.match(html, /<label for="task-acceptance">Acceptance criteria<\/label>/);
  assert.match(html, /id="task-acceptance" rows="4"[^>]*required/);
  assert.match(main, /if \(!acceptanceCriteria\.length\) \{ notify\('Write at least one acceptance criterion\.'\)/);
  assert.match(main, /params: \{ taskId, intent, acceptanceCriteria, projectId: activeProjectId/);
  // It is read immediately above the controls that judge against it.
  assert.match(main, /\$\{taskAcceptanceMarkup\(task\)\}\$\{taskGovernanceMarkup\(detail\)\}/);
  assert.match(main, /function taskAcceptanceMarkup/);
  // Changing the bar is a recorded decision, not an edit in place.
  assert.match(main, /method: 'task\.acceptance', params: \{ taskId, acceptanceCriteria, reason: /);
  assert.match(styles, /\.task-acceptance-list \{/);
  // The packaged smoke states a bar too, because its Task becomes READY.
  assert.match(smokeBundle, /acceptanceCriteria: \["smoke-result\.txt exists in the repository root"\]/);
});

test("re-review runs on the operator's agent, not on a single wired-in one", () => {
  // The gate that decides whether work passes was reachable by OpenCode alone,
  // so an operator working with Claude or Codex could produce changes the
  // product could never review.
  assert.match(main, /method: 'task\.rereview', params: \{ taskId, provider: selectedProvider,/);
  assert.match(main, /notify\(`Re-review started with \$\{selectedProvider\}\.`\)/);
});

test("preferences belong to the operator and live where the sidecar can read them", () => {
  // Every preference lived in the webview's storage, invisible to the sidecar,
  // which is why the remote notice and a configurable release feed were stuck.
  assert.match(html, /id="settings-dialog"/);
  assert.match(html, /data-action="open-settings"/);
  assert.match(html, /id="settings-turn-chime"/);
  assert.match(html, /id="settings-update-feed"/);
  assert.match(main, /method: 'settings\.read'/);
  assert.match(main, /method: 'settings\.write', params: \{ settings: patch \}/);
  // The chime and the default model now write to the store as well.
  assert.match(main, /void saveUserSettings\(\{ turnChime: enabled \}\)/);
  assert.match(main, /void saveUserSettings\(\{ defaultModels:/);
  // What this webview already remembered is carried over once, not reset.
  assert.match(main, /function migrateLocalPreferences/);
  assert.match(main, /if \(migration\) void saveUserSettings\(migration\)/);
});

test("an install with no Project says so instead of naming one", () => {
  // A fresh install showed "ADE" as the open Project: the startup fixture
  // carried that name, and the shell asked for a Project id the environment
  // invented, so the snapshot failed and the fixture stayed on screen.
  assert.match(snapshot, /id: '',\n\s*name: '',/);
  assert.doesNotMatch(snapshot, /name: 'ADE'/);
  assert.match(main, /const hasProject = Boolean\(activeProject\.id && activeProject\.repositoryPath\)/);
  // Project, Task and branch say "none" with the same mark, so the context row
  // does not read as three different kinds of empty.
  assert.match(main, /const noneLabel = '—';/);
  assert.match(html, /id="current-repository-name">—</);
  assert.match(html, /id="current-task-name">—</);
  assert.match(main, /name\.textContent = selected\?\.intent \?\? noneLabel/);
  assert.doesNotMatch(main, /'No task'/);
  assert.match(main, /'project-name': hasProject \? activeProject\.name : noneLabel/);
  assert.match(main, /repositoryName\.textContent = hasProject \? activeProject\.name : noneLabel/);
  // Which Project opens comes from what is registered, not from a guess.
  assert.match(main, /preferredProjectId = \(await invoke\('project_id'\)\) \|\| null;/);
  assert.match(main, /const opening = registeredProjects\.find\(\(project\) => project\.id === preferredProjectId\) \?\? registeredProjects\[0\];/);
  assert.match(main, /setSyncState\('ready', 'No project registered'\)/);
  // A Project that is gone empties the shell rather than leaving a ghost.
  assert.match(main, /if \(response\.error\.code === 'PROJECT_NOT_FOUND'\)/);
});

test("the context pills sit on the same line as the controls beside them", () => {
  // The bar carries a definite height, which makes the `stretch` it inherits
  // inert: the box was placed at the start of a taller topbar, so Project, Task
  // and branch rode ten pixels above the run controls next to them.
  const bar = styles.match(/\.git-context-bar \{ height: 42px;[^}]*\}/)?.[0] ?? "";
  assert.match(bar, /align-self: center/);
});

test("every workbench stands on the same ground", () => {
  // Projects rendered on the ground colour while Agents, Editor and Version
  // control sat on a lighter panel or on the chrome tone, so the same
  // application changed shade depending on which entry was clicked.
  assert.match(styles, /\.agents-workspace \{[^}]*background: var\(--workbench\)/);
  assert.match(styles, /\.agent-session-rail, \.agent-thread \{[^}]*background: var\(--workbench\)/);
  assert.match(styles, /\.document-viewer-panel \{[^}]*background: var\(--workbench\)/);
  assert.match(styles, /\.changes-workspace \{[^}]*background: var\(--workbench\)/);
  assert.match(styles, /\.git-commit-list \{ background: var\(--workbench\); \}/);
  assert.match(styles, /\.pending-files-pane \{[^}]*background: var\(--workbench\)/);
  // One ground, named, and each theme says what it is: the window colour in
  // the dark theme, Everest's editor background against the chrome in light.
  assert.match(styles, /--bg: #0f1724; --workbench: #0f1724;/);
  assert.match(styles, /--bg: #e4ecef; --workbench: #fdfeff;/);
  // What floats still differs from what it floats over, and the chrome keeps
  // its own tone: sidebar, terminal dock and status bar are not workbenches.
  assert.match(styles, /\.git-context-menu \{[^}]*background: var\(--panel\)/);
  assert.match(styles, /\.task-dialog \{[^}]*background: var\(--panel\)/);
  assert.match(styles, /\.sidebar \{[^}]*background: var\(--chrome\)/);
  assert.match(styles, /\.status-bar \{[^}]*background: var\(--chrome\)/);
});

test("a file can be moved to a window of its own, and moved is not copied", () => {
  // Multi-monitor work needed a file out of the shell. What it must never mean
  // is two windows holding the same buffer with their own dirty state.
  // The button that used to trigger this is gone -- dragging a tab off the
  // strip is the only entry point now -- but the subsystem it called stays.
  assert.doesNotMatch(html, /data-action="detach-document"/);
  assert.doesNotMatch(main, /function detachActiveDocument/);
  assert.match(main, /const detachedDocuments = new Map\(\);/);
  assert.match(main, /if \(record\) await closeDocumentTabNow\(record\.id\);/);
  // Unsaved work is written before the handover, because the new window reads
  // the file from disk.
  assert.match(main, /title: `Save \$\{pathBaseName\(filePath\)\} before moving it\?`/);
  assert.match(main, /await saveActiveDocument\(\);\s*\n\s*await openDocumentWindow\(filePath\);/);
  // The same file is never owned twice: the tree and the action both defer to
  // the window that already has it, and closing it hands the file back.
  assert.match(main, /const detachedLabel = detachedDocuments\.get\(filePath\);/);
  assert.match(main, /function reattachDocument/);
  assert.match(main, /await listen\('editor-window:closed'/);
});

test("the document window carries an editor and none of the shell", () => {
  assert.match(editorWindow, /createCodeEditorSurface/);
  assert.match(editorWindow, /invoke\('read_file', \{ path: filePath \}\)/);
  assert.match(editorWindow, /invoke\('write_file', \{ path: filePath, content: surface\.value\(\) \}\)/);
  // The webview never answers the browser's own confirm, so the unsaved
  // question is asked in the page, with all three answers a person has.
  assert.doesNotMatch(editorWindow, /window\.confirm/);
  assert.match(editorWindow, /function askBeforeClosing/);
  assert.match(editorWindowHtml, /value="discard">Close without saving/);
  assert.match(editorWindowHtml, /value="save"[^>]*>Save and close/);
  assert.match(editorWindow, /if \(answer === 'cancel'\) return;/);
  // It has no reason to open further windows, and its capability says so.
  assert.deepEqual(editorCapability.windows, ["editor-*"]);
  assert.equal(editorCapability.permissions.includes("core:webview:allow-create-webview-window"), false);
  assert.equal(defaultCapability.permissions.includes("core:webview:allow-create-webview-window"), true);
  // And it is built: a page nobody bundles is a page nobody can open.
  assert.match(desktopBuild, /entryPoints: \['src\/main\.js', 'src\/editor-window\.js'\]/);
  assert.match(desktopBuild, /cpSync\('src\/editor-window\.html', 'dist\/editor-window\.html'\)/);
});

test("a tab carried off the strip becomes its own window", () => {
  // Three attempts are worth remembering: the HTML drag reported nothing usable
  // about a drop that left the window, pointer events never arrived at all, and
  // mouse events are what this WebView sends.
  assert.match(main, /documentTabStrip\?\.addEventListener\('mousedown'/);
  assert.match(main, /document\.addEventListener\('mouseup', finishTabDrag, true\);/);
  assert.doesNotMatch(main, /draggable="true"/);
  assert.doesNotMatch(main, /addEventListener\('pointerdown', \(event\) => \{\s*\n\s*if \(event\.button/);
  // Leaving the strip is the gesture; the window's own bounds are not the test.
  assert.match(main, /function droppedOffTheStrip/);
  assert.match(main, /documentTabStrip\?\.getBoundingClientRect\(\)/);
  assert.doesNotMatch(main, /scaleFactor\(\)/);
  // Something follows the cursor, because the native drag image left with the
  // approach that did not work.
  assert.match(main, /ghost\.className = 'tab-ghost';/);
  assert.match(main, /state\.ghost\?\.remove\(\);/);
  assert.match(main, /ghost\.classList\.toggle\('leaving', droppedOffTheStrip/);
  assert.match(styles, /\.tab-ghost \{ position: fixed;/);
  assert.match(styles, /\.tab-ghost\.leaving \.tab-ghost-hint \{ display: inline; \}/);
  // A press that never travelled is a click, not a drag.
  assert.match(main, /if \(!state\.dragging\) return;/);
  assert.match(main, /Math\.hypot\(event\.clientX - tabDragState\.startX/);
  // Every tab can be picked up. Whether it can go is answered when it lands,
  // because a tab that refuses to be lifted teaches the operator nothing.
  assert.match(main, /if \(record && record\.state !== 'ready'\) \{ notify\(`\$\{record\.name\} is still being read\.`\); return; \}/);
  assert.match(main, /if \(record && record\.kind !== 'text'\) \{ notify\(`\$\{record\.name\} cannot be edited in its own window\.`\); return; \}/);
  // Any tab can leave, not only the one in front.
  assert.match(main, /async function detachDocument\(documentId\)/);
  assert.match(main, /if \(documentId && documentId !== activeDocumentId\) await activateDocumentTab\(documentId\);/);
});

test("the Explorer filter searches the operator's files, not their dependencies", () => {
  // A one-letter query walked the whole tree — in this repository that is
  // 64,574 files, of which 63,733 are .git and node_modules — and the tree then
  // tried to draw every match. The filter looked like it had stopped working.
  // The repository already says which files are the operator's, so nothing has
  // to guess that this project builds into `target` and the next one does not.
  assert.match(nativeShell, /fn files_git_knows_about\(root: &Path\) -> Option<Vec<PathBuf>>/);
  assert.match(nativeShell, /"ls-files", "-z", "-c", "-o", "--exclude-standard"/);
  // Without Git there is no such list, so the walk stays as the fallback.
  assert.match(nativeShell, /None => collect_matching_files\(&root, 0, &needle, &mut entries\)\?,/);
  assert.match(nativeShell, /const UNSEARCHED_DIRECTORIES: \[&str; 2\] = \[".git", "node_modules"\];/);
  assert.match(nativeShell, /if UNSEARCHED_DIRECTORIES\.contains\(&folder\.as_str\(\)\) \{\s*\n\s*continue;/);
  assert.match(nativeShell, /const SEARCH_RESULT_LIMIT: usize = 200;/);
  assert.match(nativeShell, /entries\.truncate\(SEARCH_RESULT_LIMIT\);/);
  // A name match is what was being looked for; a path match is its neighbour.
  assert.match(nativeShell, /let named = !forward_slashed\(&entry\.name\)\.contains\(&needle\);/);
  // A list that quietly ends would read as "there is nothing else".
  assert.match(main, /const capped = matches\.length >= workspaceSearchLimit;/);
  assert.match(main, /First \$\{workspaceSearchLimit\} matches\. Narrow the filter to see the rest\./);
  assert.match(styles, /\.workspace-search-capped \{/);
});

test("what this session added behaves the same on Windows as on macOS", () => {
  // The seven platform boundaries are declared in SPEC-cross-platform-support;
  // these are the places the new work could have quietly added an eighth.
  // A search compares both sides in one spelling, so a typed "src/main" finds
  // "src\main" where that is how the platform stores it.
  assert.match(nativeShell, /fn forward_slashed\(value: &str\) -> String \{/);
  assert.ok(nativeShell.includes(`value.to_lowercase().replace('\\\\', "/")`), "the search should compare separators in one spelling");
  assert.match(nativeShell, /let needle = forward_slashed\(&needle\);/);
  // Windows spells a directory however it was created, so the skip list is
  // compared in one case.
  assert.match(nativeShell, /let folder = entry\.file_name\(\)\.to_string_lossy\(\)\.to_lowercase\(\);/);
  // Windows will not delete a file another program holds open, and a restore
  // that stopped at the first one would leave neither state.
  assert.match(checkpointModule, /const locked: string\[\] = \[\];/);
  assert.match(checkpointModule, /catch \{ locked\.push\(path\); \}/);
  assert.match(main, /held open by another program and stayed/);
  // Each supported target builds the installer it can build, and refuses
  // unknown platforms instead of half-producing one.
  assert.match(releaseScript, /!\['darwin', 'win32', 'linux'\]\.includes\(process\.platform\)/);
  assert.match(releaseScript, /No installer is produced for \$\{process\.platform\}/);
});

test("nothing Assay runs for itself opens a console on Windows", () => {
  // The sidecar is a copy of node.exe with a payload injected, so it carries
  // Node's console subsystem, and CreateProcess gives a console application a
  // console of its own unless the parent says otherwise at spawn time. An
  // install on Windows showed a terminal nobody could close.
  assert.match(nativeShell, /fn without_a_console\(command: &mut Command\) -> &mut Command \{/);
  assert.match(nativeShell, /const CREATE_NO_WINDOW: u32 = 0x0800_0000;/);
  assert.match(nativeShell, /command\.creation_flags\(CREATE_NO_WINDOW\)/);
  // Every branch — node, the packaged binary, its .cmd shim — meets one spawn.
  assert.match(nativeShell, /let mut child = without_a_console\(&mut command\)/);
  // A window the operator asked for stays a window: opening a terminal is the
  // escape hatch, not infrastructure.
  const openTerminal = nativeShell.slice(nativeShell.indexOf("fn open_terminal_at"), nativeShell.indexOf("fn open_terminal_at") + 900);
  assert.doesNotMatch(openTerminal, /without_a_console/);
  // The sidecar's own children would each be given a console in turn, so the
  // shared launch paths hide them.
  assert.match(safeCommand, /windowsHide: true/);
  assert.match(gitCommand, /windowsHide: true/);
  // And the build says why the executable is like that, where someone would look.
  assert.match(sidecarBuild, /inherits Node's PE subsystem, which is `console`/);
});

test("every tool Assay runs is found the same way", () => {
  // A desktop launch inherits a short PATH, so each tool resolves through an
  // explicit override, then the operator's PATH, then the places installers
  // use. gh was the one adapter still trusting a bare name.
  assert.match(githubStatus, /execFile\(ghExecutable\(\), \["auth", "status"\]/);
  assert.doesNotMatch(githubStatus, /execFile\("gh"/);
  assert.match(ghCommand, /environment\.ADE_GH_COMMAND\?\.trim\(\)/);
  // And the native side looks where the sidecar's own resolver looks, so a
  // Node installed by a version manager is not invisible to one of them.
  for (const directory of ["scoop", "volta", "chocolatey"]) {
    assert.ok(nativeShell.includes(directory), `resolve_node_binary should know about ${directory}`);
  }
});

test("an update nobody built for this machine does not ask to be installed", () => {
  // The release script only produces a macOS artifact, so on Windows the check
  // resolved to "available" with nothing to install — a badge asking for an
  // action the operator could not take, permanently.
  assert.match(main, /const elsewhere = update\?\.status === 'UPDATE_NOT_BUILT_FOR_THIS_PLATFORM';/);
  assert.match(main, /\$\{update\.latestVersion\} elsewhere/);
  assert.match(main, /but not built for \$\{update\.platform\}\. There is nothing to install here yet\./);
  // Only a release carrying something installable here lights the badge.
  assert.match(main, /host\.dataset\.update = newer \? 'true' : 'false';/);
});

test("a Windows install is packaged as something a machine will accept", () => {
  // Two windows meant two sidecars writing the same SQLite file. A second
  // launch is a request for the window that already exists.
  assert.match(nativeShell, /tauri_plugin_single_instance::init/);
  assert.match(nativeShell, /window\.set_focus\(\);/);
  assert.match(nativeCargo, /tauri-plugin-single-instance/);
  // node.exe is signed, and injecting the payload breaks that signature.
  // Windows reads a broken signature as tampering — worse than unsigned.
  assert.match(sidecarBuild, /stripAuthenticodeSignature\(seaExecutable\)/);
  assert.match(peSignature, /export function stripAuthenticodeSignature/);
  // What happens with no WebView2 present is declared rather than inherited
  // from whichever Tauri version happens to be installed.
  assert.deepEqual(tauriConfig.bundle.windows.webviewInstallMode, { type: "downloadBootstrapper", silent: true });
});

test("a release is built per machine and assembled into one manifest", () => {
  // Only macOS artifacts were produced, so every Windows install was told a
  // newer version existed with nothing behind it. The script now builds what
  // the machine it runs on can build.
  assert.match(releaseScript, /function windowsArtifact\(\)/);
  assert.match(releaseScript, /function linuxArtifact\(\)/);
  assert.match(releaseScript, /\$\{productName\}-\$\{version\}-ubuntu-\$\{arch\}\.deb/);
  assert.match(releaseScript, /build\('desktop:build'\)/);
  // Tauri names the installer; taking what it produced beats guessing the
  // spelling, which a rename would silently break.
  assert.match(releaseScript, /\['nsis', 'msi'\]/);
  assert.doesNotMatch(releaseScript, /_x64-setup\.exe`/);
  // npm is a .cmd shim there, which Node cannot spawn without a shell.
  assert.match(releaseScript, /shell: process\.platform === 'win32'/);
  // Each machine knows about one artifact, so the manifest is merged rather
  // than rewritten: whoever runs last must not erase the other platform.
  assert.match(releaseScript, /mergeManifest\(existing, \{/);
  assert.match(releaseManifest, /export function mergeManifest/);
  assert.match(releaseManifest, /existing\.version === release\.version/);
});

test("the Ubuntu package declares desktop metadata and runtime dependencies", () => {
  assert.equal(tauriConfig.bundle.category, "DeveloperTool");
  assert.equal(tauriConfig.bundle.license, "MIT");
  assert.equal(tauriConfig.bundle.linux.deb.section, "devel");
  assert.deepEqual(tauriConfig.bundle.linux.deb.depends, [
    "libwebkit2gtk-4.1-0",
    "libgtk-3-0",
    "libayatana-appindicator3-1",
    "librsvg2-2",
  ]);
});

test("a version tag publishes Linux, macOS and Windows artifacts", () => {
  assert.match(desktopReleaseWorkflow, /tags: \['v\*'\]/);
  assert.match(desktopReleaseWorkflow, /workflow_dispatch/);
  assert.match(desktopReleaseWorkflow, /contents: write/);
  assert.match(desktopReleaseWorkflow, /ubuntu-latest/);
  assert.match(desktopReleaseWorkflow, /macos-latest/);
  assert.match(desktopReleaseWorkflow, /windows-latest/);
  assert.match(desktopReleaseWorkflow, /npm run desktop:package/);
  assert.match(desktopReleaseWorkflow, /dpkg-deb --info/);
  assert.match(desktopReleaseWorkflow, /xvfb-run --auto-servernum npm run desktop:smoke/);
  assert.match(desktopReleaseWorkflow, /assemble-release-manifest\.mjs/);
  assert.match(desktopReleaseWorkflow, /gh release upload/);
  assert.match(desktopReleaseWorkflow, /release\/latest\.json/);
});

test("History shows the commits that exist, not the ones it read on the way in", () => {
  // A commit made in the terminal below stayed invisible until the operator
  // thought to press Refresh, because nothing re-read the repository.
  // Pressing a tab is a question, and answering it with what was already on
  // screen is how an operator learns to distrust the view. Only the moments
  // nobody asked for are coalesced.
  assert.match(main, /renderVersionControlTabs\(tab\);\s*\n\s*\/\*\*[\s\S]*?\*\/\s*\n\s*requestVersionControlData\(workspaceRootPath, \{ force: true \}\);/);
  assert.match(main, /function refreshVersionControlOnReturn/);
  assert.match(main, /window\.addEventListener\('focus', refreshVersionControlOnReturn\);/);
  assert.match(main, /document\.addEventListener\('visibilitychange', refreshVersionControlOnReturn\);/);
  assert.match(main, /if \(activeView !== 'changes' \|\| document\.hidden\) return;/);
  // No timer polls Git on the chance that something changed.
  assert.doesNotMatch(main, /setInterval\([^)]*requestVersionControlData/);
  // Overlapping moments cost one read, and the manual control still forces one.
  assert.match(main, /if \(!force && Date\.now\(\) - versionControlLoadedAt < versionControlFreshMs\) return;/);
  assert.match(main, /requestVersionControlData\(workspaceRootPath, \{ force: true \}\);/);
});

test("a search is only ever cancelled by another search", () => {
  // One counter answered two questions — "is this tree render current" and "is
  // this search current" — and the six places that invalidate the tree were
  // silently cancelling searches that were still in flight.
  assert.doesNotMatch(main, /workspaceSearchToken/);
  assert.match(main, /let workspaceTreeToken = 0;/);
  assert.match(main, /let workspaceSearchId = 0;/);
  assert.match(main, /if \(search !== workspaceSearchId\) return;/);
  assert.match(main, /if \(requestToken !== null && requestToken !== workspaceTreeToken\) return;/);
  // A search that fails says what the system said, rather than a shrug.
  assert.match(main, /File search unavailable: \$\{escapeHTML\(error instanceof Error \? error\.message : String\(error\)\)\}/);
});

test("a tree load never paints over a live filter", () => {
  // Search results used to arrive after seconds, so they landed last. Once the
  // search became fast the order flipped: an unguarded tree load painted the
  // whole tree over results that had already arrived, and the file appeared
  // and vanished — or never appeared at all.
  assert.match(main, /const filtering = Boolean\(document\.getElementById\('workspace-filter'\)\?\.value\.trim\(\)\);/);
  assert.match(main, /if \(filtering && !replacesFilter && requestToken === null\) return;/);
  // One case outranks the filter: the Project changed, and results from the
  // previous one must not survive — so the box is cleared with it.
  assert.match(main, /if \(filter\) filter\.value = '';\s*\n\s*await loadWorkspaceTree\(workspaceRootPath, nativeInvoke, \{ animate: true, replacesFilter: true \}\);/);
});

test("the Task detail shows where the workflow has the Task, and says when it is off", () => {
  assert.match(main, /function taskWorkflowMarkup/);
  assert.match(main, /\$\{taskWorkflowMarkup\(detail\)\}/, "the markup is actually rendered, not merely defined");
  assert.match(main, /switched off for this Project or operator/);
  assert.match(main, /not being conducted yet/, "off and not-yet-started are different states");
  assert.match(main, /task-workflow-halt/, "a halt waiting on a person cannot look like an ordinary note");
  assert.match(components, /\.task-workflow-halt/);
});

test("the workflow surface reports the attempt and why the work came back", () => {
  assert.match(main, /attempt \$\{attempt\}/);
  assert.match(main, /goes up a tier/);
  assert.match(main, /Came back here/);
});

test("preferences let the operator switch the workflow off, and say who can overrule them", () => {
  assert.match(html, /id="settings-development-workflow"/);
  assert.match(html, /A Project can require or refuse this in its own policy, and its answer wins/);
  assert.match(main, /developmentWorkflow: settings\?\.developmentWorkflow !== false/, "an unstated preference reads as on");
  assert.match(main, /saveUserSettings\(\{ turnChime, developmentWorkflow, updateFeedUrl \}\)/);
});

test("file-type icons are vendored, mapped, and copied into the build", () => {
  const fileIconMap = readFileSync(new URL("../desktop/src/file-icon-map.js", import.meta.url), "utf8");
  const fileIconLicense = readFileSync(new URL("../desktop/src/file-icons/LICENSE", import.meta.url), "utf8");
  const desktopBuild = readFileSync(new URL("../desktop/build.mjs", import.meta.url), "utf8");
  assert.match(desktopBuild, /cpSync\('src\/file-icons', 'dist\/file-icons'/);
  assert.match(fileIconMap, /export function iconForFileName/);
  assert.match(fileIconMap, /'package\.json': 'nodejs'/);
  assert.match(fileIconMap, /ts: 'typescript'/);
  // Broad, not just the handful covered on day one -- every value below is a
  // vendored file, not a guess (see desktop/src/file-icons/).
  assert.match(fileIconMap, /dart: 'dart'/);
  assert.match(fileIconMap, /db: 'database'/);
  assert.match(fileIconMap, /'\.gitkeep': 'git'/);
  assert.match(fileIconMap, /if \(lower\.endsWith\('\.css\.map'\)\) return 'css-map';/);
  assert.match(fileIconLicense, /MIT License/);
  for (const icon of ["typescript", "javascript", "rust", "python", "json", "markdown", "folder-base"]) {
    assert.ok(existsSync(new URL(`../desktop/src/file-icons/${icon}.svg`, import.meta.url)), `missing vendored icon: ${icon}.svg`);
  }
});

test("Explorer file and directory icons come from the vendored set, not a generic glyph", () => {
  // An unmapped extension keeps the original CSS-drawn glyph -- never a
  // broken <img> -- see file-icon-map.js#iconForFileName's null fallback.
  assert.match(main, /import \{ iconForFileName \} from '\.\/file-icon-map\.js';/);
  assert.match(main, /const icon = iconForFileName\(entry\.name\);/);
  assert.match(main, /src="file-icons\/\$\{icon\}\.svg"/);
  assert.match(main, /src="file-icons\/folder-base\.svg"/);
  assert.match(styles, /\.workspace-file-icon, \.workspace-folder-icon \{/);
});

test("the tree expand/collapse control lives in the sidebar gap, not the Explorer row", () => {
  // Moved next to .sidebar-collapse, which already floats in this same gap
  // via --sidebar-control-y (computed by syncSidebarControlAnchor) -- centered
  // instead of pinned to the right edge, and hidden with the rest of the
  // Explorer whenever the sidebar itself collapses.
  assert.match(html, /class="icon-button sidebar-tree-toggle" type="button" data-action="toggle-explorer"/);
  assert.doesNotMatch(html, /class="explorer-actions">[\s\S]{0,400}data-action="toggle-explorer"/);
  assert.match(styles, /\.sidebar-tree-toggle \{[^}]*top: var\(--sidebar-control-y, 50%\)[^}]*left: 50%/);
  assert.match(styles, /\.sidebar-collapsed \.sidebar-tree-toggle \{ display: none; \}/);
});

test("the Explorer offers New File / New Directory, not just Refresh", () => {
  // A toolbar action and a positioned context menu, both landing on the
  // same name dialog — see SPEC-explorer-new-file-folder.md.
  assert.match(html, /data-action="new-workspace-entry"/);
  assert.match(html, /id="workspace-context-menu"[\s\S]*data-action="new-workspace-file"[\s\S]*data-action="new-workspace-directory"/);
  assert.match(html, /id="new-entry-dialog"/);
  assert.match(html, /id="new-entry-name"/);
  assert.match(styles, /\.workspace-context-menu \{/);
});

test("Explorer entries can open an integrated terminal there, or reveal in the file manager", () => {
  assert.match(html, /id="workspace-context-menu"[\s\S]*data-action="open-workspace-entry-terminal"[\s\S]*data-action="reveal-workspace-entry-in-file-manager"/);
  assert.match(main, /function createTerminalTab\(\{[\s\S]{0,200}cwd = workspaceRootPath[\s\S]{0,50}\} = \{\}\)/);
  assert.match(main, /completionCwd: cwd,/);
  assert.match(main, /nativeInvoke\('terminal_start', \{ sessionId: tab\.id, cwd: tab\.completionCwd \}\)/);
  assert.match(main, /function openWorkspaceEntryInTerminal/);
  assert.match(main, /function revealWorkspaceEntryInFileManager/);
  assert.match(main, /nativeInvoke\('reveal_in_file_manager', \{ path \}\)/);
});

test("the Explorer context menu offers Rename and Delete for an existing entry", () => {
  assert.match(html, /id="workspace-context-menu"[\s\S]*data-action="rename-workspace-entry"[\s\S]*data-action="delete-workspace-entry"/);
  assert.match(html, /id="rename-entry-dialog"/);
  assert.match(html, /id="rename-entry-name"/);
});

test("Delete confirms then closes affected tabs; Rename updates an open tab in place", () => {
  assert.match(main, /function deleteWorkspaceEntryFromUI/);
  assert.match(main, /nativeInvoke\('delete_workspace_entry', \{ path \}\)/);
  assert.match(main, /await closeDocumentTabNow\(record\.id\)/);
  assert.match(main, /function openRenameEntryDialog/);
  assert.match(main, /nativeInvoke\('rename_workspace_entry', \{ path, name \}\)/);
  assert.match(main, /openTab\.relativePath = documentRelativePath\(renamedPath\)/);
});

test("clicking a directory selects it, and New targets the selection first", () => {
  // A directory click still toggles expand/collapse; it also now becomes the
  // create target, ahead of the open file's parent and ahead of the root —
  // see SPEC-explorer-selection-and-drag-drop.md.
  assert.match(main, /let selectedDirectoryPath = null;/);
  assert.match(main, /entry\.path === selectedDirectoryPath/);
  assert.match(main, /function relevantWorkspaceDirectory\(\) \{[\s\S]{0,300}selectedDirectoryPath[\s\S]{0,300}\n\}/);
});

test("a file or directory can be dragged into another directory, or to root", () => {
  // Same mousedown/mousemove/mouseup + ghost mechanism as detaching a
  // document tab into its own window (see "a tab carried off the strip..."
  // above) -- HTML5 draggable/drag events were tried there first and dropped
  // for reporting nothing usable about a drop that left the window in this
  // WebView, so this feature never reaches for them either.
  assert.doesNotMatch(main, /data-directory-path="\$\{path\}"[^>]*draggable="true"/);
  assert.doesNotMatch(main, /data-file-path="\$\{path\}"[^>]*draggable="true"/);
  assert.match(main, /function isDescendantOrSame/);
  assert.match(main, /function trackWorkspaceDrag/);
  assert.match(main, /function finishWorkspaceDrag/);
  assert.match(main, /nativeInvoke\('move_workspace_entry', \{ sourcePath: state\.sourcePath, destinationDirectoryPath: target\.path \}\)/);
  assert.match(styles, /\.workspace-entry\.dragging \{/);
  assert.match(styles, /\.workspace-entry\.workspace-drop-target \{/);
  assert.match(styles, /#workspace-tree\.workspace-drop-target \{/);
  assert.match(styles, /\.workspace-drag-ghost \{/);
});

test("creating or moving an entry into a directory reveals it there", () => {
  // A full loadWorkspaceTree() call resets every directory back to
  // collapsed, so without this the new/moved entry would land invisibly
  // nested under a folder the operator has to manually re-open to see.
  assert.match(main, /function expandWorkspaceTreeTo/);
  assert.match(main, /await expandWorkspaceTreeTo\(parentPath\);/);
  assert.match(main, /await expandWorkspaceTreeTo\(target\.path\);/);
});

test("New File / New Directory are wired to the workspace tree, not just drawn", () => {
  assert.match(main, /function openWorkspaceContextMenu/);
  assert.match(main, /function showWorkspaceContextMenu/);
  assert.match(main, /function closeWorkspaceContextMenu/);
  assert.match(main, /function openNewEntryDialog/);
  // Right-click anywhere in the tree resolves a create target: the clicked
  // directory, the parent of a clicked file, or the Project root — never a
  // raw path the frontend invented on its own.
  assert.match(main, /addEventListener\('contextmenu', openWorkspaceContextMenu\)/);
  assert.match(main, /nativeInvoke\(command, \{ parentPath, name \}\)/);
  // A new file is opened immediately, the way a new directory has nothing to open.
  assert.match(main, /if \(kind === 'file'\) await openFileInADE\(createdPath\);/);
});
