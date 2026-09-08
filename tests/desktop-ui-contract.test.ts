import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../desktop/src/index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../desktop/src/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../desktop/src/styles.css", import.meta.url), "utf8");
const desktopBuild = readFileSync(new URL("../desktop/build.mjs", import.meta.url), "utf8");
const sidecarBuild = readFileSync(new URL("../scripts/build-desktop-sidecar.mjs", import.meta.url), "utf8");
const smokeBundle = readFileSync(new URL("../scripts/smoke-desktop-bundle.mjs", import.meta.url), "utf8");

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
  // A stored transcript is a record, never replayed into a live PTY to look
  // like a resumed conversation.
  assert.doesNotMatch(main, /appendTerminalTranscript\(tab\.id, session\.transcript\)/);
  assert.match(main, /escapeHTML\(title\)/);
  assert.match(styles, /\.terminal-history-dialog::backdrop[\s\S]*backdrop-filter: blur/);
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
  assert.match(main, /agentPromptHistoryByProject/);
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
  assert.match(main, /const pathSegments = \(value\) =>/);
  assert.match(main, /function pathInsideRoot/);
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
  assert.match(main, /pendingAgentTurn = \{ prompt, provider, startedAt: Date\.now\(\), activity: \[\], sessionId: null \}/);
  assert.match(main, /function pendingTurnMarkup/);
  assert.match(main, /list\.innerHTML \+= pendingTurnMarkup\(\)/);
  // State owns the pending turn, so a re-render rebuilds it instead of losing it.
  assert.match(main, /let pendingAgentTurn = null/);
  assert.match(main, /function clearPendingAgentTurn/);
  assert.match(main, /response\.type === 'agent\.activity'/);
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
  // The frame and the canvas must agree on one colour per theme.
  assert.match(styles, /\[data-theme="light"\] \.terminal-surface[\s\S]*?background: #f7f6f3/);
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
  assert.match(main, /repositoryName\.textContent = activeProject\.name/);
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
  assert.match(main, /from 'codemirror'/);
  assert.match(main, /defaultHighlightStyle/);
  assert.match(main, /function formatActiveDocument/);
  assert.match(main, /prettier\.format/);
  assert.match(main, /Mod-s/);
  assert.match(main, /from '@codemirror\/lang-cpp'/);
  assert.match(main, /from '@codemirror\/lang-java'/);
  assert.match(main, /from '@codemirror\/lang-php'/);
  assert.match(main, /monaco-editor\/esm\/vs\/editor\/editor\.api\.js/);
  assert.match(main, /function initializeMonacoEditor/);
  assert.match(main, /monacoLanguageDefinitions/);
  assert.match(main, /setModelLanguage/);
  assert.match(main, /editor-engine-hidden/);
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
  assert.match(main, /editor\.background': '#142333'/);
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
  assert.match(main, /async function loadMonaco\(\)/);
  assert.match(main, /import\('monaco-editor\/esm\/vs\/editor\/editor\.api\.js'\)/);
  assert.match(main, /async function loadPrettier\(\)/);
  assert.match(main, /import\('prettier\/standalone'\)/);
  assert.doesNotMatch(main, /^import \* as monaco/m);
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
  for (const selector of ['.document-empty-state', '.document-tabs-menu', '.document-viewer-status', '.document-content', '.icon-button']) {
    const declaresDisplay = new RegExp(`\\${selector} \\{[^}]*display:`).test(styles);
    const guarded = styles.includes(`${selector}[hidden]`) || new RegExp(`\\${selector}\\[hidden\\][^{]*\\{`).test(styles);
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
