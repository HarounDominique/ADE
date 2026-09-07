import { projectSnapshot } from './project-snapshot.js';
import { mergeActiveProject } from './project-context.js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { defaultHighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

const navItems = [...document.querySelectorAll('.nav-item[data-view]')];
const panels = [...document.querySelectorAll('.view')];
const toast = document.querySelector('.toast');
const taskDialog = document.getElementById('new-task-dialog');
const taskForm = document.getElementById('new-task-form');
const taskIntent = document.getElementById('task-intent');
const themeMeta = document.querySelector('meta[name="theme-color"]');
let nativeInvoke;
const terminalTabs = [];
let activeTerminalId = null;
let terminalTabSequence = 0;
let selectedProvider = 'opencode';
let selectedAgentModel = '';
let activeProjectId = projectSnapshot.project.id;
let activeProject = mergeActiveProject({}, projectSnapshot.project);
let workspaceRootPath = projectSnapshot.project.repositoryPath;
let activeGitBranch = null;
let activeVersionControl = 'git';
let selectedFilePath = null;
/** One editor instance serves every open file, so each tab owns its own buffer:
    the text as last seen, the text as last saved, and where the caret was. The
    live editor is authoritative only for the tab currently on screen, which is
    why switching captures the outgoing buffer before painting the incoming one.
    `activeDocument` stays a reference into this list rather than a copy, so the
    save, format and discard paths keep writing to the tab they belong to. */
let openDocuments = [];
let activeDocumentId = null;
let documentTabSequence = 0;
let activeDocument = null;
let documentOriginalContent = '';
let documentDirty = false;
let explorerExpanded = false;
let workspaceSearchEntries = null;
let workspaceSearchIndex = null;
let workspaceSearchToken = 0;
let workspaceSearchTimer = null;
const terminalResizer = document.getElementById('terminal-resizer');
const terminalSizeToggle = document.getElementById('terminal-size-toggle');
const terminalDock = document.getElementById('terminal-dock-panel');
const sidebarResizer = document.getElementById('sidebar-resizer');
const terminalStorageKey = `ade-terminal-height:${activeProjectId}`;
const sidebarStorageKey = `ade-sidebar-width:${activeProjectId}`;
const sidebarCollapsedStorageKey = `ade-sidebar-collapsed:${activeProjectId}`;
// Wide enough for the nav icons and their focus ring, and nothing else.
const collapsedSidebarWidth = 52;
const historyPaneStorageKey = 'ade-history-pane-layout';
const changesPaneStorageKey = 'ade-changes-pane-layout';
let terminalHeight = 138;
let terminalResizeState = null;
let terminalFitFrame = null;
let terminalSizeTransitionTimer = null;
let sidebarWidth = 246;
let sidebarResizeState = null;
let sidebarCollapsed = false;
let sidebarAnimationTimer = null;
let activeServiceId = null;
let gitWorkflow = 'pull-request';
let selectedTaskId = null;
let selectedTaskIntent = '';
let providerStatuses = [];
let runConfigurations = [];
let runSessions = [];
let selectedRunConfigurationId = null;
let runCatalogError = null;
let runSuggestions = [];
let editedRunConfigurationId = null;
let pendingRunSaveMessage = null;
let agentSessions = [];
let activeAgentSessionId = null;
let activeAgentTaskId = null;
let agentProjectTasks = [];
const maxTaskContextItems = 12;
let pendingAgentSessionDeletion = null;
let pendingConfirmation = null;
let agentPromptRunning = false;
/** The turn in flight, owned by state rather than by the DOM: any re-render of
    the transcript has to be able to rebuild it, or it vanishes mid-turn. */
let pendingAgentTurn = null;
let agentRenderedMessages = [];
let agentElapsedTimer = null;
let activeAgentRequestId = null;
let agentStopRequested = false;
let agentPromptHistoryIndex = -1;
let agentPromptHistoryDraft = '';
let agentRailCollapsed = false;
const agentGroupExpansion = new Map();
const agentPromptHistoryByProject = new Map();
const runtimeEvents = [];
let activeView = 'projects';
let pendingGitRefreshInFlight = false;
let pendingGitRequestPath = null;
let registeredProjects = [];
let projectCatalogLoaded = false;
let gitBranches = [];
let gitHistoryCommits = [];
let selectedGitCommit = null;
let selectedPendingGitFile = null;
let gitHistoryFilter = '';
let pendingGitFilter = '';
let pendingGitFiles = [];
let gitCommitNeedsPush = false;
let gitUnpushedCommitCount = 0;
let historyCommitsCollapsed = false;
let historyFilesCollapsed = false;
let changesFilesCollapsed = false;
let codeEditorView = null;
let monacoEditor = null;
let monaco = null;
let monacoLoader = null;
let prettierLoader = null;
let activeEditorEngine = 'codemirror';
const codeEditorLanguage = new Compartment();
const pendingContextRequests = new Map();
const pendingAgentSessionPaths = new Map();
const pendingAgentMessageSessions = new Map();
const pendingAgentSessionDeletes = new Map();
const pendingAgentPromptProjects = new Map();
const pendingSnapshotProjects = new Map();
const taskDetailMarkup = new Map();
const pendingProjectRemovals = new Map();

function configureMonacoThemes() {
  if (!monaco) return;
  monaco.editor.defineTheme('ade-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#142333',
    'editor.foreground': '#edf4f7',
    'editorLineNumber.foreground': '#64798d',
    'editorLineNumber.activeForeground': '#c4d2dc',
    'editor.lineHighlightBackground': '#203348',
    'editor.selectionBackground': '#315a82',
    'editorCursor.foreground': '#69d5c8',
    'editorIndentGuide.background': '#2f4357',
  },
  });
  monaco.editor.defineTheme('ade-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#edf3f8',
    'editor.foreground': '#152231',
    'editorLineNumber.foreground': '#8393a3',
    'editorLineNumber.activeForeground': '#2865b1',
    'editor.lineHighlightBackground': '#e3edf5',
    'editor.selectionBackground': '#b9d5ee',
    'editorCursor.foreground': '#0e827b',
    'editorIndentGuide.background': '#c6d2de',
  },
  });
}

async function loadMonaco() {
  if (monaco) return monaco;
  if (!monacoLoader) {
    monacoLoader = Promise.all([
      import('monaco-editor/esm/vs/editor/editor.api.js'),
      import('monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/dart/dart.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/elixir/elixir.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/fsharp/fsharp.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/go/go.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/graphql/graphql.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/java/java.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/lua/lua.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/objective-c/objective-c.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/perl/perl.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/php/php.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/protobuf/protobuf.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/python/python.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/r/r.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/scala/scala.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/swift/swift.contribution.js'),
    ]).then(([editor]) => {
      monaco = editor;
      configureMonacoThemes();
      applyMonacoTheme(document.documentElement.dataset.theme);
      return monaco;
    });
  }
  return monacoLoader;
}

async function loadPrettier() {
  if (!prettierLoader) {
    prettierLoader = Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
      import('prettier/plugins/typescript'),
      import('prettier/plugins/postcss'),
      import('prettier/plugins/html'),
      import('prettier/plugins/markdown'),
      import('prettier/plugins/yaml'),
    ]).then(([prettier, ...plugins]) => ({ prettier, plugins }));
  }
  return prettierLoader;
}

function applyMonacoTheme(theme) {
  if (monaco) monaco.editor.setTheme(theme === 'light' ? 'ade-light' : 'ade-dark');
}

/** Terminal palettes.  Only four colours were defined before, so the sixteen
    ANSI colours fell back to xterm's own -- tuned for a dark background and
    close to invisible on a light one, which is what made light mode unreadable.
    Both palettes are built from the product's tokens and verified for contrast
    against their own background: every colour clears 4.5:1, the threshold the
    terminal literature settles on, rather than copying a scheme like Solarized
    Light whose low contrast is a documented complaint.

    ANSI black is the deliberate exception: it is the dim colour programs use to
    de-emphasise, so it stays close to the background by convention. Bright
    black is not -- prompts and logs use it for real text, so it stays legible.

    On a light background "bright" cannot mean lighter without disappearing, so
    the bright half is the more emphatic one: darker and more saturated. */
const terminalPalettes = {
  dark: {
    background: '#141a22', foreground: '#d7e3ea', cursor: '#69d5c8', cursorAccent: '#141a22', selectionBackground: '#2f4a5e',
    black: '#3d4a5c', red: '#f1959d', green: '#7cd9a5', yellow: '#f0c477',
    blue: '#7fb0ff', magenta: '#c3a7ff', cyan: '#69d5c8', white: '#c4d2dc',
    brightBlack: '#7d93a8', brightRed: '#ffb3ba', brightGreen: '#9de8bd', brightYellow: '#ffd89b',
    brightBlue: '#a8c9ff', brightMagenta: '#d6c1ff', brightCyan: '#8fe6db', brightWhite: '#edf4f7',
  },
  light: {
    background: '#f7f6f3', foreground: '#20211f', cursor: '#1d7775', cursorAccent: '#f7f6f3', selectionBackground: '#cfe0dd',
    black: '#3b3a37', red: '#a32b2b', green: '#1a7f4b', yellow: '#8a5d11',
    blue: '#245ec4', magenta: '#7057b8', cyan: '#1d7775', white: '#6f6e69',
    brightBlack: '#575652', brightRed: '#c0392b', brightGreen: '#15693e', brightYellow: '#725012',
    brightBlue: '#1d4fa8', brightMagenta: '#5c46a0', brightCyan: '#166462', brightWhite: '#3b3a37',
  },
};

/** The active theme, readable before any terminal exists: a terminal created
    later must open in the theme already on screen instead of a hardcoded one. */
function activeTerminalPalette() {
  return terminalPalettes[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'];
}

function applyTheme(theme) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  try { localStorage.setItem('ade-theme', nextTheme); } catch { /* Tauri privacy settings may disable storage. */ }
  if (themeMeta) themeMeta.content = nextTheme === 'light' ? '#f5f7fa' : '#0f1724';
  // Each theme gives the navigation its own item height, and the sidebar's
  // controls sit on a line measured from its foot.
  syncSidebarControlAnchor();
  applyMonacoTheme(nextTheme);
  document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => {
    button.setAttribute('aria-checked', String(nextTheme === 'light'));
    const nextLabel = nextTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    button.title = nextLabel;
    button.setAttribute('aria-label', nextLabel);
    const label = button.querySelector('.theme-switch-label');
    if (label) label.textContent = nextTheme === 'light' ? 'Dark' : 'Light';
  });
  const terminalTheme = terminalPalettes[nextTheme === 'light' ? 'light' : 'dark'];
  terminalTabs?.forEach((tab) => {
    if (tab.terminal) tab.terminal.options.theme = terminalTheme;
  });
}

let initialTheme = 'light';
const requestedTheme = new URLSearchParams(window.location.search).get('theme');
try { initialTheme = requestedTheme ?? localStorage.getItem('ade-theme') ?? 'light'; } catch { initialTheme = requestedTheme ?? 'light'; }
applyTheme(initialTheme);

/** Fully expanded, the dock stops exactly where the topbar ends: the Project,
    Task, Branch and Run controls stay readable and everything below them is
    the terminal's. Both edges are measured rather than assumed, because the
    topbar grows with the theme and the dock sits on top of the status bar. */
function terminalHeightBounds() {
  const min = 110;
  const headerBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 48;
  const statusBarInset = terminalDock ? parseFloat(getComputedStyle(terminalDock).bottom) || 0 : 0;
  return { min, max: Math.max(min, Math.round(window.innerHeight - headerBottom - statusBarInset)) };
}

function updateTerminalSizeToggle() {
  const bounds = terminalHeightBounds();
  const expanded = terminalHeight >= bounds.max;
  terminalSizeToggle?.setAttribute('aria-expanded', String(expanded));
  terminalSizeToggle?.setAttribute('data-expanded', String(expanded));
  const action = expanded ? 'Reduce terminal to minimum height' : 'Expand terminal to maximum height';
  terminalSizeToggle?.setAttribute('aria-label', action);
  if (terminalSizeToggle) terminalSizeToggle.title = action;
}

function clearTerminalSizeTransition() {
  if (terminalSizeTransitionTimer !== null) {
    clearTimeout(terminalSizeTransitionTimer);
    terminalSizeTransitionTimer = null;
  }
  terminalDock?.classList.remove('terminal-size-transitioning');
}

function animateTerminalHeight(nextHeight) {
  clearTerminalSizeTransition();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    setTerminalHeight(nextHeight);
    return;
  }
  terminalDock?.classList.add('terminal-size-transitioning');
  requestAnimationFrame(() => {
    setTerminalHeight(nextHeight);
    terminalSizeTransitionTimer = setTimeout(clearTerminalSizeTransition, 260);
  });
}

function setTerminalHeight(nextHeight, persist = true) {
  const bounds = terminalHeightBounds();
  terminalHeight = Math.max(bounds.min, Math.min(bounds.max, Math.round(nextHeight)));
  document.documentElement.style.setProperty('--terminal-height', `${terminalHeight}px`);
  terminalResizer?.setAttribute('aria-valuemax', String(bounds.max));
  terminalResizer?.setAttribute('aria-valuenow', String(terminalHeight));
  updateTerminalSizeToggle();
  scheduleTerminalFit();
  if (persist) {
    try { localStorage.setItem(terminalStorageKey, String(terminalHeight)); } catch { /* Persistence is optional. */ }
  }
}

function scheduleTerminalFit() {
  if (terminalFitFrame !== null) return;
  const fit = () => {
    terminalFitFrame = null;
    activeTerminal()?.fitAddon?.fit();
  };
  if (typeof requestAnimationFrame === 'function') terminalFitFrame = requestAnimationFrame(fit);
  else fit();
}

function sidebarWidthBounds() {
  return { min: 190, max: Math.min(720, Math.max(190, window.innerWidth - 580)) };
}

function setSidebarWidth(nextWidth, persist = true) {
  const bounds = sidebarWidthBounds();
  sidebarWidth = Math.max(bounds.min, Math.min(bounds.max, Math.round(nextWidth)));
  applySidebarWidth();
  sidebarResizer?.setAttribute('aria-valuemax', String(bounds.max));
  sidebarResizer?.setAttribute('aria-valuenow', String(sidebarWidth));
  if (persist) {
    try { localStorage.setItem(sidebarStorageKey, String(sidebarWidth)); } catch { /* Persistence is optional. */ }
  }
}

/** The collapse control and the resize grip are one pair, so they share a line
    at the foot of the navigation. Measuring it beats a per-theme constant: the
    navigation is taller in the light themes and much shorter in tree focus
    mode, and a guess would drift in all three. */
function syncSidebarControlAnchor() {
  const sidebar = document.getElementById('sidebar');
  const nav = document.getElementById('primary-nav');
  if (!sidebar || !nav) return;
  // The line belongs in the gap between the navigation's rule and the
  // Explorer's, not on either of them: sitting on a rule reads as a collision.
  const navBottom = nav.getBoundingClientRect().bottom;
  const explorer = document.querySelector('.explorer-section')?.getBoundingClientRect();
  const navMargin = parseFloat(getComputedStyle(nav).marginBottom) || 0;
  // The rail hides the Explorer, and a hidden box measures as nothing, so the
  // gap is then the navigation's own margin.
  const gapEnd = explorer && explorer.height > 0 ? explorer.top : navBottom + navMargin;
  const offset = (navBottom + gapEnd) / 2 - sidebar.getBoundingClientRect().top;
  if (offset > 0) sidebar.style.setProperty('--sidebar-control-y', `${Math.round(offset)}px`);
}

/** The navigation animates its own margin and padding on its way to and from
    the rail, so a single reading taken on the click is a reading of the layout
    being left behind. Follow it to rest instead, which also keeps the controls
    travelling with the gap rather than jumping into it at the end. */
function trackSidebarControlAnchor(durationMs = 300) {
  syncSidebarControlAnchor();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const deadline = performance.now() + durationMs;
  const step = () => {
    syncSidebarControlAnchor();
    if (performance.now() < deadline) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Collapsing narrows the shell to the rail width without touching the width
    the operator chose, so expanding returns to it rather than to a default. */
function applySidebarWidth() {
  document.documentElement.style.setProperty('--sidebar-width', `${sidebarCollapsed ? collapsedSidebarWidth : sidebarWidth}px`);
}

/** The rail keeps navigation reachable while the Explorer stands down: the
    labels are clipped rather than removed, so each item keeps the name screen
    readers announce, and gains it as a tooltip for the pointer. */
function setSidebarCollapsed(collapsed, { persist = true, animate = false } = {}) {
  sidebarCollapsed = collapsed;
  const sidebar = document.querySelector('.sidebar');
  const shell = document.querySelector('.app-shell');
  const toggle = document.getElementById('sidebar-collapse');
  const action = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  if (animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    shell?.classList.add('sidebar-animating');
    window.clearTimeout(sidebarAnimationTimer);
    sidebarAnimationTimer = window.setTimeout(() => shell?.classList.remove('sidebar-animating'), 260);
  }
  sidebar?.classList.toggle('sidebar-collapsed', collapsed);
  toggle?.setAttribute('aria-expanded', String(!collapsed));
  toggle?.setAttribute('aria-label', action);
  if (toggle) toggle.title = action;
  for (const item of document.querySelectorAll('.primary-nav .nav-item')) {
    const label = item.querySelector('span')?.textContent?.trim() ?? '';
    if (collapsed && label) item.title = label;
    else item.removeAttribute('title');
  }
  // A hidden resizer must not stay in the tab order, and dragging a rail to a
  // width it does not use would be a control that lies.
  if (sidebarResizer) sidebarResizer.hidden = collapsed;
  applySidebarWidth();
  trackSidebarControlAnchor();
  scheduleTerminalFit();
  if (persist) {
    try { localStorage.setItem(sidebarCollapsedStorageKey, String(collapsed)); } catch { /* Persistence is optional. */ }
  }
}

function activeTerminal() {
  return terminalTabs.find((tab) => tab.id === activeTerminalId) ?? terminalTabs[0] ?? null;
}

function renderTerminalOutput() {
  const tab = activeTerminal();
  const hosts = document.getElementById('terminal-hosts');
  if (!hosts || !tab) return;
  hosts.querySelectorAll('[data-terminal-host]').forEach((host) => {
    host.hidden = host.dataset.terminalHost !== tab.id;
  });
  const cwd = document.getElementById('terminal-cwd');
  if (cwd) cwd.textContent = `${tab.label} · ${tab.completionCwd}`;
  scheduleTerminalFit();
  tab.terminal?.focus();
}

function appendTerminalTranscript(sessionId, text) {
  const tab = terminalTabs.find((candidate) => candidate.id === sessionId);
  if (!tab) return;
  tab.terminal?.write(text);
}

function renderTerminalTabs() {
  const container = document.getElementById('terminal-tabs');
  if (!container) return;
  container.innerHTML = terminalTabs.map((tab) => `<div class="terminal-tab${tab.id === activeTerminalId ? ' active' : ''}" role="presentation"><button class="terminal-tab-button" type="button" role="tab" aria-selected="${tab.id === activeTerminalId}" aria-controls="terminal-hosts" data-terminal-tab-id="${tab.id}"><span class="terminal-tab-status${tab.started ? ' running' : ''}" aria-hidden="true"></span><span>${tab.label}</span></button><button class="terminal-tab-close" type="button" aria-label="Close ${tab.label}" title="Close ${tab.label}" data-terminal-close-id="${tab.id}">×</button></div>`).join('');
}

function syncActiveTerminalInput(focus = true) {
  const tab = activeTerminal();
  if (focus) tab?.terminal?.focus();
}

function selectTerminalTab(sessionId, focus = true) {
  const tab = terminalTabs.find((candidate) => candidate.id === sessionId);
  if (!tab) return;
  activeTerminalId = tab.id;
  renderTerminalTabs();
  renderTerminalOutput();
  syncActiveTerminalInput(focus);
}

function createTerminalTab({ focus = true, kind = 'pty', id: requestedId = null, label: requestedLabel = null } = {}) {
  terminalTabSequence += 1;
  const id = requestedId ?? `terminal-${Date.now()}-${terminalTabSequence}`;
  const tab = {
    id,
    kind,
    label: requestedLabel ?? `Terminal ${terminalTabSequence}`,
    started: false,
    completionCwd: workspaceRootPath,
    terminal: null,
    fitAddon: null,
    startPromise: null,
    inputQueue: Promise.resolve(),
  };
  tab.terminal = new Terminal({
    cursorBlink: true,
    convertEol: false,
    scrollback: 5000,
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    theme: activeTerminalPalette(),
  });
  tab.fitAddon = new FitAddon();
  tab.terminal.loadAddon(tab.fitAddon);
  tab.terminal.onData((data) => {
    /** A run's console shows what the process wrote; there is no PTY behind it
        to accept what the operator types. */
    if (tab.kind === 'pty') void sendTerminalInput(tab, data);
  });
  tab.terminal.onResize(({ cols, rows }) => {
    if (tab.kind === 'pty' && tab.started && nativeInvoke) void nativeInvoke('terminal_resize', { sessionId: tab.id, cols, rows }).catch(() => {});
  });
  const hosts = document.getElementById('terminal-hosts');
  const host = document.createElement('div');
  host.className = 'terminal-host';
  host.dataset.terminalHost = tab.id;
  host.hidden = true;
  hosts?.appendChild(host);
  tab.terminal.open(host);
  terminalTabs.push(tab);
  activeTerminalId = tab.id;
  renderTerminalTabs();
  renderTerminalOutput();
  syncActiveTerminalInput(focus);
  return tab;
}

function closeTerminalTab(sessionId) {
  const index = terminalTabs.findIndex((tab) => tab.id === sessionId);
  if (index < 0) return;
  const [tab] = terminalTabs.splice(index, 1);
  /** Closing a run's console hides its output; it does not stop the run, which
      stays visible and stoppable in the topbar. */
  if (tab.kind === 'pty' && tab.started) nativeInvoke?.('terminal_stop', { sessionId: tab.id }).catch(() => {});
  tab.terminal?.dispose();
  document.querySelector(`[data-terminal-host="${CSS.escape(tab.id)}"]`)?.remove();
  if (!terminalTabs.length) createTerminalTab({ focus: false });
  else if (activeTerminalId === tab.id) selectTerminalTab(terminalTabs[Math.max(0, index - 1)]?.id ?? terminalTabs[0].id);
  else { renderTerminalTabs(); renderTerminalOutput(); }
}

async function startTerminal(tab) {
  if (tab.started) return;
  if (tab.startPromise) return tab.startPromise;
  tab.startPromise = (async () => {
    if (!nativeInvoke) throw new Error('Native terminal requires the desktop runtime.');
    await nativeInvoke('terminal_start', { sessionId: tab.id, cwd: workspaceRootPath });
    tab.started = true;
    renderTerminalTabs();
    scheduleTerminalFit();
  })().finally(() => { tab.startPromise = null; });
  return tab.startPromise;
}

async function sendTerminalInput(tab, data) {
  if (!data || !nativeInvoke) return;
  tab.inputQueue = tab.inputQueue
    .catch(() => {})
    .then(async () => {
      await startTerminal(tab);
      await nativeInvoke('terminal_input', { sessionId: tab.id, input: data });
    })
    .catch((error) => {
      notify('Terminal input failed.');
      console.warn('Terminal input unavailable:', error);
    });
  return tab.inputQueue;
}

createTerminalTab({ focus: false });

try {
  const storedTerminalHeight = Number(localStorage.getItem(terminalStorageKey));
  if (Number.isFinite(storedTerminalHeight)) terminalHeight = storedTerminalHeight;
} catch { /* Persistence is optional. */ }
setTerminalHeight(terminalHeight, false);
const terminalSurface = document.querySelector('.terminal-surface');
if (terminalSurface && typeof ResizeObserver === 'function') {
  new ResizeObserver(scheduleTerminalFit).observe(terminalSurface);
}
try {
  const storedSidebarWidth = Number(localStorage.getItem(sidebarStorageKey));
  if (Number.isFinite(storedSidebarWidth)) sidebarWidth = storedSidebarWidth;
  sidebarCollapsed = localStorage.getItem(sidebarCollapsedStorageKey) === 'true';
} catch { /* Persistence is optional. */ }
setSidebarWidth(sidebarWidth, false);
// Restored without the transition, so the shell does not animate on first paint.
setSidebarCollapsed(sidebarCollapsed, { persist: false });
syncSidebarControlAnchor();
window.addEventListener('resize', syncSidebarControlAnchor);

terminalResizer?.addEventListener('pointerdown', (event) => {
  if (event.target.closest('#terminal-size-toggle')) return;
  clearTerminalSizeTransition();
  event.preventDefault();
  terminalResizeState = { pointerId: event.pointerId, startY: event.clientY, startHeight: terminalHeight };
  terminalResizer.setPointerCapture?.(event.pointerId);
});
terminalResizer?.addEventListener('pointermove', (event) => {
  if (!terminalResizeState || event.pointerId !== terminalResizeState.pointerId) return;
  setTerminalHeight(terminalResizeState.startHeight + terminalResizeState.startY - event.clientY, false);
});
const finishTerminalResize = (event) => {
  if (!terminalResizeState || (event?.pointerId !== undefined && event.pointerId !== terminalResizeState.pointerId)) return;
  setTerminalHeight(terminalHeight);
  terminalResizeState = null;
};
terminalResizer?.addEventListener('pointerup', finishTerminalResize);
terminalResizer?.addEventListener('pointercancel', finishTerminalResize);
terminalResizer?.addEventListener('keydown', (event) => {
  const step = event.shiftKey ? 48 : 16;
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    setTerminalHeight(terminalHeight + (event.key === 'ArrowUp' ? step : -step));
  }
  if (event.key === 'Home') { event.preventDefault(); setTerminalHeight(terminalHeightBounds().min); }
  if (event.key === 'End') { event.preventDefault(); setTerminalHeight(terminalHeightBounds().max); }
});
terminalSizeToggle?.addEventListener('click', () => {
  const bounds = terminalHeightBounds();
  animateTerminalHeight(terminalHeight >= bounds.max ? bounds.min : bounds.max);
});
terminalDock?.addEventListener('transitionend', (event) => {
  if (event.propertyName === 'height') clearTerminalSizeTransition();
});
window.addEventListener('resize', () => setTerminalHeight(terminalHeight, false));
sidebarResizer?.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  sidebarResizeState = { pointerId: event.pointerId, startX: event.clientX, startWidth: sidebarWidth };
  sidebarResizer.setPointerCapture?.(event.pointerId);
});
sidebarResizer?.addEventListener('pointermove', (event) => {
  if (!sidebarResizeState || event.pointerId !== sidebarResizeState.pointerId) return;
  setSidebarWidth(sidebarResizeState.startWidth + event.clientX - sidebarResizeState.startX, false);
});
const finishSidebarResize = (event) => {
  if (!sidebarResizeState || (event?.pointerId !== undefined && event.pointerId !== sidebarResizeState.pointerId)) return;
  setSidebarWidth(sidebarWidth);
  sidebarResizeState = null;
};
sidebarResizer?.addEventListener('pointerup', finishSidebarResize);
sidebarResizer?.addEventListener('pointercancel', finishSidebarResize);
sidebarResizer?.addEventListener('keydown', (event) => {
  const step = event.shiftKey ? 48 : 16;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    setSidebarWidth(sidebarWidth + (event.key === 'ArrowRight' ? step : -step));
  }
  if (event.key === 'Home') { event.preventDefault(); setSidebarWidth(sidebarWidthBounds().min); }
  if (event.key === 'End') { event.preventDefault(); setSidebarWidth(sidebarWidthBounds().max); }
});
window.addEventListener('resize', () => setSidebarWidth(sidebarWidth, false));

function renderSnapshot(snapshot) {
  activeProject = mergeActiveProject(activeProject, snapshot.project);
  activeProjectId = activeProject.id;
  activeVersionControl = activeProject.versionControl ?? activeVersionControl;
  const hasGit = activeVersionControl !== 'none';
  const currentBranch = hasGit ? (activeGitBranch ?? activeProject.branch ?? 'detached') : 'No Git';
  const values = {
    'project-name': activeProject.name,
    'project-description': activeProject.description ?? 'Local Assay project',
    'project-path': activeProject.repositoryPath,
    'project-branch': currentBranch,
    'working-tree-state': snapshot.project.workingTree,
    'active-task-count': snapshot.metrics.activeTasks,
    'review-count': snapshot.metrics.inReview,
    'active-service-count': snapshot.metrics.services.active,
    'declared-service-count': snapshot.metrics.services.declared,
    'last-ship': snapshot.metrics.lastShip ?? '—',
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
  const statusBranch = document.getElementById('status-branch-name');
  if (statusBranch) statusBranch.textContent = currentBranch;
  const repositoryName = document.getElementById('current-repository-name');
  if (repositoryName) repositoryName.textContent = activeProject.name;
  const branchName = document.getElementById('current-branch-name');
  if (branchName) branchName.textContent = currentBranch;
  const branchButton = document.getElementById('branch-context-button');
  if (branchButton) {
    branchButton.disabled = !hasGit;
    branchButton.setAttribute('aria-disabled', String(!hasGit));
    branchButton.title = hasGit ? 'Switch local branch' : 'This project is not a Git repository';
  }
  const terminalCwd = document.getElementById('terminal-cwd');
  if (terminalCwd) terminalCwd.textContent = activeProject.repositoryPath;
  agentProjectTasks = snapshot.tasks ?? [];
  renderChanges(agentProjectTasks);
  renderProjectTasks(agentProjectTasks);
  renderTaskContext();
  renderAgentTaskSelection();
  if (activeView === 'agents') renderAgentSessions(agentSessions);
  if (snapshot.sync) setSyncState(snapshot.sync.state, snapshot.sync.label);
  renderProjectsList();
}

function renderProjectsList() {
  const list = document.getElementById('projects-list');
  const status = document.getElementById('projects-list-status');
  if (!list) return;
  if (!projectCatalogLoaded) {
    list.innerHTML = '<div class="projects-list-empty">Loading projects…</div>';
    if (status) status.textContent = 'Loading…';
    return;
  }
  if (!registeredProjects.length) {
    list.innerHTML = '<div class="projects-list-empty">No projects registered yet. Add a local folder to get started.</div>';
    if (status) status.textContent = '0 projects';
    return;
  }
  list.innerHTML = registeredProjects.map((project) => {
    const isActive = project.id === activeProjectId;
    const versionControl = project.versionControl === 'none' ? 'No Git' : 'Git';
    const canRemove = !isActive || registeredProjects.length > 1;
    return `<div class="project-list-item${isActive ? ' active' : ''}"><button class="project-list-select" type="button" data-project-id="${escapeHTML(project.id)}"><span class="project-list-icon" aria-hidden="true">${isActive ? '●' : '○'}</span><span class="project-list-copy"><strong>${escapeHTML(project.name)}</strong><small>${escapeHTML(project.repositoryPath)}</small></span><span class="project-list-vcs">${versionControl}</span><span class="project-list-arrow" aria-hidden="true">→</span></button><button class="project-list-remove" type="button" data-remove-project-id="${escapeHTML(project.id)}" aria-label="Remove ${escapeHTML(project.name)} from Assay" title="Remove from Assay"${canRemove ? '' : ' disabled'}>×</button></div>`;
  }).join('');
  if (status) status.textContent = `${registeredProjects.length} project${registeredProjects.length === 1 ? '' : 's'}`;
}

function sendContextRequest(method, params = {}, purpose = method) {
  if (!nativeInvoke) return Promise.reject(new Error('Local sidecar unavailable'));
  const id = `context-${purpose}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  pendingContextRequests.set(String(id), purpose);
  if (method === 'project.remove' && params.projectId) pendingProjectRemovals.set(String(id), params.projectId);
  return nativeInvoke('sidecar_request', { request: JSON.stringify({ id, method, params }) });
}

function requestProjectSnapshot(projectId = activeProjectId, purpose = 'snapshot') {
  if (!nativeInvoke) return Promise.reject(new Error('Local sidecar unavailable'));
  const id = `snapshot-${purpose}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  pendingContextRequests.set(String(id), purpose);
  pendingSnapshotProjects.set(String(id), projectId);
  return nativeInvoke('sidecar_request', { request: JSON.stringify({ id, method: 'project.snapshot', params: { projectId } }) });
}

function closeGitContextMenus() {
  document.querySelectorAll('.git-context-menu').forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll('.git-context-button').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function renderRepositoryMenu() {
  const menu = document.getElementById('repository-context-menu');
  if (!menu) return;
  menu.innerHTML = registeredProjects.length
    ? registeredProjects.map((project) => `<button class="git-context-option${project.id === activeProjectId ? ' selected' : ''}" type="button" role="menuitem" data-project-id="${escapeHTML(project.id)}"><span class="git-option-mark" aria-hidden="true">${project.id === activeProjectId ? '✓' : ''}</span><span><strong>${escapeHTML(project.name)}</strong><small>${escapeHTML(project.repositoryPath)}</small></span></button>`).join('')
    : '<p class="git-context-empty">No registered repositories.</p>';
}

function renderBranchMenu() {
  const menu = document.getElementById('branch-context-menu');
  if (!menu) return;
  menu.innerHTML = gitBranches.length
    ? gitBranches.map((branch) => `<button class="git-context-option${branch === document.getElementById('current-branch-name')?.textContent ? ' selected' : ''}" type="button" role="menuitem" data-branch-name="${escapeHTML(branch)}"><span class="git-option-mark" aria-hidden="true">${branch === document.getElementById('current-branch-name')?.textContent ? '✓' : ''}</span><span><strong>${escapeHTML(branch)}</strong></span></button>`).join('')
    : '<p class="git-context-empty">No local branches found.</p>';
}

function taskCreatedAt(task) {
  const timestamp = Date.parse(task.createdAt ?? task.updatedAt ?? '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function orderedTaskContextItems() {
  return [...agentProjectTasks].sort((left, right) => taskCreatedAt(right) - taskCreatedAt(left));
}

function visibleTaskContextItems() {
  const ordered = orderedTaskContextItems();
  const selected = ordered.find((task) => task.id === selectedTaskId);
  const recent = ordered.slice(0, maxTaskContextItems);
  return selected && !recent.some((task) => task.id === selected.id) ? [...recent, selected] : recent;
}

function renderTaskContextMenu() {
  const menu = document.getElementById('task-context-menu');
  if (!menu) return;
  const tasks = visibleTaskContextItems();
  menu.innerHTML = tasks.length
    ? tasks.map((task) => `<button class="git-context-option${task.id === selectedTaskId ? ' selected' : ''}" type="button" role="menuitemradio" aria-checked="${task.id === selectedTaskId}" data-task-context-id="${escapeHTML(task.id)}"><span class="git-option-mark" aria-hidden="true">${task.id === selectedTaskId ? '✓' : ''}</span><span><strong>${escapeHTML(task.intent)}</strong><small>${escapeHTML(task.id)} · ${escapeHTML(task.status.replaceAll('_', ' '))}</small></span></button>`).join('')
    : '<p class="git-context-empty">No tasks in this Project.</p>';
}

function renderTaskContext() {
  const tasks = orderedTaskContextItems();
  const selected = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null;
  selectedTaskId = selected?.id ?? null;
  selectedTaskIntent = selected?.intent ?? '';
  void syncDocumentScope();
  const name = document.getElementById('current-task-name');
  if (name) name.textContent = selected?.intent ?? 'No task';
  const button = document.getElementById('task-context-button');
  if (button) {
    button.disabled = false;
    button.setAttribute('aria-disabled', 'false');
    button.title = tasks.length ? 'Switch active task' : 'No tasks in this Project';
  }
  renderTaskContextMenu();
}

/** The current Task stays current when its evidence is collapsed; only the
    disclosure changes, so the topbar and the list never drift apart. */
function toggleTaskDetail(row) {
  const detail = document.getElementById(row.getAttribute('aria-controls'));
  if (!detail) return;
  const expanded = row.getAttribute('aria-expanded') === 'true';
  row.setAttribute('aria-expanded', String(!expanded));
  detail.hidden = expanded;
}

function selectTaskContext(taskId) {
  const task = agentProjectTasks.find((item) => item.id === taskId);
  if (!task) return;
  selectedTaskId = task.id;
  selectedTaskIntent = task.intent;
  void syncDocumentScope();
  if (!activeAgentSessionId) activeAgentTaskId = task.id;
  renderChanges(agentProjectTasks);
  renderProjectTasks(agentProjectTasks);
  renderTaskContext();
  renderAgentTaskSelection();
  closeGitContextMenus();
  nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `detail-${task.id}-${Date.now()}`, method: 'task.detail', params: { taskId: task.id } }) });
  nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `git-ops-${task.id}-${Date.now()}`, method: 'task.git.operations', params: { taskId: task.id } }) });
  nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `review-${task.id}-${Date.now()}`, method: 'change.review', params: { taskId: task.id } }) });
}

function toggleGitContextMenu(kind) {
  if (kind === 'branch' && activeVersionControl === 'none') return;
  const menu = document.getElementById(`${kind}-context-menu`);
  const button = document.getElementById(`${kind}-context-button`);
  if (!menu || !button) return;
  const wasOpen = !menu.hidden;
  closeGitContextMenus();
  if (wasOpen) return;
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  if (kind === 'repository') {
    renderRepositoryMenu();
    if (!projectCatalogLoaded) void sendContextRequest('project.list', {}, 'projects');
  } else if (kind === 'task') {
    renderTaskContextMenu();
  } else {
    menu.innerHTML = '<p class="git-context-empty">Loading branches…</p>';
    void sendContextRequest('git.workspace', { repositoryPath: document.getElementById('project-path')?.textContent }, 'branches');
  }
}

async function switchProjectFromContext(project) {
  if (!nativeInvoke || !project?.repositoryPath) return;
  closeGitContextMenus();
  setSyncState('stale', `Switching to ${project.name}…`);
  try {
    const context = await nativeInvoke('project_context', { repositoryPath: project.repositoryPath });
    activeProjectId = project.id;
    activeProject = mergeActiveProject(project, context);
    workspaceRootPath = context.repositoryPath;
    activeGitBranch = context.branch;
    gitBranches = [];
    selectedPendingGitFile = null;
    gitCommitNeedsPush = false;
    gitUnpushedCommitCount = 0;
    resetAgentWorkspaceForProject();
    renderCommitControls();
    // Tabs belong to their Project. The outgoing set was persisted as it was
    // opened and closed, so switching only has to reopen the incoming one.
    document.getElementById('document-viewer')?.removeAttribute('hidden');
    selectedFilePath = null;
    await syncDocumentScope();
    updateRevealOpenFileButton();
    renderSnapshot({ ...projectSnapshot, project: activeProject, metrics: { ...projectSnapshot.metrics, activeTasks: 0, inReview: 0 } });
    window.clearTimeout(workspaceSearchTimer);
    workspaceSearchToken += 1;
    setWorkspaceSearchLoading(false);
    workspaceSearchEntries = null;
    workspaceSearchIndex = null;
    await loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true });
    await refreshGitWorkspace(workspaceRootPath, nativeInvoke);
    requestAgentSessions(workspaceRootPath);
    resetRunControlForProject();
    await sendContextRequest('project.snapshot', { projectId: activeProjectId }, 'snapshot');
    await sendContextRequest('service.list', { repositoryPath: workspaceRootPath }, 'services');
    notify(`Project switched to ${project.name}.`);
  } catch (error) {
    setSyncState('failed', 'Project switch failed');
    notify(error instanceof Error ? error.message : 'Project switch failed.');
    console.warn('Project switch unavailable:', error);
  }
}

async function switchBranchFromContext(branch) {
  const path = document.getElementById('project-path')?.textContent;
  if (!nativeInvoke || !path || !branch) return;
  closeGitContextMenus();
  setSyncState('stale', `Switching to ${branch}…`);
  try {
    await sendContextRequest('git.branch.switch', { repositoryPath: path, branch, actor: 'human', reason: 'Branch selected from Assay Git context bar', confirmed: true }, 'switch-branch');
  } catch (error) {
    setSyncState('failed', 'Branch switch failed');
    notify(error instanceof Error ? error.message : 'Branch switch failed.');
  }
}

function projectIdForPath(path) {
  const base = pathBaseName(path) || 'project';
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
  if (!registeredProjects.some((project) => project.id === slug)) return slug;
  return `${slug}-${Date.now().toString(36)}`;
}

async function addProjectFromUI() {
  if (!nativeInvoke) { notify('Adding a project requires the local desktop runtime.'); return; }
  try {
    const selectedPath = await nativeInvoke('select_project_directory');
    if (!selectedPath) return;
    const name = pathBaseName(selectedPath) || 'Project';
    setSyncState('stale', `Adding ${name}…`);
    await sendContextRequest('project.register', { projectId: projectIdForPath(selectedPath), name, repositoryPath: selectedPath }, 'register-project');
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Unable to add project.');
  }
}

function removeProjectFromUI(project) {
  if (!nativeInvoke || !project) return;
  if (project.id === activeProjectId && registeredProjects.length === 1) {
    notify('Add another project before removing the active one.');
    return;
  }
  requestConfirmation({
    eyebrow: 'REMOVE PROJECT',
    title: `Remove “${project.name}” from ADE?`,
    copy: 'Assay stops tracking this Project. Its files stay on disk and can be added again later.',
    confirmLabel: 'Remove',
    tone: 'danger',
  }, () => {
    setSyncState('stale', `Removing ${project.name}…`);
    void sendContextRequest('project.remove', { projectId: project.id }, 'remove-project').catch((error) => {
      notify(error instanceof Error ? error.message : 'Unable to remove project.');
    });
  });
}

function renderChanges(tasks) {
  const task = tasks.find((item) => item.id === selectedTaskId) ?? [...tasks].sort((left, right) => taskCreatedAt(right) - taskCreatedAt(left))[0];
  selectedTaskId = task?.id ?? null;
  selectedTaskIntent = task?.intent ?? '';
  void syncDocumentScope();
  const values = {
    'changes-task-id': task?.id ?? '—',
    'changes-task-title': task?.intent ?? 'No Task selected',
    'changes-task-detail': task ? `Current persisted state: ${task.status.replaceAll('_', ' ')}.` : 'Create a Task from Projects to populate the review queue.',
    'changes-task-status': task?.status?.replaceAll('_', ' ') ?? 'EMPTY',
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}

function renderChangeReview(review) {
  const taskId = document.getElementById('changes-task-id');
  const detail = document.getElementById('changes-task-detail');
  const status = document.getElementById('changes-task-status');
  const gates = document.getElementById('changes-gates');
  const changeSet = document.getElementById('changes-changeset');
  const findings = document.getElementById('changes-findings');
  if (taskId) taskId.textContent = review.taskId;
  if (detail) detail.textContent = review.review ? `${review.review.summary} · ${review.review.findings.length} finding(s).` : 'No independent review recorded yet.';
  if (status) status.textContent = review.taskStatus.replaceAll('_', ' ');
  if (gates) gates.innerHTML = review.gates.map((gate) => `<span class="gate ${gate.status === 'passed' || gate.status === 'waived' ? 'passed' : 'pending'}">${gate.status === 'passed' ? '✓' : '○'} ${escapeHTML(gate.id.replaceAll('-', ' '))}</span>`).join('');
  if (changeSet) changeSet.textContent = review.changeSet ? `${review.changeSet.id} · ${review.changeSet.gitStatus || 'clean'} · ${review.changeSet.sessionId}` : 'No ChangeSet captured.';
  if (findings) {
    const entries = review.review?.findings ?? [];
    findings.innerHTML = entries.length
      ? entries.map((finding) => `<article class="finding"><span class="finding-dot"></span><span><strong>${escapeHTML(finding.severity ?? 'finding')}: ${escapeHTML(finding.claim ?? finding.summary ?? 'Review finding')}</strong><small>${escapeHTML(finding.evidence ?? finding.action ?? 'Evidence recorded in review.')}</small></span></article>`).join('')
      : '<p class="finding-empty">No unresolved findings.</p>';
  }
}

function renderGitOperations(operations) {
  const detail = document.getElementById('git-task-operations') ?? document.getElementById('git-workspace-detail');
  if (!detail) return;
  detail.textContent = operations.length
    ? operations.map((item) => `${item.operation} · ${item.reference ?? '—'} · ${item.actor}`).join('\n')
    : 'No Git operations linked to the selected Task.';
}

function renderVersionControlTabs(activeTab) {
  document.querySelectorAll('[data-version-control-tab]').forEach((tab) => {
    const active = tab.dataset.versionControlTab === activeTab;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-version-control-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.versionControlPanel !== activeTab;
  });
}

function setHistoryPaneCollapsed(pane, collapsed, persist = true) {
  const layout = document.getElementById('version-history-layout');
  const detail = document.getElementById('git-commit-detail');
  const isCommits = pane === 'commits';
  if (isCommits) historyCommitsCollapsed = collapsed;
  else historyFilesCollapsed = collapsed;
  layout?.classList.toggle('history-commits-collapsed', historyCommitsCollapsed);
  detail?.classList.toggle('history-files-collapsed', historyFilesCollapsed);
  const toggle = document.getElementById(isCommits ? 'history-commits-toggle' : 'history-files-toggle');
  const restore = document.getElementById(isCommits ? 'history-commits-restore' : 'history-files-restore');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${isCommits ? 'commit list' : 'changed file list'}`);
    toggle.title = toggle.getAttribute('aria-label');
  }
  if (restore) {
    restore.tabIndex = collapsed ? 0 : -1;
    restore.setAttribute('aria-hidden', String(!collapsed));
  }
  if (persist) {
    try { localStorage.setItem(historyPaneStorageKey, JSON.stringify({ commits: historyCommitsCollapsed, files: historyFilesCollapsed })); } catch { /* Persistence is optional. */ }
  }
}

function restoreHistoryPaneLayout() {
  try {
    const stored = JSON.parse(localStorage.getItem(historyPaneStorageKey) ?? '{}');
    historyCommitsCollapsed = Boolean(stored.commits);
    historyFilesCollapsed = Boolean(stored.files);
  } catch { /* Persistence is optional. */ }
  setHistoryPaneCollapsed('commits', historyCommitsCollapsed, false);
  setHistoryPaneCollapsed('files', historyFilesCollapsed, false);
}

function setChangesPaneCollapsed(collapsed, persist = true) {
  const workspace = document.querySelector('#version-changes-panel .changes-workspace');
  changesFilesCollapsed = collapsed;
  workspace?.classList.toggle('changes-files-collapsed', changesFilesCollapsed);
  const toggle = document.getElementById('changes-files-toggle');
  const restore = document.getElementById('changes-files-restore');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} changed file list`);
    toggle.title = toggle.getAttribute('aria-label');
  }
  if (restore) {
    restore.tabIndex = collapsed ? 0 : -1;
    restore.setAttribute('aria-hidden', String(!collapsed));
  }
  if (persist) {
    try { localStorage.setItem(changesPaneStorageKey, JSON.stringify({ files: changesFilesCollapsed })); } catch { /* Persistence is optional. */ }
  }
}

function restoreChangesPaneLayout() {
  try {
    const stored = JSON.parse(localStorage.getItem(changesPaneStorageKey) ?? '{}');
    changesFilesCollapsed = Boolean(stored.files);
  } catch { /* Persistence is optional. */ }
  setChangesPaneCollapsed(changesFilesCollapsed, false);
}

function renderCommitControls() {
  const branch = document.getElementById('current-branch-name')?.textContent?.trim() || 'current branch';
  const branchLabel = document.getElementById('commit-branch-name');
  const pushButton = document.getElementById('git-push-origin');
  const commitButton = document.getElementById('git-commit-local');
  if (branchLabel) branchLabel.textContent = branch;
  if (pushButton) pushButton.disabled = !gitCommitNeedsPush || activeVersionControl === 'none';
  if (commitButton) commitButton.disabled = !pendingGitFiles.length || activeVersionControl === 'none';
}

function setVersionControlRemoteStatus(message) {
  const status = document.getElementById('git-remote-status');
  if (status) status.textContent = message;
}

/** Unpushed commits and pending files are separate debts; the operator needs
    to see both without switching tabs. */
function renderVersionControlRemoteStatus() {
  const parts = [];
  if (gitUnpushedCommitCount) parts.push(`${gitUnpushedCommitCount} commit${gitUnpushedCommitCount === 1 ? '' : 's'} ready to push`);
  if (pendingGitFiles.length) parts.push(`${pendingGitFiles.length} local change${pendingGitFiles.length === 1 ? '' : 's'}`);
  setVersionControlRemoteStatus(parts.join(' · ') || 'Working tree clean');
}

function matchesGitFilter(value, query) {
  if (!query) return true;
  return String(value).toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function renderFilteredGitHistory() {
  const list = document.getElementById('git-commit-list');
  const status = document.getElementById('git-history-status');
  if (!list) return;
  const query = gitHistoryFilter.trim();
  const visibleCommits = query
    ? gitHistoryCommits.filter((commit) => matchesGitFilter(`${commit.subject} ${commit.author} ${commit.shortHash} ${commit.hash}`, query))
    : gitHistoryCommits;
  if (!visibleCommits.length) {
    list.innerHTML = `<div class="git-empty-state">${gitHistoryCommits.length ? 'No commits match this filter.' : 'No commits found.'}</div>`;
    if (status) status.textContent = gitHistoryCommits.length ? 'No matching commits' : 'No commits';
    return;
  }
  list.innerHTML = visibleCommits.map((commit) => `<button class="git-commit-item${commit.hash === selectedGitCommit?.hash ? ' active' : ''}${commit.unpushed ? ' unpushed' : ''}" type="button" data-git-commit="${escapeHTML(commit.hash)}"><span class="git-commit-subject">${escapeHTML(commit.subject)}</span><span class="git-commit-item-meta"><code>${escapeHTML(commit.shortHash)}</code>${commit.unpushed ? '<span class="git-commit-unpushed" title="Not pushed to origin yet">Unpushed</span>' : ''}<span>${escapeHTML(commit.author)}</span><time>${escapeHTML(formatGitDate(commit.date))}</time></span></button>`).join('');
  const unpushedVisible = visibleCommits.filter((commit) => commit.unpushed).length;
  const countLabel = query ? `${visibleCommits.length} of ${gitHistoryCommits.length} commits` : `${gitHistoryCommits.length} recent commit${gitHistoryCommits.length === 1 ? '' : 's'}`;
  if (status) status.textContent = unpushedVisible ? `${countLabel} · ${unpushedVisible} not pushed to origin` : countLabel;
}

function renderGitHistory(commits) {
  gitHistoryCommits = Array.isArray(commits) ? commits : [];
  if (!gitHistoryCommits.length) {
    selectedGitCommit = null;
    renderGitCommitDetail(null);
  }
  renderFilteredGitHistory();
}

function formatGitDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderGitCommitDetail(commit, diff = null) {
  const hash = document.getElementById('git-commit-hash');
  const title = document.getElementById('git-commit-title');
  const meta = document.getElementById('git-commit-meta');
  const count = document.getElementById('git-commit-files-count');
  const files = document.getElementById('git-commit-files');
  const output = document.getElementById('git-commit-diff');
  if (!commit) {
    if (hash) hash.textContent = 'No commit selected';
    if (title) title.textContent = 'Select a commit';
    if (meta) meta.textContent = 'Commit details will appear here.';
    if (count) count.textContent = '—';
    if (files) files.innerHTML = '<div class="git-empty-state">Select a commit to inspect its files.</div>';
    renderDiffOutput(output, null, 'Select a commit to inspect its diff.');
    return;
  }
  if (hash) hash.textContent = commit.shortHash;
  if (title) title.textContent = commit.subject;
  if (meta) meta.textContent = `${commit.author} · ${formatGitDate(commit.date)} · ${commit.hash}${commit.unpushed ? ' · Not pushed to origin' : ''}`;
  if (count) count.textContent = `${commit.files.length} file${commit.files.length === 1 ? '' : 's'}`;
  if (files) files.innerHTML = commit.files.length
    ? commit.files.map((file) => `<button class="git-commit-file" type="button" data-git-commit-file="${escapeHTML(file.path)}" title="Show diff for ${escapeHTML(file.path)}"><span class="git-file-status">${escapeHTML(file.status)}</span><code>${escapeHTML(file.path)}</code></button>`).join('')
    : '<div class="git-empty-state">No file changes recorded.</div>';
  if (output) renderDiffOutput(output, diff, diff === null ? 'Loading commit diff…' : 'No textual diff for this commit.');
}

function renderDiffOutput(output, diff, emptyMessage) {
  if (!output) return;
  if (!diff) {
    output.innerHTML = `<span class="git-diff-empty">${escapeHTML(emptyMessage)}</span>`;
    return;
  }
  output.innerHTML = diff.split('\n').map((line) => {
    const kind = line.startsWith('@@') ? 'hunk' : line.startsWith('+++') || line.startsWith('---') ? 'meta' : line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : 'context';
    return `<span class="git-diff-line ${kind}">${escapeHTML(line) || ' '}</span>`;
  }).join('');
}

function selectGitCommit(hash, file = null) {
  const commit = gitHistoryCommits.find((candidate) => candidate.hash === hash);
  if (!commit) return;
  selectedGitCommit = commit;
  renderGitHistory(gitHistoryCommits);
  renderGitCommitDetail(commit, null);
  if (nativeInvoke) void sendContextRequest('git.commit.diff', { repositoryPath: workspaceRootPath, commit: hash, ...(file ? { file } : {}) }, 'git-diff').catch((error) => notify(error instanceof Error ? error.message : 'Unable to load commit diff.'));
}

function renderPendingGitChanges(result) {
  const status = document.getElementById('git-pending-status');
  const files = document.getElementById('git-pending-files');
  const diff = document.getElementById('git-pending-diff');
  const count = document.getElementById('git-pending-file-count');
  const fileName = document.getElementById('git-pending-file-name');
  pendingGitFiles = result?.files ?? [];
  const query = pendingGitFilter.trim();
  const visibleFiles = query
    ? pendingGitFiles.filter((file) => matchesGitFilter(file.path, query))
    : pendingGitFiles;
  const nextSelectedFile = visibleFiles.find((file) => file.path === selectedPendingGitFile)?.path ?? visibleFiles[0]?.path ?? null;
  const selectionChanged = nextSelectedFile !== selectedPendingGitFile;
  selectedPendingGitFile = nextSelectedFile;
  const changedLabel = pendingGitFiles.length ? `${pendingGitFiles.length} file${pendingGitFiles.length === 1 ? '' : 's'} changed` : 'Working tree clean';
  if (status) status.textContent = query && pendingGitFiles.length ? `${visibleFiles.length} of ${pendingGitFiles.length} shown` : changedLabel;
  if (count) count.textContent = query && pendingGitFiles.length ? `${visibleFiles.length} of ${pendingGitFiles.length}` : changedLabel;
  if (fileName) fileName.textContent = selectedPendingGitFile ?? 'Select a file';
  if (files) files.innerHTML = visibleFiles.length
    ? visibleFiles.map((file) => `<button class="git-pending-file${file.path === selectedPendingGitFile ? ' active' : ''}" type="button" data-git-pending-file="${escapeHTML(file.path)}"><span class="git-file-status">${escapeHTML(file.status)}</span><code>${escapeHTML(file.path)}</code></button>`).join('')
    : `<div class="git-empty-state">${pendingGitFiles.length ? 'No files match this filter.' : 'No changes pending.'}</div>`;
  if (!pendingGitFiles.length) renderDiffOutput(diff, null, 'No pending changes.');
  else if (!visibleFiles.length) renderDiffOutput(diff, null, 'No files match this filter.');
  else if (selectionChanged) {
    renderDiffOutput(diff, null, 'Loading file diff…');
    requestPendingGitDiff(selectedPendingGitFile);
  }
  renderVersionControlRemoteStatus();
  renderCommitControls();
}

function requestPendingGitDiff(file) {
  if (!nativeInvoke || !workspaceRootPath || !file) return;
  const fileName = document.getElementById('git-pending-file-name');
  if (fileName) fileName.textContent = file;
  void sendContextRequest('git.pending.diff', { repositoryPath: workspaceRootPath, file }, 'git-pending-diff').catch((error) => notify(error instanceof Error ? error.message : 'Unable to load file diff.'));
}

function requestPendingGitChanges(path = workspaceRootPath, { showLoading = false } = {}) {
  if (!nativeInvoke || !path || activeVersionControl === 'none' || pendingGitRefreshInFlight) return;
  pendingGitRefreshInFlight = true;
  pendingGitRequestPath = path;
  if (showLoading) document.getElementById('git-pending-status')?.replaceChildren(document.createTextNode('Loading pending changes…'));
  void sendContextRequest('git.pending', { repositoryPath: path }, 'git-pending').catch((error) => {
    pendingGitRefreshInFlight = false;
    notify(error instanceof Error ? error.message : 'Unable to load pending changes.');
  });
}

function requestVersionControlData(path = workspaceRootPath) {
  if (!nativeInvoke || !path) return;
  if (activeVersionControl === 'none') {
    const message = 'This Project is not a Git repository.';
    document.getElementById('git-history-status')?.replaceChildren(document.createTextNode(message));
    document.getElementById('git-pending-status')?.replaceChildren(document.createTextNode(message));
    renderGitHistory([]);
    renderPendingGitChanges({ files: [], diff: '' });
    return;
  }
  document.getElementById('git-history-status')?.replaceChildren(document.createTextNode('Loading history…'));
  document.getElementById('git-pending-status')?.replaceChildren(document.createTextNode('Loading pending changes…'));
  void sendContextRequest('git.history', { repositoryPath: path }, 'git-history').catch((error) => notify(error instanceof Error ? error.message : 'Unable to load commit history.'));
  requestPendingGitChanges(path, { showLoading: true });
}

function setSyncState(state, message) {
  const syncLabel = document.querySelector('.sync-label');
  const syncText = document.querySelector('.sync-text');
  if (!syncLabel || !syncText) return;
  syncLabel.dataset.syncState = state;
  syncText.textContent = message;
}

function renderRuntimeStatus(status) {
  const sidecar = document.getElementById('runtime-sidecar-status');
  const agent = document.getElementById('runtime-agent-status');
  const event = document.getElementById('runtime-last-event');
  const detail = document.getElementById('runtime-agent-detail');
  const error = document.getElementById('runtime-error-detail');
  if (sidecar) sidecar.textContent = status.sidecar.replaceAll('_', ' ');
  if (agent) agent.textContent = status.agentRuntime.replaceAll('_', ' ');
  if (event) event.textContent = status.lastEventAt ? new Date(status.lastEventAt).toLocaleString() : '—';
  if (detail) detail.textContent = status.activeTaskId ? `Task ${status.activeTaskId} is active.` : 'No agent session is running.';
  if (error) error.textContent = status.lastError ?? 'No runtime events recorded.';
}

function renderServiceStatus(status) {
  const element = document.getElementById('runtime-service-status');
  if (element && status?.status) element.textContent = status.status;
}

function renderServices(services) {
  const list = document.getElementById('runtime-service-list');
  if (!list) return;
  list.innerHTML = services.length
    ? services.map((service) => `<li class="runtime-service"><span><strong>${escapeHTML(service.id)}</strong><small>${escapeHTML(service.command)} · ${escapeHTML(service.cwd)}${service.healthcheck ? ' · healthcheck' : ''}</small></span><span class="service-status ${escapeHTML(service.status.toLowerCase())}">${escapeHTML(service.status)}</span><button class="text-button" data-service-action="start" data-service-id="${escapeHTML(service.id)}">Start</button><button class="text-button" data-service-action="stop" data-service-id="${escapeHTML(service.id)}">Stop</button></li>`).join('')
    : '<li class="runtime-service-empty">No services declared in .ade/services.json.</li>';
}

function renderRuntimeEvent(taskId, event) {
  const list = document.getElementById('runtime-events');
  if (!list) return;
  const payload = event?.payload;
  const label = typeof payload?.type === 'string' ? payload.type : event?.type ?? 'runtime.event';
  runtimeEvents.unshift({ taskId, label, at: new Date().toLocaleTimeString() });
  runtimeEvents.splice(12);
  list.innerHTML = runtimeEvents.map((item) => `<li class="runtime-event"><span class="runtime-event-time">${escapeHTML(item.at)}</span><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.taskId)}</small></li>`).join('');
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

/** Paths arrive from Tauri spelled the way the platform spells them, so Windows
    sends `\`. Nothing in the shell may assume a separator: every split and every
    prefix test goes through these, which accept either. */
const pathSegments = (value) => String(value ?? '').split(/[\\/]+/).filter(Boolean);
const pathBaseName = (value) => pathSegments(value).at(-1) ?? '';

function pathInsideRoot(filePath, root = workspaceRootPath) {
  if (!filePath || !root) return false;
  const separatorAgnostic = (value) => String(value).replaceAll('\\', '/');
  return separatorAgnostic(filePath).startsWith(`${separatorAgnostic(root).replace(/\/+$/, '')}/`);
}

function documentRelativePath(filePath) {
  // Normalizing preserves length, so the original string can still be sliced.
  return pathInsideRoot(filePath) ? String(filePath).slice(workspaceRootPath.length + 1) : filePath;
}

function updateWorkspaceFileSelection(filePath) {
  selectedFilePath = filePath;
  document.querySelectorAll('[data-file-path].selected').forEach((entry) => entry.classList.remove('selected'));
  const selectedEntry = [...document.querySelectorAll('[data-file-path]')].find((entry) => entry.dataset.filePath === filePath);
  selectedEntry?.classList.add('selected');
  selectedEntry?.setAttribute('aria-current', 'page');
  if (!explorerExpanded && !document.getElementById('workspace-filter')?.value.trim()) void loadWorkspaceTree(workspaceRootPath, nativeInvoke);
}

function setDocumentHeader({ title, path, kind, externalDisabled = true }) {
  const titleElement = document.getElementById('document-title');
  const pathElement = document.getElementById('document-path');
  const kindElement = document.getElementById('document-kind');
  const externalButton = document.getElementById('open-file-external');
  if (titleElement) titleElement.textContent = title;
  if (pathElement) pathElement.textContent = path;
  if (kindElement) kindElement.textContent = kind;
  if (externalButton) externalButton.disabled = externalDisabled;
}

const codeLanguageDefinitions = [
  { label: 'JavaScript', extensions: ['js', 'mjs', 'cjs', 'jsx'], language: () => javascript({ jsx: true }) },
  { label: 'TypeScript', extensions: ['ts', 'mts', 'cts', 'tsx'], language: () => javascript({ jsx: true, typescript: true }) },
  { label: 'C++', extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'], language: () => cpp() },
  { label: 'Java', extensions: ['java'], language: () => java() },
  { label: 'PHP', extensions: ['php'], language: () => php() },
  { label: 'Python', extensions: ['py', 'pyw'], language: () => python() },
  { label: 'Rust', extensions: ['rs'], language: () => rust() },
  { label: 'CSS', extensions: ['css', 'scss'], language: () => css() },
  { label: 'HTML', extensions: ['html', 'htm'], language: () => html() },
  { label: 'JSON', extensions: ['json', 'jsonc'], language: () => json() },
  { label: 'Markdown', extensions: ['md', 'markdown'], language: () => markdown() },
  { label: 'SQL', extensions: ['sql'], language: () => sql() },
  { label: 'XML', extensions: ['xml', 'svg', 'xsl', 'xsd'], language: () => xml() },
  { label: 'YAML', extensions: ['yml', 'yaml'], language: () => yaml() },
];

const monacoLanguageDefinitions = [
  { label: 'C', extensions: ['c', 'h'], monacoLanguage: 'c' },
  { label: 'C#', extensions: ['cs', 'csx', 'cake'], monacoLanguage: 'csharp' },
  { label: 'Dart', extensions: ['dart'], monacoLanguage: 'dart' },
  { label: 'Dockerfile', fileNames: ['dockerfile', 'containerfile'], monacoLanguage: 'dockerfile' },
  { label: 'Elixir', extensions: ['ex', 'exs'], monacoLanguage: 'elixir' },
  { label: 'F#', extensions: ['fs', 'fsi', 'fsx', 'fsscript'], monacoLanguage: 'fsharp' },
  { label: 'Go', extensions: ['go'], monacoLanguage: 'go' },
  { label: 'GraphQL', extensions: ['graphql', 'gql'], monacoLanguage: 'graphql' },
  { label: 'Kotlin', extensions: ['kt', 'kts'], monacoLanguage: 'kotlin' },
  { label: 'Lua', extensions: ['lua'], monacoLanguage: 'lua' },
  { label: 'Objective-C', extensions: ['m', 'mm'], monacoLanguage: 'objective-c' },
  { label: 'Perl', extensions: ['pl', 'pm', 'pod'], monacoLanguage: 'perl' },
  { label: 'PowerShell', extensions: ['ps1', 'psm1', 'psd1'], monacoLanguage: 'powershell' },
  { label: 'Protocol Buffers', extensions: ['proto'], monacoLanguage: 'proto' },
  { label: 'R', extensions: ['r', 'R'], monacoLanguage: 'r' },
  { label: 'Ruby', extensions: ['rb', 'rake', 'gemspec'], monacoLanguage: 'ruby' },
  { label: 'Scala', extensions: ['scala', 'sc'], monacoLanguage: 'scala' },
  { label: 'Shell', extensions: ['sh', 'bash', 'zsh', 'fish'], monacoLanguage: 'shell' },
  { label: 'Swift', extensions: ['swift'], monacoLanguage: 'swift' },
];

const formatterParsers = {
  js: 'babel', mjs: 'babel', cjs: 'babel', jsx: 'babel',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
  json: 'json-stringify', jsonc: 'json', css: 'css', scss: 'scss',
  html: 'html', htm: 'html', md: 'markdown', markdown: 'markdown', yaml: 'yaml', yml: 'yaml',
};

function fileExtension(filePath = '') {
  return pathBaseName(filePath).toLowerCase().split('.').at(-1) ?? '';
}

function definitionMatchesPath(definition, filePath) {
  const extension = fileExtension(filePath);
  const fileName = pathBaseName(filePath).toLowerCase();
  return definition.extensions?.includes(extension) || definition.fileNames?.some((name) => name.toLowerCase() === fileName);
}

function editorDefinitionForPath(filePath) {
  return codeLanguageDefinitions.find((definition) => definitionMatchesPath(definition, filePath))
    ?? monacoLanguageDefinitions.find((definition) => definitionMatchesPath(definition, filePath));
}

function languageLabelForPath(filePath) {
  return editorDefinitionForPath(filePath)?.label ?? 'Plain text';
}

function formatterParserForPath(filePath) {
  return formatterParsers[fileExtension(filePath)] ?? null;
}

function initializeCodeEditor() {
  const parent = document.getElementById('document-content');
  if (!parent || codeEditorView) return;
  codeEditorView = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        codeEditorLanguage.of([]),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        indentOnInput(),
        EditorView.lineWrapping,
        keymap.of([
          indentWithTab,
          { key: 'Mod-s', run: () => { void saveActiveDocument(); return true; } },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) updateDocumentEditState();
        }),
      ],
    }),
    parent,
  });
}

async function initializeMonacoEditor() {
  const parent = document.getElementById('document-content');
  if (!parent) return null;
  await loadMonaco();
  if (monacoEditor) return monacoEditor;
  monacoEditor = monaco.editor.create(parent, {
    value: '',
    language: 'plaintext',
    theme: document.documentElement.dataset.theme === 'light' ? 'ade-light' : 'ade-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    renderWhitespace: 'selection',
    tabSize: 2,
    insertSpaces: true,
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    lineHeight: 19,
    padding: { top: 14, bottom: 24 },
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  });
  monacoEditor.onDidChangeModelContent(() => updateDocumentEditState());
  monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { void saveActiveDocument(); });
  return monacoEditor;
}

function showEditorEngine(engine) {
  const parent = document.getElementById('document-content');
  if (!parent) return;
  parent.querySelector('.cm-editor')?.classList.toggle('editor-engine-hidden', engine !== 'codemirror');
  parent.querySelector('.monaco-editor')?.classList.toggle('editor-engine-hidden', engine !== 'monaco');
}

async function setCodeEditorContent(content = '', filePath = '', focus = false) {
  const definition = editorDefinitionForPath(filePath);
  if (definition?.monacoLanguage) {
    await initializeMonacoEditor();
    if (!monacoEditor) return;
    monacoEditor.setValue(content);
    const model = monacoEditor.getModel();
    if (model) monaco.editor.setModelLanguage(model, definition.monacoLanguage);
    activeEditorEngine = 'monaco';
    showEditorEngine(activeEditorEngine);
    if (focus) monacoEditor.focus();
    return;
  }
  initializeCodeEditor();
  if (!codeEditorView) return;
  const current = codeEditorView.state.doc.toString();
  const language = definition?.language;
  codeEditorView.dispatch({
    changes: { from: 0, to: current.length, insert: content },
    effects: codeEditorLanguage.reconfigure(language ? language() : []),
  });
  activeEditorEngine = 'codemirror';
  showEditorEngine(activeEditorEngine);
  if (focus) codeEditorView.focus();
}

function codeEditorValue() {
  return activeEditorEngine === 'monaco'
    ? monacoEditor?.getValue() ?? ''
    : codeEditorView?.state.doc.toString() ?? '';
}

function updateDocumentEditState() {
  const editor = document.getElementById('document-content');
  const saveButton = document.getElementById('save-file');
  const discardButton = document.getElementById('discard-file');
  const formatButton = document.getElementById('format-document');
  const kindElement = document.getElementById('document-kind');
  const editable = Boolean(activeDocument?.kind === 'text' && editor && !editor.hidden);
  documentDirty = editable && codeEditorValue() !== documentOriginalContent;
  if (saveButton) saveButton.disabled = !documentDirty;
  if (discardButton) discardButton.disabled = !documentDirty;
  if (formatButton) {
    formatButton.disabled = !editable || !formatterParserForPath(activeDocument?.path);
    formatButton.title = formatButton.disabled && editable ? 'No formatter available for this language' : 'Format document';
  }
  if (kindElement && activeDocument?.kind === 'text') {
    const language = languageLabelForPath(activeDocument.path);
    kindElement.textContent = documentDirty ? `${language} · UNSAVED` : language;
  }
  updateRevealOpenFileButton();
  syncActiveDocumentTabState();
}

/** Called on every keystroke, so it touches the one tab that changed instead
    of repainting the strip and throwing away its focus. */
function syncActiveDocumentTabState() {
  const record = documentTabById(activeDocumentId);
  if (!record) return;
  record.dirty = documentDirty;
  record.buffer = documentDirty ? codeEditorValue() : record.original;
  const button = document.querySelector(`[data-document-tab-id="${CSS.escape(record.id)}"]`);
  const tab = button?.parentElement;
  if (!tab) return;
  tab.classList.toggle('dirty', documentDirty);
  const location = record.relativePath ?? record.path;
  button.title = documentDirty ? `${location} — unsaved changes` : location;
  const close = tab.querySelector('.document-tab-close');
  close?.setAttribute('aria-label', `Close ${record.name}${documentDirty ? ', discarding unsaved changes' : ''}`);
}

function documentTabById(id) {
  return openDocuments.find((entry) => entry.id === id) ?? null;
}

function documentTabByPath(filePath) {
  return openDocuments.find((entry) => entry.path === filePath) ?? null;
}

/** The live editor holds the active tab's text until the moment it is swapped
    out, so its value and caret are folded back into the record first. Without
    this, the unsaved work of every tab but the last would be the editor's to
    lose. */
function captureActiveDocumentBuffer() {
  const record = documentTabById(activeDocumentId);
  if (!record || record.state !== 'ready' || record.kind !== 'text') return;
  record.buffer = codeEditorValue();
  record.dirty = record.buffer !== record.original;
  if (activeEditorEngine === 'monaco') {
    record.caret = monacoEditor?.getPosition() ?? null;
    record.scrollTop = monacoEditor?.getScrollTop() ?? 0;
  } else if (codeEditorView) {
    record.caret = codeEditorView.state.selection.main.head;
    record.scrollTop = codeEditorView.scrollDOM.scrollTop;
  }
}

function restoreDocumentCaret(record) {
  if (record.caret === null || record.caret === undefined) return;
  try {
    if (activeEditorEngine === 'monaco' && monacoEditor) {
      if (typeof record.caret === 'object') monacoEditor.setPosition(record.caret);
      monacoEditor.setScrollTop(record.scrollTop ?? 0);
      return;
    }
    if (!codeEditorView || typeof record.caret !== 'number') return;
    const anchor = Math.min(record.caret, codeEditorView.state.doc.length);
    codeEditorView.dispatch({ selection: { anchor } });
    codeEditorView.scrollDOM.scrollTop = record.scrollTop ?? 0;
  } catch { /* The file may have been shortened outside Assay since. */ }
}

/** Every path through the editor ends here, so loading, ready, unreadable and
    "nothing open" all resolve to one account of what the panel should show. */
async function renderActiveDocument({ focus = false } = {}) {
  const viewer = document.getElementById('document-viewer');
  const status = document.getElementById('document-viewer-status');
  const content = document.getElementById('document-content');
  const empty = document.getElementById('document-empty-state');
  if (!viewer || !status || !content || !empty) return;
  viewer.hidden = false;
  const record = documentTabById(activeDocumentId);
  activeDocument = record;
  renderDocumentTabs();
  if (!record) {
    empty.hidden = false;
    status.hidden = true;
    content.hidden = true;
    setDocumentHeader({ title: 'No file selected', path: 'Select a file from Explorer to open it.', kind: '—', externalDisabled: true });
    await setCodeEditorContent('');
    documentOriginalContent = '';
    documentDirty = false;
    updateDocumentEditState();
    return;
  }
  empty.hidden = true;
  const kindLabel = record.state === 'loading' ? 'LOADING'
    : record.state === 'error' ? 'FAILED'
    : record.kind === 'text' ? 'TEXT' : String(record.kind ?? '').toUpperCase();
  setDocumentHeader({
    title: record.name,
    path: record.relativePath ?? documentRelativePath(record.path),
    kind: kindLabel,
    externalDisabled: record.state === 'loading',
  });
  const isText = record.state === 'ready' && record.kind === 'text';
  status.hidden = isText;
  status.textContent = record.state === 'loading' ? 'Reading file…'
    : record.state === 'error' ? `Unable to read file: ${record.message}`
    : isText ? '' : (record.message ?? 'This file cannot be previewed inside Assay.');
  content.hidden = !isText;
  await setCodeEditorContent(isText ? (record.buffer ?? '') : '', record.path, isText && focus);
  documentOriginalContent = isText ? (record.original ?? '') : '';
  documentDirty = false;
  if (isText) restoreDocumentCaret(record);
  updateDocumentEditState();
  if (isText && focus) (activeEditorEngine === 'monaco' ? monacoEditor : codeEditorView)?.focus();
}

async function loadDocumentRecord(record) {
  if (!nativeInvoke) return;
  record.state = 'loading';
  if (record.id === activeDocumentId) await renderActiveDocument();
  else renderDocumentTabs();
  try {
    const result = await nativeInvoke('read_file', { path: record.path });
    Object.assign(record, {
      state: 'ready',
      kind: result.kind,
      name: result.name ?? record.name,
      relativePath: result.relativePath ?? record.relativePath,
      message: result.message ?? '',
      size: result.size,
      original: result.kind === 'text' ? (result.content ?? '') : '',
      buffer: result.kind === 'text' ? (result.content ?? '') : '',
      dirty: false,
    });
  } catch (error) {
    Object.assign(record, { state: 'error', message: String(error), original: '', buffer: '', dirty: false });
    notify('Unable to read file inside Assay.');
    console.warn('File preview unavailable:', error);
  }
  if (record.id === activeDocumentId) await renderActiveDocument({ focus: true });
  else renderDocumentTabs();
}

async function activateDocumentTab(id, { focus = true } = {}) {
  if (!documentTabById(id)) return;
  if (id !== activeDocumentId) captureActiveDocumentBuffer();
  activeDocumentId = id;
  const record = documentTabById(id);
  // Moving between tabs deliberately leaves the tree where it is. A tree that
  // re-expands and scrolls on every switch loses the place you put it in, so
  // locating the open file stays an action you ask for, on the Explorer's own
  // crosshair.
  // A restored tab carries no text until it is looked at, so a session with
  // many files reopens in one read rather than in as many reads as it had tabs.
  if (record.state === 'pending') await loadDocumentRecord(record);
  else await renderActiveDocument({ focus });
  persistOpenDocuments();
  scrollDocumentTabIntoView(id);
}

async function openFileInADE(filePath) {
  if (!nativeInvoke) {
    notify('Opening files requires the local desktop runtime.');
    return;
  }
  showView('editor');
  const existing = documentTabByPath(filePath);
  if (existing) {
    await activateDocumentTab(existing.id);
    return;
  }
  captureActiveDocumentBuffer();
  const record = {
    id: `document-${++documentTabSequence}`,
    path: filePath,
    name: pathBaseName(filePath) || 'File',
    relativePath: documentRelativePath(filePath),
    kind: 'text',
    state: 'pending',
    original: '',
    buffer: '',
    dirty: false,
    message: '',
    caret: null,
    scrollTop: 0,
  };
  openDocuments.push(record);
  activeDocumentId = record.id;
  updateWorkspaceFileSelection(filePath);
  await loadDocumentRecord(record);
  persistOpenDocuments();
  scrollDocumentTabIntoView(record.id);
}

function closeDocumentTab(id) {
  const record = documentTabById(id);
  if (!record) return;
  const dirty = id === activeDocumentId ? (documentDirty || record.dirty) : record.dirty;
  if (dirty) {
    requestConfirmation({
      eyebrow: 'DISCARD CHANGES',
      title: `Discard unsaved changes to ${record.name}?`,
      copy: `Edits to ${record.relativePath ?? record.path} have not been saved. Closing this tab loses them.`,
      confirmLabel: 'Discard',
      tone: 'danger',
    }, () => { void closeDocumentTabNow(id); });
    return;
  }
  void closeDocumentTabNow(id);
}

async function closeDocumentTabNow(id) {
  const index = openDocuments.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  const wasActive = id === activeDocumentId;
  openDocuments.splice(index, 1);
  if (!wasActive) {
    renderDocumentTabs();
    persistOpenDocuments();
    return;
  }
  // Closing the tab in front of you hands the panel to its right-hand
  // neighbour, and to its left when it was the last one.
  const next = openDocuments[index] ?? openDocuments[index - 1] ?? null;
  activeDocumentId = next?.id ?? null;
  // Closing a tab is not a statement about the tree either, so the Explorer
  // keeps whatever it was showing.
  if (next && next.state === 'pending') await loadDocumentRecord(next);
  else await renderActiveDocument({ focus: Boolean(next) });
  persistOpenDocuments();
}

async function closeFilePreview() {
  if (activeDocumentId) closeDocumentTab(activeDocumentId);
}

/** Two files called `index.ts` are two different files, so a tab that shows
    only the basename is a tab you cannot trust. Only the ambiguous ones pay
    for the extra parent segment. */
function documentTabLabels() {
  const counts = new Map();
  for (const record of openDocuments) counts.set(record.name, (counts.get(record.name) ?? 0) + 1);
  return new Map(openDocuments.map((record) => {
    if ((counts.get(record.name) ?? 0) < 2) return [record.id, ''];
    const segments = pathSegments(record.relativePath ?? record.path);
    return [record.id, segments.slice(-2, -1)[0] ?? ''];
  }));
}

function renderDocumentTabs() {
  const strip = document.getElementById('document-tabs');
  const row = document.querySelector('.document-tabs-row');
  if (!strip) return;
  row?.classList.toggle('is-empty', openDocuments.length === 0);
  const labels = documentTabLabels();
  strip.innerHTML = openDocuments.map((record) => {
    const active = record.id === activeDocumentId;
    const dirty = active ? (documentDirty || record.dirty) : record.dirty;
    const name = escapeHTML(record.name);
    const where = labels.get(record.id);
    const location = escapeHTML(record.relativePath ?? record.path);
    const classes = ['document-tab', active ? 'active' : '', dirty ? 'dirty' : '', record.state === 'error' ? 'failed' : ''].filter(Boolean).join(' ');
    // Delete closes the focused tab, which is how the close control stays
    // reachable without adding a second stop to the roving tab order.
    const hint = dirty ? `${location} — unsaved changes` : location;
    return `<div class="${classes}" role="presentation"><button class="document-tab-button" type="button" role="tab" id="document-tab-${escapeHTML(record.id)}" aria-selected="${active}" aria-controls="document-viewer-body" tabindex="${active ? '0' : '-1'}" data-document-tab-id="${escapeHTML(record.id)}" title="${hint}"><span class="document-tab-name">${name}</span>${where ? `<span class="document-tab-where">${escapeHTML(where)}</span>` : ''}</button><button class="document-tab-close" type="button" tabindex="-1" data-document-close-id="${escapeHTML(record.id)}" aria-label="Close ${name}${dirty ? ', discarding unsaved changes' : ''}" title="Close ${name}"><span class="document-tab-dot" aria-hidden="true"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></div>`;
  }).join('');
  updateDocumentTabsOverflow();
}

function scrollDocumentTabIntoView(id) {
  const tab = document.querySelector(`[data-document-tab-id="${CSS.escape(id)}"]`);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  tab?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
}

/** The strip scrolls, but a scrolled-away tab is a tab you cannot find. The
    menu appears only once the strip actually overflows. */
function updateDocumentTabsOverflow() {
  const strip = document.getElementById('document-tabs');
  const more = document.getElementById('document-tabs-more');
  if (!strip || !more) return;
  const overflowing = strip.scrollWidth - strip.clientWidth > 1;
  more.hidden = !overflowing;
  if (!overflowing) closeDocumentTabsMenu();
}

function closeDocumentTabsMenu() {
  const menu = document.getElementById('document-tabs-menu');
  const more = document.getElementById('document-tabs-more');
  if (menu) menu.hidden = true;
  more?.setAttribute('aria-expanded', 'false');
}

function toggleDocumentTabsMenu() {
  const menu = document.getElementById('document-tabs-menu');
  const more = document.getElementById('document-tabs-more');
  if (!menu || !more) return;
  if (!menu.hidden) { closeDocumentTabsMenu(); more.focus(); return; }
  const labels = documentTabLabels();
  menu.innerHTML = openDocuments.map((record) => {
    const active = record.id === activeDocumentId;
    const dirty = active ? (documentDirty || record.dirty) : record.dirty;
    const where = labels.get(record.id) || pathSegments(record.relativePath ?? record.path).slice(0, -1).join(' / ');
    return `<button class="document-tabs-menu-item${active ? ' active' : ''}" type="button" role="menuitem" data-document-tab-id="${escapeHTML(record.id)}"><span class="document-tabs-menu-name">${escapeHTML(record.name)}</span><span class="document-tabs-menu-where">${escapeHTML(where || 'Project root')}</span>${dirty ? '<span class="document-tabs-menu-dirty" aria-label="Unsaved changes">unsaved</span>' : ''}</button>`;
  }).join('');
  menu.hidden = false;
  more.setAttribute('aria-expanded', 'true');
  menu.querySelector('.document-tabs-menu-item.active, .document-tabs-menu-item')?.focus();
}

const openDocumentsStorageKey = 'ade-open-documents';
/** Files opened while no Task is selected are still worth remembering, so the
    Project keeps a slot of its own alongside its Tasks. */
const noTaskDocumentScope = '__no-task__';
let documentScopeKey = null;
let documentScopeTransition = Promise.resolve();

function documentSessionScope() {
  return { project: workspaceRootPath ?? '', task: selectedTaskId ?? noTaskDocumentScope };
}

/** The store began as one set per Project. Fold that shape into the Project's
    no-Task slot instead of dropping the files it holds. */
function readOpenDocumentSessions() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(openDocumentsStorageKey) ?? '{}') ?? {}; } catch { return {}; }
  for (const [project, entry] of Object.entries(stored)) {
    if (entry && Array.isArray(entry.paths)) stored[project] = { [noTaskDocumentScope]: entry };
  }
  return stored;
}

function persistOpenDocuments() {
  const { project, task } = documentSessionScope();
  if (!project) return;
  try {
    const stored = readOpenDocumentSessions();
    stored[project] = {
      ...(stored[project] ?? {}),
      [task]: {
        paths: openDocuments.map((record) => record.path),
        active: documentTabById(activeDocumentId)?.path ?? null,
      },
    };
    localStorage.setItem(openDocumentsStorageKey, JSON.stringify(stored));
  } catch { /* Persistence is optional. */ }
}

/** Tabs belong to a Project and a Task together, so changing either swaps the
    working set. Every mutation persists as it happens, which is why the
    outgoing set needs no saving here. */
async function syncDocumentScope() {
  const { project, task } = documentSessionScope();
  const scope = `${project}\n${task}`;
  if (scope === documentScopeKey) return documentScopeTransition;
  // Claimed before the first await, because the render paths that fire this
  // run in bursts and a second restore would clear the list the first one is
  // still reading a file into.
  documentScopeKey = scope;
  documentScopeTransition = documentScopeTransition
    .then(() => restoreOpenDocuments(project, task))
    .catch((error) => { console.warn('Open files could not be restored:', error); });
  return documentScopeTransition;
}

/** Reopen the tabs this Project and Task were left with. Only the one that gets
    focus is read from disk; the rest stay pending until they are looked at. */
async function restoreOpenDocuments(project, task) {
  openDocuments = [];
  activeDocumentId = null;
  activeDocument = null;
  // A Task seen for the first time has nothing remembered, and opens empty.
  const session = readOpenDocumentSessions()[project]?.[task] ?? null;
  const paths = Array.isArray(session?.paths) ? session.paths.filter((path) => typeof path === 'string' && pathInsideRoot(path)) : [];
  for (const path of paths) {
    openDocuments.push({
      id: `document-${++documentTabSequence}`,
      path,
      name: pathBaseName(path) || 'File',
      relativePath: documentRelativePath(path),
      kind: 'text',
      state: 'pending',
      original: '',
      buffer: '',
      dirty: false,
      message: '',
      caret: null,
      scrollTop: 0,
    });
  }
  const active = documentTabByPath(session?.active) ?? openDocuments[0] ?? null;
  if (!active) { await renderActiveDocument(); return; }
  activeDocumentId = active.id;
  await loadDocumentRecord(active);
}

function focusDocumentTabAt(index) {
  const record = openDocuments[index];
  if (!record) return;
  void activateDocumentTab(record.id);
  requestAnimationFrame(() => document.querySelector(`[data-document-tab-id="${CSS.escape(record.id)}"]`)?.focus());
}

function stepDocumentTab(offset) {
  if (openDocuments.length < 2) return;
  const current = openDocuments.findIndex((record) => record.id === activeDocumentId);
  const next = (current + offset + openDocuments.length) % openDocuments.length;
  focusDocumentTabAt(next);
}

async function saveActiveDocument() {
  const editor = document.getElementById('document-content');
  if (!nativeInvoke || !editor || activeDocument?.kind !== 'text' || !activeDocument.path) return;
  const content = codeEditorValue();
  try {
    await nativeInvoke('write_file', { path: activeDocument.path, content });
    documentOriginalContent = content;
    // The record is the tab, so saving writes through it rather than replacing
    // the object the strip and the close path are holding on to.
    Object.assign(activeDocument, { content, original: content, buffer: content, size: new TextEncoder().encode(content).length });
    updateDocumentEditState();
    notify('File saved in Assay.');
  } catch (error) {
    notify('Unable to save file.');
    console.warn('File save unavailable:', error);
  }
}

async function discardDocumentChanges() {
  const editor = document.getElementById('document-content');
  if (!editor || !documentDirty) return;
  requestConfirmation({
    eyebrow: 'DISCARD CHANGES',
    title: 'Discard unsaved changes?',
    copy: `Edits to ${activeDocument?.path ?? 'this file'} are restored to the last saved version. This cannot be undone.`,
    confirmLabel: 'Discard',
    tone: 'danger',
  }, async () => {
    await setCodeEditorContent(documentOriginalContent, activeDocument?.path ?? '', true);
    updateDocumentEditState();
    notify('Unsaved changes discarded.');
  });
}

async function formatActiveDocument() {
  const editor = document.getElementById('document-content');
  const parser = formatterParserForPath(activeDocument?.path);
  if (!editor || editor.hidden || activeDocument?.kind !== 'text' || !parser) return;
  const formatButton = document.getElementById('format-document');
  if (formatButton) formatButton.disabled = true;
  try {
    const { prettier, plugins } = await loadPrettier();
    const formatted = await prettier.format(codeEditorValue(), {
      parser,
      plugins,
      filepath: activeDocument.path,
      tabWidth: 2,
      useTabs: false,
    });
    await setCodeEditorContent(formatted, activeDocument.path, true);
    updateDocumentEditState();
    notify('Document formatted.');
  } catch (error) {
    notify('Unable to format this document.');
    console.warn('Document formatting unavailable:', error);
  } finally {
    updateDocumentEditState();
  }
}

function providerIsAvailable(providerId) {
  const provider = providerStatuses.find((item) => item.id === providerId);
  return !provider || provider.available;
}

/** An agent's default model seeds a new conversation and nothing else: once a
    conversation has a model of its own, that choice stays with it and outranks
    a default set or changed later. */
const agentDefaultModelStorageKey = 'ade-agent-default-model';
let agentDefaultModels = {};
try { agentDefaultModels = JSON.parse(localStorage.getItem(agentDefaultModelStorageKey) ?? '{}') ?? {}; } catch { agentDefaultModels = {}; }

function defaultModelForProvider(providerId) {
  const stored = agentDefaultModels[providerId];
  if (typeof stored !== 'string' || !stored) return '';
  const provider = providerStatuses.find((item) => item.id === providerId);
  if (provider?.models?.length && !provider.models.some((model) => model.id === stored)) return '';
  return stored;
}

function setDefaultModelForProvider(providerId, modelId) {
  if (modelId) agentDefaultModels[providerId] = modelId;
  else delete agentDefaultModels[providerId];
  try { localStorage.setItem(agentDefaultModelStorageKey, JSON.stringify(agentDefaultModels)); } catch { /* Persistence is optional. */ }
}

/** Marking a default never rewrites the open conversation: it is the starting
    point for the next one, so the operator's current turn cannot change model
    under them. */
function toggleDefaultModel(modelId) {
  const provider = providerStatuses.find((item) => item.id === selectedProvider);
  const wasDefault = defaultModelForProvider(selectedProvider) === modelId;
  const label = provider?.models?.find((model) => model.id === modelId)?.label ?? modelId;
  setDefaultModelForProvider(selectedProvider, wasDefault ? '' : modelId);
  renderAgentPicker('model');
  document.querySelector(`.picker-default[data-default-model="${CSS.escape(modelId)}"]`)?.focus();
  notify(wasDefault
    ? `${provider?.label ?? 'This agent'} has no default model.`
    : `New ${provider?.label ?? 'agent'} conversations start on ${label}.`);
}

/** The provider and model menus mirror the hidden selects that still hold the
    conversation's value, so every existing read of `agent-provider` and
    `agent-model` keeps working while the header renders the app's own menu. */
function agentPickerDetail(kind, value) {
  if (kind !== 'provider') return value;
  const provider = providerStatuses.find((item) => item.id === value);
  if (!provider) return '';
  return provider.available ? `${provider.auth} auth` : 'unavailable locally';
}

function agentPickerLabel(option) {
  return option.textContent.replace(' — unavailable', '');
}

function renderAgentPicker(kind) {
  const select = document.getElementById(`agent-${kind}`);
  const button = document.getElementById(`agent-${kind}-button`);
  const value = document.getElementById(`agent-${kind}-value`);
  const menu = document.getElementById(`agent-${kind}-menu`);
  if (!select || !button || !value || !menu) return;
  const options = [...select.options];
  const current = options.find((option) => option.value === select.value) ?? options[0];
  value.textContent = current ? agentPickerLabel(current) : '—';
  button.disabled = select.disabled || options.length === 0;
  if (button.disabled) {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  const rows = options.map((option) => {
    const selected = option.value === current?.value;
    const detail = agentPickerDetail(kind, option.value);
    const choose = `<button class="picker-option${selected ? ' selected' : ''}" type="button" role="menuitemradio" aria-checked="${selected}" data-picker-kind="${kind}" data-picker-value="${escapeHTML(option.value)}"${option.disabled ? ' disabled' : ''}><span class="git-option-mark" aria-hidden="true">${selected ? '✓' : ''}</span><span><strong>${escapeHTML(agentPickerLabel(option))}</strong>${detail ? `<small>${escapeHTML(detail)}</small>` : ''}</span></button>`;
    return `<div class="picker-row${selected ? ' selected' : ''}" role="none">${choose}${agentDefaultToggle(kind, option)}</div>`;
  }).join('');
  const note = kind === 'model' && options.some((option) => option.value)
    ? '<p class="picker-note">A starred model starts every new conversation with this agent.</p>'
    : '';
  menu.innerHTML = options.length
    ? `${rows}${note}`
    : `<p class="picker-empty">No ${kind === 'provider' ? 'provider' : 'model'} available.</p>`;
}

/** `Provider default` is the absence of a model override, so it is the one row
    that cannot itself be starred. */
function agentDefaultToggle(kind, option) {
  if (kind !== 'model' || !option.value) return '';
  const providerLabel = providerStatuses.find((item) => item.id === selectedProvider)?.label ?? 'this agent';
  const isDefault = defaultModelForProvider(selectedProvider) === option.value;
  const label = isDefault
    ? `${agentPickerLabel(option)} is the default model for ${providerLabel}. Clear it.`
    : `Make ${agentPickerLabel(option)} the default model for ${providerLabel}`;
  return `<button class="picker-default${isDefault ? ' is-default' : ''}" type="button" data-default-model="${escapeHTML(option.value)}" aria-pressed="${isDefault}" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.7 2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8z"/></svg></button>`;
}

function renderAgentPickers() {
  renderAgentPicker('provider');
  renderAgentPicker('model');
}

function closeAgentPickers() {
  document.querySelectorAll('.picker-menu').forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll('.picker-button').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function agentPickerIsOpen() {
  return Boolean(document.querySelector('.picker-menu:not([hidden])'));
}

function toggleAgentPicker(kind) {
  const menu = document.getElementById(`agent-${kind}-menu`);
  const button = document.getElementById(`agent-${kind}-button`);
  if (!menu || !button || button.disabled) return;
  const wasOpen = !menu.hidden;
  closeAgentPickers();
  if (wasOpen) return;
  renderAgentPicker(kind);
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  (menu.querySelector('.picker-option.selected') ?? menu.querySelector('.picker-option:not(:disabled)'))?.focus();
}

function chooseAgentPickerOption(kind, value) {
  const select = document.getElementById(`agent-${kind}`);
  closeAgentPickers();
  document.getElementById(`agent-${kind}-button`)?.focus();
  if (!select || select.value === value) return;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  renderAgentPickers();
}

function renderModelSelection(modelId = selectedAgentModel) {
  const select = document.getElementById('agent-model');
  if (!select) return;
  const provider = providerStatuses.find((item) => item.id === selectedProvider);
  const models = provider?.models?.length ? provider.models : [{ id: '', label: 'Provider default' }];
  selectedAgentModel = models.some((model) => model.id === modelId) ? modelId : defaultModelForProvider(selectedProvider);
  select.innerHTML = models.map((model) => `<option value="${escapeHTML(model.id)}"${model.id === selectedAgentModel ? ' selected' : ''}>${escapeHTML(model.label)}</option>`).join('');
  select.disabled = !providerIsAvailable(selectedProvider);
  renderAgentPickers();
}

function renderProviderSelection() {
  const detail = document.getElementById('agent-provider-status');
  if (!detail) return;
  const provider = providerStatuses.find((item) => item.id === selectedProvider);
  if (!provider) {
    detail.dataset.providerState = 'checking';
    detail.textContent = 'Checking local provider availability…';
    return;
  }
  detail.dataset.providerState = provider.available ? 'available' : 'unavailable';
  detail.textContent = `${provider.label} · ${provider.available ? 'available' : 'unavailable'} · ${provider.auth} auth · ${provider.capability.join(', ')}.`;
}

function renderProviders(providers) {
  providerStatuses = providers;
  const select = document.getElementById('agent-provider');
  const available = providers.filter((provider) => provider.available);
  if (!available.some((provider) => provider.id === selectedProvider)) selectedProvider = available[0]?.id ?? providers[0]?.id ?? 'opencode';
  if (select) {
    select.innerHTML = providers.map((provider) => `<option value="${escapeHTML(provider.id)}"${provider.id === selectedProvider ? ' selected' : ''}${provider.available ? '' : ' disabled'}>${escapeHTML(provider.label)}${provider.available ? '' : ' — unavailable'}</option>`).join('');
    select.disabled = available.length === 0;
  }
  const knowledgeDetail = document.getElementById('provider-detail');
  if (knowledgeDetail) knowledgeDetail.textContent = providers.map((provider) => `${provider.label}: ${provider.detail}`).join(' · ');
  renderProviderSelection();
  renderModelSelection();
}

function requestAgentSessions(path = workspaceRootPath) {
  if (!nativeInvoke || !path) return;
  const id = `agent-sessions-${Date.now()}`;
  pendingContextRequests.set(id, 'agent-sessions');
  pendingAgentSessionPaths.set(id, path);
  const list = document.getElementById('agent-session-list');
  if (list) list.innerHTML = '<p class="agent-empty-state">Loading sessions…</p>';
  nativeInvoke('sidecar_request', { request: JSON.stringify({ id, method: 'agent.sessions', params: { projectId: activeProjectId, repositoryPath: path } }) });
}

function requestAgentMessages(sessionId) {
  if (!nativeInvoke || !sessionId) return;
  const id = `agent-messages-${Date.now()}`;
  pendingContextRequests.set(id, 'agent-messages');
  pendingAgentMessageSessions.set(id, sessionId);
  nativeInvoke('sidecar_request', { request: JSON.stringify({ id, method: 'agent.messages', params: { sessionId, projectId: activeProjectId, repositoryPath: workspaceRootPath } }) });
}

function agentTaskForId(taskId) {
  return agentProjectTasks.find((task) => task.id === taskId);
}

function agentTaskName(taskId) {
  if (!taskId) return 'General';
  const task = agentTaskForId(taskId);
  return task?.intent ?? `Task ${taskId}`;
}

function agentSessionTitle(session) {
  return session.title?.trim() || `Conversation ${session.id.slice(0, 12)}`;
}

function agentSessionTimestamp(session) {
  const updated = new Date(session.updatedAt);
  return Number.isNaN(updated.valueOf()) ? '' : updated.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function agentGroupId(session) {
  return session.taskId ? `task:${session.taskId}` : 'general';
}

function renderAgentTaskSelection() {
  const activeSession = activeAgentSessionId ? agentSessions.find((session) => session.id === activeAgentSessionId) : null;
  const taskId = activeSession?.taskId ?? activeAgentTaskId ?? selectedTaskId ?? null;
  const context = document.getElementById('agent-session-context');
  if (context) context.textContent = agentTaskName(taskId);
}

function renderAgentSessions(sessions) {
  agentSessions = sessions;
  renderAgentTaskSelection();
  const railProject = document.getElementById('agent-rail-project');
  if (railProject) railProject.textContent = activeProject.name;
  const list = document.getElementById('agent-session-list');
  if (!list) return;
  if (!sessions.length) {
    list.innerHTML = '<p class="agent-empty-state">No conversations in this Project yet.</p>';
    return;
  }
  const groups = new Map();
  for (const session of sessions) {
    const id = agentGroupId(session);
    if (!groups.has(id)) groups.set(id, { id, taskId: session.taskId ?? null, sessions: [] });
    groups.get(id).sessions.push(session);
  }
  const orderedGroups = [...groups.values()].sort((left, right) => {
    if (left.id === 'general') return 1;
    if (right.id === 'general') return -1;
    return new Date(right.sessions[0].updatedAt).valueOf() - new Date(left.sessions[0].updatedAt).valueOf();
  });
  list.innerHTML = orderedGroups.map((group) => {
    const containsActive = group.sessions.some((session) => session.id === activeAgentSessionId);
    const expanded = containsActive || agentGroupExpansion.get(group.id) !== false;
    const groupLabel = group.taskId ? agentTaskName(group.taskId) : 'General';
    const task = group.taskId ? agentTaskForId(group.taskId) : null;
    const items = group.sessions.map((session) => `<div class="agent-session-item${session.id === activeAgentSessionId ? ' active' : ''}" role="listitem"><button class="agent-session-select" type="button" data-agent-session-id="${escapeHTML(session.id)}" aria-current="${session.id === activeAgentSessionId ? 'page' : 'false'}"><strong>${escapeHTML(agentSessionTitle(session))}</strong><span class="agent-session-item-meta"><span>${escapeHTML(session.provider)}</span><span>${escapeHTML(session.status.toLowerCase())}</span><time>${escapeHTML(agentSessionTimestamp(session))}</time></span></button><button class="agent-session-delete icon-button" type="button" data-delete-agent-session-id="${escapeHTML(session.id)}" aria-label="Delete saved conversation ${escapeHTML(agentSessionTitle(session))}" title="Delete saved conversation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M8 7l1-2h6l1 2m-9 0 1 13h6l1-13"/></svg></button></div>`).join('');
    return `<section class="agent-task-group${containsActive ? ' contains-active' : ''}" data-agent-group="${escapeHTML(group.id)}"><button class="agent-task-group-toggle" type="button" data-agent-group-toggle="${escapeHTML(group.id)}" aria-expanded="${expanded}" aria-controls="agent-group-${escapeHTML(group.id)}"><span><strong>${escapeHTML(groupLabel)}</strong>${task ? `<small>${escapeHTML(task.status.replaceAll('_', ' '))}</small>` : ''}</span><span class="agent-group-count">${group.sessions.length}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg></button><div class="agent-task-group-list" id="agent-group-${escapeHTML(group.id)}"${expanded ? '' : ' hidden'}>${items}</div></section>`;
  }).join('');
}

function resetAgentWorkspaceForProject() {
  activeAgentSessionId = null;
  activeAgentTaskId = null;
  activeAgentRequestId = null;
  agentStopRequested = false;
  agentPromptHistoryIndex = -1;
  agentPromptHistoryDraft = '';
  agentGroupExpansion.clear();
  agentSessions = [];
  selectedAgentModel = '';
  renderAgentSessions([]);
  renderAgentMessages([]);
  renderModelSelection();
  const providerLabel = document.getElementById('agent-session-provider');
  const title = document.getElementById('agent-session-title');
  const context = document.getElementById('agent-session-context');
  if (providerLabel) providerLabel.textContent = 'New conversation';
  if (title) title.textContent = 'Start a conversation';
  if (context) context.textContent = agentTaskName(activeAgentTaskId);
}

function agentActivityMarkup() {
  if (!pendingAgentTurn?.activity.length) return '';
  return `<ol class="agent-activity-trace">${pendingAgentTurn.activity.map((item) => `<li class="agent-activity-item agent-activity-${escapeHTML(item.kind)}"><span>${escapeHTML(item.label)}</span>${item.detail ? `<code>${escapeHTML(item.detail)}</code>` : ''}</li>`).join('')}</ol>`;
}

function pendingTurnMarkup() {
  if (!pendingAgentTurn) return '';
  const provider = escapeHTML(pendingAgentTurn.provider);
  // Only OpenCode reports what it is doing; for one-shot CLI runtimes the honest
  // signal is that the turn is running and for how long, not invented steps.
  const waiting = pendingAgentTurn.activity.length ? 'Working' : pendingAgentTurn.sessionId ? 'Thinking' : 'Sending';
  return `<li class="agent-message agent-message-user"><div class="agent-message-meta"><strong>You</strong><time>${escapeHTML(new Date(pendingAgentTurn.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</time></div><div class="agent-message-content">${escapeHTML(pendingAgentTurn.prompt)}</div></li>
    <li class="agent-message agent-message-assistant agent-message-pending" aria-live="polite"><div class="agent-message-meta"><strong>${provider}</strong><span class="agent-thinking"><span class="agent-thinking-dot" aria-hidden="true"></span>${waiting}</span><time id="agent-turn-elapsed">0s</time></div>${agentActivityMarkup()}</li>`;
}

function renderAgentMessages(messages) {
  const list = document.getElementById('agent-message-list');
  if (!list) return;
  agentRenderedMessages = messages;
  if (!messages.length && !pendingAgentTurn) {
    list.innerHTML = '<li class="agent-empty-state">Send a prompt to begin.</li>';
    return;
  }
  list.innerHTML = messages.map((message) => `<li class="agent-message agent-message-${escapeHTML(message.role)}"><div class="agent-message-meta"><strong>${escapeHTML(message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Agent' : 'Assay')}</strong><time>${escapeHTML(new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</time><button class="agent-message-copy" type="button" data-copy-message="${escapeHTML(message.id)}" aria-label="Copy this message" title="Copy"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg><span class="agent-copy-label">Copy</span></button></div><div class="agent-message-content">${escapeHTML(message.content)}</div></li>`).join('');
  list.innerHTML += pendingTurnMarkup();
  list.scrollTop = list.scrollHeight;
}

function startAgentElapsedTimer() {
  window.clearInterval(agentElapsedTimer);
  agentElapsedTimer = window.setInterval(() => {
    if (!pendingAgentTurn) return;
    const label = document.getElementById('agent-turn-elapsed');
    if (label) label.textContent = `${Math.round((Date.now() - pendingAgentTurn.startedAt) / 1000)}s`;
  }, 1000);
}

function clearPendingAgentTurn() {
  pendingAgentTurn = null;
  window.clearInterval(agentElapsedTimer);
  agentElapsedTimer = null;
}

/** The clipboard API needs a secure context and a permission this webview does
    not always grant -- the same class of silent no-op as the native dialogs. The
    textarea fallback works where it does not, and failure is reported rather
    than swallowed. */
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      // Observed: without a granted permission this call can hang instead of
      // rejecting, so an unbounded await would never reach the fallback.
      const written = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 400)),
      ]);
      if (written) return true;
    }
  } catch { /* Fall through to the selection-based copy. */ }
  const staging = document.createElement('textarea');
  staging.value = text;
  staging.setAttribute('readonly', '');
  staging.style.position = 'fixed';
  staging.style.opacity = '0';
  document.body.append(staging);
  staging.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  staging.remove();
  return copied;
}

async function copyAgentMessage(messageId, button) {
  const message = agentRenderedMessages.find((candidate) => candidate.id === messageId);
  if (!message) return;
  const label = button.querySelector('.agent-copy-label');
  const copied = await copyTextToClipboard(message.content);
  if (!copied) {
    notify('Unable to copy this message.');
    return;
  }
  button.dataset.copied = 'true';
  if (label) label.textContent = 'Copied';
  window.clearTimeout(button.dataset.resetTimer);
  button.dataset.resetTimer = String(window.setTimeout(() => {
    delete button.dataset.copied;
    if (label) label.textContent = 'Copy';
  }, 1600));
}

function toggleAgentSessionGroup(groupId) {
  const group = document.querySelector(`[data-agent-group="${CSS.escape(groupId)}"]`);
  if (!group || group.classList.contains('contains-active')) return;
  const expanded = group.querySelector('.agent-task-group-toggle')?.getAttribute('aria-expanded') === 'true';
  agentGroupExpansion.set(groupId, !expanded);
  renderAgentSessions(agentSessions);
}

function setAgentRailCollapsed(collapsed) {
  agentRailCollapsed = collapsed;
  const workbench = document.querySelector('.agents-workbench');
  const toggle = document.getElementById('agent-rail-toggle');
  const content = document.getElementById('agent-session-rail-content');
  workbench?.classList.toggle('agent-rail-collapsed', collapsed);
  toggle?.setAttribute('aria-expanded', String(!collapsed));
  toggle?.setAttribute('aria-label', collapsed ? 'Expand conversations' : 'Collapse conversations');
  if (toggle) toggle.title = collapsed ? 'Expand conversations' : 'Collapse conversations';
  content?.toggleAttribute('inert', collapsed);
}

function selectAgentSession(sessionId) {
  const session = agentSessions.find((candidate) => candidate.id === sessionId);
  if (!session) return;
  activeAgentSessionId = session.id;
  activeAgentTaskId = session.taskId ?? null;
  selectedProvider = session.provider;
  /** A stored model -- an empty string included -- is the conversation's own
      choice and outranks the agent default; only a session that never made one
      falls back to it. */
  selectedAgentModel = session.model ?? defaultModelForProvider(session.provider);
  const provider = document.getElementById('agent-provider');
  if (provider) provider.value = selectedProvider;
  renderModelSelection(selectedAgentModel);
  const providerLabel = document.getElementById('agent-session-provider');
  const title = document.getElementById('agent-session-title');
  const context = document.getElementById('agent-session-context');
  if (providerLabel) providerLabel.textContent = session.provider;
  if (title) title.textContent = agentSessionTitle(session);
  if (context) context.textContent = agentTaskName(activeAgentTaskId);
  renderAgentSessions(agentSessions);
  requestAgentMessages(session.id);
}

function resumeAgentConversation(sessionId, provider) {
  const knownSession = agentSessions.find((session) => session.id === sessionId);
  if (knownSession) {
    showView('agents');
    selectAgentSession(sessionId);
    return;
  }
  activeAgentSessionId = sessionId;
  selectedProvider = provider || selectedProvider;
  const providerSelect = document.getElementById('agent-provider');
  if (providerSelect) providerSelect.value = selectedProvider;
  const providerLabel = document.getElementById('agent-session-provider');
  const title = document.getElementById('agent-session-title');
  if (providerLabel) providerLabel.textContent = `${selectedProvider} · resumed`;
  if (title) title.textContent = `Session ${sessionId.slice(0, 18)}`;
  renderProviderSelection();
  renderModelSelection();
  showView('agents');
  requestAgentSessions(workspaceRootPath);
  requestAgentMessages(sessionId);
}

/** Starting the Project's applications belongs to the topbar for the same
    reason Project, Task and branch do: it is context the operator carries
    between views, not a feature of one of them. */
function requestRunConfigurations(path = workspaceRootPath) {
  if (!nativeInvoke || !path) return;
  void sendContextRequest('run.list', { repositoryPath: path }, 'run-list');
}

function selectedRunConfiguration() {
  return runConfigurations.find((configuration) => configuration.id === selectedRunConfigurationId) ?? runConfigurations[0];
}

/** A configuration is busy while its own session or the compound that owns it
    is still alive: stopping the stack from the member would be a half stop. */
function activeRunSession(configurationId) {
  return runSessions.find((session) => session.configurationId === configurationId && !session.parentId && (session.state === 'STARTING' || session.state === 'RUNNING' || session.state === 'STOPPING'));
}

function runConfigurationPorts(configuration) {
  const session = configuration ? activeRunSession(configuration.id) : null;
  return session?.ports?.length ? session.ports : configuration?.ports ?? [];
}

function runConfigurationUrl(configuration) {
  const port = runConfigurationPorts(configuration).find((candidate) => candidate.protocol === 'http');
  return port ? `http://localhost:${port.port}${port.path ?? ''}` : null;
}

function renderRunControl() {
  const control = document.getElementById('run-control');
  const value = document.getElementById('run-configuration-value');
  const startButton = document.getElementById('run-start');
  const debugButton = document.getElementById('run-debug');
  const stopButton = document.getElementById('run-stop');
  const status = document.getElementById('run-status');
  if (!control || !value || !startButton || !debugButton || !stopButton || !status) return;
  const configuration = selectedRunConfiguration();
  selectedRunConfigurationId = configuration?.id ?? null;
  const session = configuration ? activeRunSession(configuration.id) : null;
  const busy = Boolean(session);

  value.textContent = runCatalogError ? 'Invalid run.json' : configuration?.label ?? 'Add configuration';
  /** Never disabled: an empty catalog is exactly when the menu matters, because
      creating the first configuration and the proposals both live inside it. */
  document.getElementById('run-configuration-button')?.removeAttribute('disabled');
  startButton.disabled = !configuration || busy;
  debugButton.disabled = !configuration || busy || !configuration.debug;
  debugButton.title = configuration && !configuration.debug
    ? `${configuration.label} declares no debug mode`
    : 'Start in debug mode';
  startButton.hidden = busy;
  debugButton.hidden = busy;
  stopButton.hidden = !busy;

  const url = runConfigurationUrl(configuration);
  const failed = configuration ? runSessions.find((candidate) => candidate.configurationId === configuration.id && candidate.state === 'FAILED' && !candidate.parentId) : null;
  const shown = session ?? failed;
  status.hidden = !shown;
  if (shown) {
    status.dataset.state = shown.state;
    const port = runConfigurationPorts(configuration).find((candidate) => candidate.protocol === 'http');
    status.textContent = shown.state === 'RUNNING' && port ? `${shown.mode === 'debug' ? 'DEBUG' : 'RUNNING'} · :${port.port}` : shown.state;
    const openable = Boolean(url) && shown.state === 'RUNNING';
    status.dataset.openable = String(openable);
    status.title = openable ? `Open ${url}` : shown.failure ?? shown.state;
  }
  renderRunConfigurationMenu();
}

/** The selection mark is a drawn icon rather than a typed plus: the system's
    icons are SVG at one stroke weight, and a glyph in that column would sit at
    a different weight from every other icon in the shell. */
const pickerPlusMark = '<span class="git-option-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 6.5v11M6.5 12h11"/></svg></span>';

function runConfigurationDetail(configuration) {
  const ports = (configuration.ports ?? []).map((port) => `:${port.port}`).join(' ');
  return [configuration.kind === 'compound' ? `${configuration.members?.length ?? 0} members` : configuration.kind, ports].filter(Boolean).join(' · ');
}

function renderRunConfigurationMenu() {
  const menu = document.getElementById('run-configuration-menu');
  if (!menu) return;
  if (runCatalogError) {
    menu.innerHTML = `<p class="picker-empty">${escapeHTML(runCatalogError)}</p><p class="picker-hint">Fix .ade/run.json and reopen this menu.</p>`;
    return;
  }
  const rows = runConfigurations.map((configuration) => {
    const selected = configuration.id === selectedRunConfigurationId;
    return `<div class="picker-row${selected ? ' selected' : ''}" role="none"><button class="picker-option${selected ? ' selected' : ''}" type="button" role="menuitemradio" aria-checked="${selected}" data-run-configuration-id="${escapeHTML(configuration.id)}"><span class="git-option-mark" aria-hidden="true">${selected ? '✓' : ''}</span><span><strong>${escapeHTML(configuration.label)}</strong><small>${escapeHTML(runConfigurationDetail(configuration))}</small></span></button><button class="picker-edit" type="button" data-run-edit-id="${escapeHTML(configuration.id)}" aria-label="Edit ${escapeHTML(configuration.label)}" title="Edit ${escapeHTML(configuration.label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14.5 5.5 4 4"/></svg></button></div>`;
  }).join('');
  /** Detection proposes; it never writes. Each suggestion names the file it was
      read from, so the operator can check the offer instead of trusting it. */
  const suggestions = runSuggestions.filter((draft) => !runConfigurations.some((configuration) => configuration.id === draft.id));
  const suggested = suggestions.length
    ? `<p class="picker-note">Found in this Project — add the ones you want.</p>${suggestions.map((draft) => {
      /** A compound's evidence is several files; the row says how many parts it
          starts and leaves the file list to the tooltip, where it can be read
          whole instead of clipped. */
      const detail = draft.kind === 'compound' ? `${draft.members?.length ?? 0} members` : draft.source;
      return `<div class="picker-row" role="none"><button class="picker-option" type="button" data-run-suggestion-id="${escapeHTML(draft.id)}" title="${escapeHTML(draft.source)}">${pickerPlusMark}<span><strong>${escapeHTML(draft.label)}</strong><small>${escapeHTML(detail)}</small></span></button></div>`;
    }).join('')}`
    : '';
  const empty = runConfigurations.length ? '' : '<p class="picker-empty">This Project has no run configurations yet.</p>';
  /** The rows above are what the repository offers; this one is the operator's
      own action, so a rule separates them instead of a fifth identical row. */
  menu.innerHTML = `${empty}${rows}${suggested}<div class="picker-divider" role="separator"></div><div class="picker-row picker-row-action" role="none"><button class="picker-option" type="button" data-action="new-run-config">${pickerPlusMark}<span><strong>New configuration…</strong><small>writes .ade/run.json</small></span></button></div>`;
}

/** The dialog is the only place a configuration is authored: hand-editing JSON
    was never the promise, and a field that fails validation has to say so where
    it is typed rather than when something is started. */
function openRunConfigDialog(configuration = null) {
  const dialog = document.getElementById('run-config-dialog');
  if (!dialog?.showModal) { notify('This action needs a dialog that is unavailable.'); return; }
  editedRunConfigurationId = configuration?.id ?? null;
  closeRunPicker();
  const set = (id, value) => { const field = document.getElementById(id); if (field) field.value = value ?? ''; };
  document.getElementById('run-config-dialog-title').textContent = configuration ? 'Edit configuration' : 'New configuration';
  set('run-config-label', configuration?.label);
  set('run-config-kind', configuration?.kind ?? 'command');
  set('run-config-command', configuration?.command);
  set('run-config-args', (configuration?.args ?? []).join(' '));
  set('run-config-cwd', configuration?.cwd ?? '${projectRoot}');
  set('run-config-service', configuration?.service);
  set('run-config-ports', (configuration?.ports ?? []).map((port) => `${port.port} ${port.protocol}`).join(', '));
  set('run-config-bind', configuration?.ports?.[0]?.bind ?? 'loopback');
  set('run-config-debug-args', (configuration?.debug?.args ?? []).join(' '));
  set('run-config-debug-port', configuration?.debug?.port ?? '');
  const deleteButton = document.getElementById('run-config-delete');
  if (deleteButton) deleteButton.hidden = !configuration;
  renderRunConfigMembers(configuration);
  setRunConfigError('');
  syncRunConfigFields();
  dialog.showModal();
  requestAnimationFrame(() => document.getElementById('run-config-label')?.focus());
}

function renderRunConfigMembers(configuration) {
  const container = document.getElementById('run-config-members');
  if (!container) return;
  const candidates = runConfigurations.filter((candidate) => candidate.id !== configuration?.id);
  container.innerHTML = candidates.length
    ? candidates.map((candidate) => `<label><input type="checkbox" value="${escapeHTML(candidate.id)}"${configuration?.members?.includes(candidate.id) ? ' checked' : ''}> ${escapeHTML(candidate.label)}</label>`).join('')
    : '<p class="run-dialog-hint">Create the configurations this one should start first.</p>';
}

function syncRunConfigFields() {
  const kind = document.getElementById('run-config-kind')?.value ?? 'command';
  document.querySelectorAll('#run-config-form [data-run-field]').forEach((field) => {
    field.hidden = field.dataset.runField !== kind;
  });
}

function setRunConfigError(message) {
  const error = document.getElementById('run-config-error');
  if (!error) return;
  error.textContent = message;
  error.hidden = !message;
}

function runConfigIdFor(label) {
  const base = label.toLowerCase().replaceAll(/[^a-z0-9-]+/g, '-').replaceAll(/-+/g, '-').replace(/^-|-$/g, '') || 'configuration';
  if (!runConfigurations.some((configuration) => configuration.id === base)) return base;
  let suffix = 2;
  while (runConfigurations.some((configuration) => configuration.id === `${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** The same rules the sidecar enforces, checked here so the operator sees them
    while typing. The sidecar remains the authority: it validates again before
    the file is written. */
function readRunConfigForm() {
  const value = (id) => document.getElementById(id)?.value.trim() ?? '';
  const label = value('run-config-label');
  const kind = value('run-config-kind');
  if (!label) return { error: 'A configuration needs a name.' };

  const bind = value('run-config-bind') === 'all' ? 'all' : 'loopback';
  const ports = [];
  for (const entry of value('run-config-ports').split(',').map((part) => part.trim()).filter(Boolean)) {
    const [rawPort, rawProtocol = 'http'] = entry.split(/\s+/);
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) return { error: `Port out of range: ${rawPort}` };
    if (rawProtocol !== 'http' && rawProtocol !== 'tcp') return { error: `Unknown port protocol: ${rawProtocol}` };
    ports.push({ port, protocol: rawProtocol, bind });
  }

  const configuration = { id: editedRunConfigurationId ?? runConfigIdFor(label), label, kind };
  if (kind === 'compound') {
    configuration.members = [...document.querySelectorAll('#run-config-members input:checked')].map((input) => input.value);
    if (!configuration.members.length) return { error: 'A compound configuration needs at least one member.' };
    return { configuration };
  }
  if (kind === 'service') {
    configuration.service = value('run-config-service');
    if (!configuration.service) return { error: 'Name the declared service this configuration starts.' };
    if (ports.length) configuration.ports = ports;
    return { configuration };
  }
  configuration.command = value('run-config-command');
  configuration.cwd = value('run-config-cwd');
  if (!configuration.command) return { error: 'A command configuration needs a command.' };
  if (!configuration.cwd) return { error: 'A command configuration needs a working directory.' };
  const args = value('run-config-args').split(/\s+/).filter(Boolean);
  if (args.length) configuration.args = args;
  if (ports.length) configuration.ports = ports;
  const debugArgs = value('run-config-debug-args').split(/\s+/).filter(Boolean);
  const debugPort = Number(value('run-config-debug-port'));
  if (debugArgs.length || value('run-config-debug-port')) {
    if (!debugArgs.length) return { error: 'Debug mode needs the arguments that make the process debuggable.' };
    if (!Number.isInteger(debugPort) || debugPort < 1 || debugPort > 65_535) return { error: 'Debug mode needs a valid port.' };
    configuration.debug = { args: debugArgs, port: debugPort, protocol: 'other' };
  }
  return { configuration };
}

function saveRunConfigurations(configurations, { message } = {}) {
  if (!nativeInvoke) { notify('Run configurations require the sidecar.'); return; }
  pendingRunSaveMessage = message ?? null;
  void sendContextRequest('run.save', { repositoryPath: workspaceRootPath, configurations }, 'run-save');
}

function submitRunConfigDialog(event) {
  event.preventDefault();
  const { configuration, error } = readRunConfigForm();
  if (error) { setRunConfigError(error); return; }
  const next = editedRunConfigurationId
    ? runConfigurations.map((candidate) => (candidate.id === editedRunConfigurationId ? configuration : stripResolved(candidate)))
    : [...runConfigurations.map(stripResolved), configuration];
  selectedRunConfigurationId = configuration.id;
  saveRunConfigurations(next, { message: `${configuration.label} saved to .ade/run.json.` });
}

function deleteEditedRunConfiguration() {
  const configuration = runConfigurations.find((candidate) => candidate.id === editedRunConfigurationId);
  if (!configuration) return;
  requestConfirmation({
    eyebrow: 'DELETE CONFIGURATION',
    title: `Delete ${configuration.label}?`,
    copy: 'It is removed from .ade/run.json. Nothing else in the Project changes.',
    confirmLabel: 'Delete',
    tone: 'secondary',
  }, () => saveRunConfigurations(runConfigurations.filter((candidate) => candidate.id !== configuration.id).map(stripResolved), { message: `${configuration.label} removed.` }));
}

function addRunSuggestion(suggestionId) {
  const draft = runSuggestions.find((candidate) => candidate.id === suggestionId);
  if (!draft) return;
  const { source, ...configuration } = draft;
  selectedRunConfigurationId = configuration.id;
  saveRunConfigurations([...runConfigurations.map(stripResolved), configuration], { message: `${configuration.label} added from ${source}.` });
}

/** A configuration read back from the sidecar carries the fields a service
    reference expanded into; writing those back would turn a reference into the
    copy the catalog refuses. */
function stripResolved(configuration) {
  if (configuration.kind !== 'service') return configuration;
  const { command, args, cwd, ...rest } = configuration;
  return rest;
}

/** The webview never answers the browser-native confirm and prompt calls, so
    every guarded action routes through this in-app dialog instead. */

function toggleRunPicker() {
  const menu = document.getElementById('run-configuration-menu');
  const button = document.getElementById('run-configuration-button');
  if (!menu || !button || button.disabled) return;
  const wasOpen = !menu.hidden;
  closeRunPicker();
  if (wasOpen) return;
  renderRunConfigurationMenu();
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  (menu.querySelector('.picker-option.selected') ?? menu.querySelector('.picker-option'))?.focus();
}

function closeRunPicker() {
  const menu = document.getElementById('run-configuration-menu');
  if (menu) menu.hidden = true;
  document.getElementById('run-configuration-button')?.setAttribute('aria-expanded', 'false');
}

function chooseRunConfiguration(configurationId) {
  selectedRunConfigurationId = configurationId;
  try { localStorage.setItem(`ade-run-configuration:${activeProjectId}`, configurationId); } catch { /* Persistence is optional. */ }
  closeRunPicker();
  document.getElementById('run-configuration-button')?.focus();
  renderRunControl();
}

function startRun(mode) {
  const configuration = selectedRunConfiguration();
  if (!nativeInvoke || !configuration) { notify('Run configurations require the sidecar.'); return; }
  if (mode === 'debug' && !configuration.debug) { notify(`${configuration.label} declares no debug mode.`); return; }
  /** A port bound outside loopback is reachable from the local network, so it
      is confirmed per run rather than once in the file. */
  const exposed = (configuration.ports ?? []).filter((port) => port.bind === 'all');
  const send = () => {
    void nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `run-start-${Date.now()}`, method: 'run.start', params: { repositoryPath: workspaceRootPath, configurationId: configuration.id, mode } }) })
      .catch((error) => { notify('Run failed to start.'); console.warn(error); });
  };
  if (!exposed.length) { send(); return; }
  requestConfirmation({
    eyebrow: 'EXPOSED PORT',
    title: `Start ${configuration.label} on the local network?`,
    copy: `${exposed.map((port) => `Port ${port.port}`).join(', ')} will accept connections from other machines on this network, not only from this one.`,
    confirmLabel: 'Start anyway',
    tone: 'secondary',
  }, send);
}

function stopRun() {
  const configuration = selectedRunConfiguration();
  const session = configuration ? activeRunSession(configuration.id) : null;
  if (!nativeInvoke || !session) return;
  void nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `run-stop-${Date.now()}`, method: 'run.stop', params: { repositoryPath: workspaceRootPath, runSessionId: session.id } }) })
    .catch((error) => { notify('Stopping the run failed.'); console.warn(error); });
}

/** Each run writes to its own console tab in the dock the shell already has:
    process output has a place, and a second panel would only split reading. */
function runConsoleTab(sessionId, { create = true } = {}) {
  const id = `run:${sessionId}`;
  const existing = terminalTabs.find((tab) => tab.id === id);
  if (existing || !create) return existing;
  const session = runSessions.find((candidate) => candidate.id === sessionId);
  const label = `${runLabelFor(session?.configurationId ?? sessionId)}${session?.mode === 'debug' ? ' · debug' : ''}`;
  const tab = createTerminalTab({ focus: false, kind: 'run', id, label });
  tab.started = true;
  renderTerminalTabs();
  return tab;
}

function appendRunOutput(sessionId, text) {
  const tab = runConsoleTab(sessionId);
  tab?.terminal?.write(text.replaceAll('\n', '\r\n'));
}

function applyRunSession(session) {
  runSessions = [...runSessions.filter((candidate) => candidate.id !== session.id), session];
  if (session.state === 'FAILED' && session.failure) notify(`${runLabelFor(session.configurationId)}: ${session.failure}`);
  renderRunControl();
}

function runLabelFor(configurationId) {
  return runConfigurations.find((configuration) => configuration.id === configurationId)?.label ?? configurationId;
}

function openRunUrl() {
  const url = runConfigurationUrl(selectedRunConfiguration());
  if (!url || !nativeInvoke) return;
  void nativeInvoke('open_run_url', { url }).catch((error) => { notify('Could not open the running application.'); console.warn(error); });
}

function resetRunControlForProject() {
  runConfigurations = [];
  runSessions = [];
  runSuggestions = [];
  runCatalogError = null;
  try { selectedRunConfigurationId = localStorage.getItem(`ade-run-configuration:${activeProjectId}`); } catch { selectedRunConfigurationId = null; }
  closeRunPicker();
  renderRunControl();
  requestRunConfigurations(workspaceRootPath);
}

/** The webview never answers the browser-native confirm and prompt calls, so
    every guarded action routes through this in-app dialog instead. */
function requestConfirmation({ eyebrow = 'CONFIRM', title, copy, confirmLabel = 'Confirm', tone = 'primary' }, onConfirm) {
  const dialog = document.getElementById('confirm-dialog');
  const accept = document.getElementById('confirm-dialog-accept');
  if (!dialog?.showModal || !accept) { notify('This action needs a confirmation dialog that is unavailable.'); return; }
  pendingConfirmation = onConfirm;
  const eyebrowLabel = document.getElementById('confirm-dialog-eyebrow');
  const titleLabel = document.getElementById('confirm-dialog-title');
  const copyLabel = document.getElementById('confirm-dialog-copy');
  if (eyebrowLabel) eyebrowLabel.textContent = eyebrow;
  if (titleLabel) titleLabel.textContent = title;
  if (copyLabel) copyLabel.textContent = copy;
  accept.className = `button ${tone}`;
  accept.textContent = confirmLabel;
  dialog.showModal();
  requestAnimationFrame(() => accept.focus());
}

function closeConfirmation() {
  pendingConfirmation = null;
  document.getElementById('confirm-dialog')?.close();
}

function acceptConfirmation() {
  const confirmed = pendingConfirmation;
  pendingConfirmation = null;
  document.getElementById('confirm-dialog')?.close();
  if (confirmed) void confirmed();
}

function openWorktreeDialog() {
  const repositoryPath = document.getElementById('project-path')?.textContent ?? '';
  const taskSuffix = selectedTaskId ? selectedTaskId.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'ade-next';
  const branch = document.getElementById('worktree-branch');
  const path = document.getElementById('worktree-path');
  if (branch) branch.value = `feature/${taskSuffix}`;
  if (path) path.value = `${repositoryPath}-worktree-${taskSuffix}`;
  const dialog = document.getElementById('worktree-dialog');
  if (dialog?.showModal) dialog.showModal();
  requestAnimationFrame(() => branch?.focus());
}

function openDeleteAgentSessionDialog(sessionId) {
  const session = agentSessions.find((candidate) => candidate.id === sessionId);
  if (!session || !nativeInvoke) return;
  if (sessionId === activeAgentSessionId && agentPromptRunning) {
    notify('Stop the active turn before deleting this conversation.');
    return;
  }
  pendingAgentSessionDeletion = sessionId;
  const detail = document.getElementById('agent-delete-dialog-copy');
  if (detail) detail.textContent = `This will permanently remove the ${session.provider} conversation and its saved messages.`;
  const dialog = document.getElementById('agent-delete-dialog');
  if (dialog?.showModal) dialog.showModal();
}

function closeDeleteAgentSessionDialog() {
  pendingAgentSessionDeletion = null;
  document.getElementById('agent-delete-dialog')?.close();
}

function confirmDeleteAgentSession() {
  const sessionId = pendingAgentSessionDeletion;
  if (!sessionId || !nativeInvoke) return;
  pendingAgentSessionDeletion = null;
  document.getElementById('agent-delete-dialog')?.close();
  const id = `agent-session-delete-${Date.now()}`;
  pendingContextRequests.set(id, 'agent-session-delete');
  pendingAgentSessionDeletes.set(id, sessionId);
  nativeInvoke('sidecar_request', { request: JSON.stringify({ id, method: 'agent.session.delete', params: { sessionId, projectId: activeProjectId } }) }).catch((error) => {
    pendingContextRequests.delete(id);
    pendingAgentSessionDeletes.delete(id);
    notify('Conversation could not be deleted.');
    console.warn(error);
  });
}

function startNewAgentSession() {
  activeAgentSessionId = null;
  activeAgentTaskId = selectedTaskId ?? null;
  selectedAgentModel = defaultModelForProvider(selectedProvider);
  renderAgentMessages([]);
  const providerLabel = document.getElementById('agent-session-provider');
  const title = document.getElementById('agent-session-title');
  const context = document.getElementById('agent-session-context');
  if (providerLabel) providerLabel.textContent = 'New conversation';
  if (title) title.textContent = 'Start a conversation';
  if (context) context.textContent = agentTaskName(activeAgentTaskId);
  renderModelSelection();
  renderAgentSessions(agentSessions);
  document.getElementById('agent-prompt-input')?.focus();
}

function agentPromptHistory() {
  const history = agentPromptHistoryByProject.get(activeProjectId) ?? [];
  agentPromptHistoryByProject.set(activeProjectId, history);
  return history;
}

function rememberAgentPrompt(prompt) {
  const history = agentPromptHistory();
  const existing = history.lastIndexOf(prompt);
  if (existing >= 0) history.splice(existing, 1);
  history.push(prompt);
  if (history.length > 50) history.splice(0, history.length - 50);
  agentPromptHistoryIndex = -1;
  agentPromptHistoryDraft = '';
}

function recallAgentPrompt(input, direction) {
  const history = agentPromptHistory();
  if (history.length === 0) return false;
  if (direction < 0) {
    if (agentPromptHistoryIndex < 0) {
      agentPromptHistoryDraft = input.value;
      agentPromptHistoryIndex = history.length - 1;
    } else {
      agentPromptHistoryIndex = Math.max(0, agentPromptHistoryIndex - 1);
    }
    input.value = history[agentPromptHistoryIndex];
  } else {
    if (agentPromptHistoryIndex < 0) return false;
    if (agentPromptHistoryIndex >= history.length - 1) {
      agentPromptHistoryIndex = -1;
      input.value = agentPromptHistoryDraft;
    } else {
      agentPromptHistoryIndex += 1;
      input.value = history[agentPromptHistoryIndex];
    }
  }
  input.setSelectionRange(input.value.length, input.value.length);
  return true;
}

function handleAgentComposerKeydown(event) {
  const input = event.currentTarget;
  if (!(input instanceof HTMLTextAreaElement) || event.isComposing) return;
  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    document.getElementById('agent-prompt-form')?.requestSubmit();
    return;
  }
  const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
  const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
  if (event.key === 'ArrowUp' && atStart && recallAgentPrompt(input, -1)) event.preventDefault();
  if (event.key === 'ArrowDown' && atEnd && recallAgentPrompt(input, 1)) event.preventDefault();
}

function stopAgentPrompt() {
  if (!nativeInvoke || !agentPromptRunning || !activeAgentRequestId || agentStopRequested) return;
  agentStopRequested = true;
  const provider = document.getElementById('agent-provider')?.value ?? selectedProvider;
  const feedback = document.getElementById('agent-feedback');
  const turnState = document.getElementById('agent-turn-state');
  if (feedback) feedback.textContent = `Stopping ${provider}…`;
  if (turnState) { turnState.textContent = 'STOPPING'; turnState.dataset.state = 'stopping'; }
  nativeInvoke('sidecar_request', {
    request: JSON.stringify({ id: `agent-abort-${Date.now()}`, method: 'agent.abort', params: { requestId: activeAgentRequestId, projectId: activeProjectId } }),
  }).catch((error) => {
    agentStopRequested = false;
    if (feedback) feedback.textContent = `Could not stop agent: ${error}`;
    if (turnState) { turnState.textContent = 'WORKING'; turnState.dataset.state = 'working'; }
  });
}

function sendAgentPrompt(event) {
  event.preventDefault();
  if (!nativeInvoke || agentPromptRunning) return;
  const input = document.getElementById('agent-prompt-input');
  const prompt = input?.value.trim();
  const provider = document.getElementById('agent-provider')?.value ?? selectedProvider;
  const model = document.getElementById('agent-model')?.value ?? '';
  const taskId = activeAgentSessionId ? (agentSessions.find((session) => session.id === activeAgentSessionId)?.taskId ?? null) : (selectedTaskId ?? null);
  if (!prompt) return;
  if (!providerIsAvailable(provider)) { notify('Selected agent provider is unavailable.'); return; }
  const permissions = [...document.querySelectorAll('#agent-prompt-form input[type="checkbox"]:checked')].map((item) => item.value);
  selectedProvider = provider;
  selectedAgentModel = model;
  activeAgentTaskId = taskId;
  rememberAgentPrompt(prompt);
  agentPromptRunning = true;
  agentStopRequested = false;
  const button = document.getElementById('agent-send-button');
  const feedback = document.getElementById('agent-feedback');
  if (button) button.disabled = true;
  const turnState = document.getElementById('agent-turn-state');
  if (turnState) { turnState.textContent = 'WORKING'; turnState.dataset.state = 'working'; }
  if (feedback) feedback.textContent = `Sending prompt to ${provider}…`;
  // The prompt belongs in the conversation the moment it is sent. Waiting for
  // the turn to finish leaves the user staring at an unchanged transcript with
  // no evidence their message went anywhere.
  pendingAgentTurn = { prompt, provider, startedAt: Date.now(), activity: [], sessionId: null };
  renderAgentMessages(agentRenderedMessages);
  startAgentElapsedTimer();
  const requestId = `agent-prompt-${Date.now()}`;
  activeAgentRequestId = requestId;
  pendingAgentPromptProjects.set(requestId, activeProjectId);
  nativeInvoke('sidecar_request', { request: JSON.stringify({ id: requestId, method: 'agent.prompt', params: { projectId: activeProjectId, provider, repositoryPath: workspaceRootPath, prompt, model, ...(activeAgentSessionId ? { sessionId: activeAgentSessionId } : {}), ...(taskId ? { taskId } : {}), grantedPermissions: permissions } }) }).catch((error) => {
    pendingAgentPromptProjects.delete(requestId);
    agentPromptRunning = false;
    activeAgentRequestId = null;
    agentStopRequested = false;
    clearPendingAgentTurn();
    renderAgentMessages(agentRenderedMessages);
    if (button) button.disabled = false;
    if (turnState) { turnState.textContent = 'ERROR'; turnState.dataset.state = 'error'; }
    if (feedback) feedback.textContent = `Agent failed: ${error}`;
  });
  if (input) input.value = '';
}

function taskStatusTone(status) {
  return ['UNDER_REVIEW', 'READY_FOR_HUMAN', 'BLOCKED'].includes(status) ? 'review' : 'building';
}

function renderProjectTasks(tasks) {
  const list = document.getElementById('project-task-list');
  if (!list) return;
  if (tasks.length === 0) {
    list.innerHTML = '<p class="task-empty-state">No tasks yet. Create one when you are ready to delegate work.</p>';
    return;
  }
  const current = selectedTaskId ?? tasks[0]?.id;
  list.innerHTML = tasks.map((task) => {
    const status = escapeHTML(task.status.replaceAll('_', ' '));
    const transitions = { DRAFT: ['READY', 'Mark ready'], READY: ['RUN', 'Start task'], CHANGES_REQUESTED: ['RUN', 'Resume task'], BLOCKED: ['RUN', 'Re-enter task'] };
    const action = transitions[task.status];
    const actionMarkup = action ? action[0] === 'RUN'
      ? `<button class="task-action" data-task-id="${escapeHTML(task.id)}" data-task-run="true">${action[1]}</button>`
      : `<button class="task-action" data-task-id="${escapeHTML(task.id)}" data-task-next="${action[0]}">${action[1]}</button>` : '';
    const isCurrent = task.id === current;
    const updated = task.updatedAt ? new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    return `<article class="task-row${isCurrent ? ' current-task' : ''}">
      <button class="task-row-select" type="button" data-task-select="${escapeHTML(task.id)}" aria-current="${isCurrent ? 'true' : 'false'}" aria-expanded="${isCurrent ? 'true' : 'false'}" aria-controls="task-detail-${escapeHTML(task.id)}">
        <span class="task-id">${escapeHTML(task.id)}</span>
        <span class="task-row-intent">${escapeHTML(task.intent)}</span>
        <span class="task-row-time">${escapeHTML(updated)}</span>
        <span class="task-status ${taskStatusTone(task.status)}">${status}</span>
        <svg class="task-row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
      </button>
      <div class="task-row-detail" id="task-detail-${escapeHTML(task.id)}"${isCurrent ? '' : ' hidden'}>
        ${isCurrent ? (taskDetailMarkup.get(task.id) ?? '<p class="task-trace-empty">Loading task evidence…</p>') : ''}
      </div>
      ${actionMarkup}
    </article>`;
  }).join('');
}

function renderTaskDetail(detail) {
  const task = detail.task;
  const panel = document.getElementById(`task-detail-${task.id}`);
  if (!panel) return;
  selectedTaskId = task.id;
  selectedTaskIntent = task.intent;
  void syncDocumentScope();
  const gates = detail.gates.map((gate) => `${gate.id}: ${gate.status}`).join(' · ') || 'No gates';
  const changeset = detail.changeSets[0] ? `${detail.changeSets[0].id} (${detail.changeSets[0].gitStatus || 'clean'})` : 'No ChangeSet';
  const operations = detail.gitOperations.length
    ? `<ul class="task-trace-list">${detail.gitOperations.map((operation) => `<li><strong>${escapeHTML(operation.operation)}</strong> · ${escapeHTML(operation.reference ?? 'no reference')}<small>${escapeHTML(operation.actor)} · ${escapeHTML(operation.reason)}</small></li>`).join('')}</ul>`
    : '<p class="task-trace-empty">No Git operations linked to this Task.</p>';
  const sessions = detail.agentSessions.length
    ? `<ul class="task-trace-list">${detail.agentSessions.map((session) => `<li><strong>${escapeHTML(session.provider)}</strong> · ${escapeHTML(session.status)}<small>${escapeHTML(session.id)}</small><button class="text-button" data-resume-session="${escapeHTML(session.id)}" data-session-provider="${escapeHTML(session.provider)}">Resume</button></li>`).join('')}</ul>`
    : '<p class="task-trace-empty">No agent sessions linked to this Task.</p>';
  const evidence = detail.runtimeEvidence.length
    ? `<ul class="task-trace-list">${detail.runtimeEvidence.slice(0, 12).map((item) => `<li><strong>${escapeHTML(item.type)}</strong> · ${escapeHTML(item.summary)}<small>${escapeHTML(new Date(item.at).toLocaleString())}${item.sessionId ? ` · ${escapeHTML(item.sessionId)}` : ''}</small></li>`).join('')}</ul>`
    : '<p class="task-trace-empty">No persisted runtime activity for this Task.</p>';
  const markup = `<p class="task-detail-summary">${task.history.length} history events · ${detail.changeSets.length} ChangeSets · ${detail.reviews.length} Reviews · ${detail.runtimeEvidence.length} runtime events</p><p><strong>ChangeSet:</strong> ${escapeHTML(changeset)}</p><p><strong>Gates:</strong> ${escapeHTML(gates)}</p><h3 class="task-trace-heading">Git trace</h3>${operations}<h3 class="task-trace-heading">Agent sessions</h3>${sessions}<h3 class="task-trace-heading">Persisted activity</h3>${evidence}`;
  taskDetailMarkup.set(task.id, markup);
  panel.innerHTML = markup;
}

async function refreshProjectContext(snapshot) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return;
  try {
    const context = await invoke('project_context', { repositoryPath: activeProject.repositoryPath });
    activeGitBranch = context.branch;
    activeProject = mergeActiveProject(activeProject, context);
    renderSnapshot({ ...snapshot, project: activeProject });
    window.clearTimeout(workspaceSearchTimer);
    workspaceSearchToken += 1;
    setWorkspaceSearchLoading(false);
    workspaceSearchEntries = null;
    workspaceSearchIndex = null;
    await loadWorkspaceTree(context.repositoryPath, invoke);
    await syncDocumentScope();
    await refreshGitWorkspace(context.repositoryPath, invoke);
    notify('Project context loaded from the local repository.');
  } catch (error) {
    console.warn('Project context unavailable:', error);
  }
}

async function refreshGitWorkspace(path, invoke = nativeInvoke) {
  if (!invoke || !path) {
    return;
  }
  if (activeVersionControl === 'none') {
    const output = document.getElementById('git-workspace-output');
    if (activeVersionControl === 'none' && output) output.textContent = 'This Project is not a Git repository.';
    requestVersionControlData(path);
    return;
  }
  try {
    const result = await invoke('sidecar_request', { request: JSON.stringify({ id: `git-workspace-${Date.now()}`, method: 'git.workspace', params: { repositoryPath: path } }) });
    await invoke('sidecar_request', { request: JSON.stringify({ id: `git-workflow-${Date.now()}`, method: 'git.workflow', params: { repositoryPath: path } }) });
    requestVersionControlData(path);
    return result;
  } catch (error) { console.warn('Git workspace unavailable:', error); }
}

async function loadWorkspaceTree(path, invoke = window.__TAURI__?.core?.invoke, { animate = false, requestToken = null } = {}) {
  const tree = document.getElementById('workspace-tree');
  if (!tree || !invoke || !path) return;
  workspaceRootPath = path;
  if (animate) tree.classList.add('is-transitioning');
  try {
    const entries = await invoke('list_directory', { path, maxDepth: 0 });
    if (requestToken !== null && requestToken !== workspaceSearchToken) return;
    tree.innerHTML = explorerExpanded || !selectedFilePath
      ? renderWorkspaceEntries(entries)
      : await renderCompactWorkspacePath(entries, selectedFilePath, invoke);
    filterWorkspaceTree(document.getElementById('workspace-filter')?.value ?? '');
    if (animate) requestAnimationFrame(() => tree.classList.remove('is-transitioning'));
  } catch (error) {
    tree.innerHTML = '<li>Workspace directory unavailable.</li>';
    if (animate) requestAnimationFrame(() => tree.classList.remove('is-transitioning'));
    console.warn('Workspace tree unavailable:', error);
  }
}

function renderWorkspaceEntry(entry, childMarkup = '', { showPathHint = false } = {}) {
  const name = escapeHTML(entry.name);
  const path = escapeHTML(entry.path);
  if (entry.kind === 'directory') {
    const expanded = Boolean(childMarkup);
    return `<li class="workspace-node directory" data-entry-name="${name.toLowerCase()}"><button class="workspace-entry directory${expanded ? ' compact-branch' : ''}" type="button" data-directory-path="${path}" aria-expanded="${expanded}" aria-label="${expanded ? 'Expand' : 'Open'} ${name}"><span class="workspace-arrow" aria-hidden="true"></span><span class="workspace-glyph directory" aria-hidden="true"></span><span class="workspace-name">${name}</span></button><ul class="workspace-children" data-directory-children${expanded ? '' : ' hidden'}>${childMarkup}</ul></li>`;
  }
  if (entry.kind === 'symlink') {
    return `<li class="workspace-entry symlink" data-entry-name="${name.toLowerCase()}" title="Symlinks are not opened outside the selected Project"><span class="workspace-glyph symlink" aria-hidden="true"></span><span class="workspace-name">${name}</span></li>`;
  }
  const selected = entry.path === selectedFilePath;
  const relativePath = documentRelativePath(entry.path);
  const segments = pathSegments(relativePath);
  const parentPath = segments.slice(0, -1).join(' / ') || 'Project root';
  const pathHint = showPathHint ? `<span class="workspace-path-hint" title="${escapeHTML(relativePath)}">${escapeHTML(parentPath)}</span>` : '';
  const resultClass = showPathHint ? ' search-result' : '';
  const fileLabel = showPathHint ? `<span class="workspace-result-copy"><span class="workspace-name">${name}</span>${pathHint}</span>` : `<span class="workspace-name">${name}</span>`;
  return `<li class="workspace-node file" data-entry-name="${name.toLowerCase()}"><button class="workspace-entry file${selected ? ' selected' : ''}${resultClass}" type="button" data-file-path="${path}" aria-current="${selected ? 'page' : 'false'}" aria-label="Open ${name} in ${escapeHTML(parentPath)}"><span class="workspace-glyph file" aria-hidden="true"></span>${fileLabel}</button></li>`;
}

function renderWorkspaceEntries(entries) {
  if (!entries.length) return '<li class="workspace-empty">Directory is empty.</li>';
  return entries.map((entry) => renderWorkspaceEntry(entry)).join('');
}

async function searchWorkspaceFiles(query) {
  const tree = document.getElementById('workspace-tree');
  const invoke = nativeInvoke ?? window.__TAURI__?.core?.invoke;
  const needle = query.trim().toLowerCase();
  if (!tree || !needle) {
    setWorkspaceSearchLoading(false);
    workspaceSearchToken += 1;
    await loadWorkspaceTree(workspaceRootPath, invoke, { animate: true });
    return;
  }
  const token = workspaceSearchToken;
  tree.classList.add('is-searching');
  setWorkspaceSearchLoading(true);
  tree.innerHTML = '<li class="workspace-empty">Searching files…</li>';
  try {
    if (!workspaceSearchIndex) {
      workspaceSearchEntries = await invoke('list_directory', { path: workspaceRootPath, maxDepth: 99 });
      workspaceSearchIndex = workspaceSearchEntries
        .filter((entry) => entry.kind === 'file')
        .map((entry) => ({ ...entry, searchText: `${entry.name} ${entry.path}`.toLowerCase() }));
    }
    if (token !== workspaceSearchToken) return;
    const matches = workspaceSearchIndex.filter((entry) => entry.searchText.includes(needle));
    tree.innerHTML = matches.length ? matches.map((entry) => renderWorkspaceEntry(entry, '', { showPathHint: true })).join('') : '<li class="workspace-empty">No matching files.</li>';
    tree.classList.add('is-searching');
    setWorkspaceSearchLoading(false);
  } catch (error) {
    if (token !== workspaceSearchToken) return;
    tree.innerHTML = '<li class="workspace-empty">File search unavailable.</li>';
    setWorkspaceSearchLoading(false);
    notify('Workspace file search unavailable.');
    console.warn('Workspace file search unavailable:', error);
  }
}

function setWorkspaceSearchLoading(loading) {
  const input = document.getElementById('workspace-filter');
  const status = document.getElementById('workspace-search-status');
  if (status) status.hidden = !loading;
  input?.setAttribute('aria-busy', String(loading));
}

function scheduleWorkspaceFileSearch(query) {
  window.clearTimeout(workspaceSearchTimer);
  const token = ++workspaceSearchToken;
  const needle = query.trim();
  if (!needle) {
    setWorkspaceSearchLoading(false);
    void loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true, requestToken: token });
    return;
  }
  const tree = document.getElementById('workspace-tree');
  tree?.classList.add('is-searching');
  if (tree) tree.innerHTML = '<li class="workspace-empty">Searching files…</li>';
  setWorkspaceSearchLoading(true);
  workspaceSearchTimer = window.setTimeout(() => {
    if (token !== workspaceSearchToken) return;
    void searchWorkspaceFiles(query);
  }, 100);
}

async function renderCompactWorkspacePath(rootEntries, filePath, invoke) {
  if (!pathInsideRoot(filePath)) return renderWorkspaceEntries(rootEntries);
  const segments = pathSegments(documentRelativePath(filePath));
  if (!segments.length) return renderWorkspaceEntries(rootEntries);
  const chain = [];
  let entries = rootEntries;
  for (const segment of segments) {
    const entry = entries.find((candidate) => candidate.name === segment);
    if (!entry) return renderWorkspaceEntries(rootEntries);
    chain.push(entry);
    if (entry.kind === 'directory') entries = await invoke('list_directory', { path: entry.path, maxDepth: 0 });
  }
  let branchMarkup = '';
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    branchMarkup = renderWorkspaceEntry(chain[index], branchMarkup);
  }
  return branchMarkup;
}

function filterWorkspaceTree(query) {
  const needle = query.trim().toLowerCase();
  const tree = document.getElementById('workspace-tree');
  tree?.classList.toggle('is-searching', Boolean(needle));
  document.querySelectorAll('#workspace-tree .workspace-node').forEach((node) => {
    const filePath = node.dataset.filePath ?? node.querySelector('[data-file-path]')?.dataset.filePath ?? '';
    const isFile = node.classList.contains('file');
    const matches = !needle || (isFile && `${node.dataset.entryName ?? ''} ${filePath}`.toLowerCase().includes(needle));
    node.hidden = Boolean(needle) && !matches;
  });
}

async function toggleWorkspaceDirectory(button) {
  const children = button.parentElement?.querySelector(':scope > [data-directory-children]');
  if (!children || !nativeInvoke) return;
  const expanded = button.getAttribute('aria-expanded') === 'true';
  if (expanded) {
    button.setAttribute('aria-expanded', 'false');
    children.hidden = true;
    return;
  }
  if (button.dataset.loaded !== 'true') {
    button.disabled = true;
    try {
      const entries = await nativeInvoke('list_directory', { path: button.dataset.directoryPath, maxDepth: 0 });
      children.innerHTML = renderWorkspaceEntries(entries);
      button.dataset.loaded = 'true';
    } catch (error) {
      children.innerHTML = '<li class="workspace-empty">Directory unavailable.</li>';
      notify('Workspace directory unavailable.');
      console.warn('Workspace directory unavailable:', error);
    } finally {
      button.disabled = false;
    }
  }
  button.setAttribute('aria-expanded', 'true');
  children.hidden = false;
}

function updateExplorerMode(expanded) {
  explorerExpanded = expanded;
  trackSidebarControlAnchor();
  const sidebar = document.querySelector('.sidebar');
  const primaryNav = document.querySelector('.primary-nav');
  const toggle = document.querySelector('[data-action="toggle-explorer"]');
  sidebar?.classList.toggle('explorer-expanded', expanded);
  primaryNav?.setAttribute('aria-hidden', 'false');
  toggle?.setAttribute('aria-expanded', String(expanded));
  toggle?.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} workspace tree`);
  toggle?.setAttribute('title', `${expanded ? 'Collapse' : 'Expand'} workspace tree`);
  toggle?.querySelector('svg')?.style.setProperty('transform', expanded ? 'rotate(90deg)' : 'none');
}

async function expandExplorerFrom(button) {
  updateExplorerMode(true);
  await loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true });
  const targetPath = button.dataset.directoryPath;
  if (!pathInsideRoot(targetPath)) return;
  const segments = pathSegments(documentRelativePath(targetPath));
  let currentPath = workspaceRootPath;
  for (const segment of segments) {
    currentPath = `${currentPath}/${segment}`;
    const matchingButton = [...document.querySelectorAll('[data-directory-path].directory')]
      .find((candidate) => candidate.dataset.directoryPath === currentPath);
    if (!matchingButton) break;
    if (matchingButton.getAttribute('aria-expanded') !== 'true') await toggleWorkspaceDirectory(matchingButton);
  }
}

async function revealSelectedFileBranch(filePath = selectedFilePath) {
  if (!explorerExpanded || !pathInsideRoot(filePath)) return;
  const segments = pathSegments(documentRelativePath(filePath));
  let currentPath = workspaceRootPath;
  for (const segment of segments.slice(0, -1)) {
    currentPath = `${currentPath}/${segment}`;
    const directoryButton = [...document.querySelectorAll('[data-directory-path].directory')]
      .find((candidate) => candidate.dataset.directoryPath === currentPath);
    if (!directoryButton) return;
    if (directoryButton.getAttribute('aria-expanded') !== 'true') await toggleWorkspaceDirectory(directoryButton);
  }
  updateWorkspaceFileSelection(filePath);
}

/** Walk the tree down to the file the editor is showing, opening every
    directory on the way, and bring it into view. The explorer has to be opened
    and unfiltered first: collapsed it renders only the current file's own
    branch, and filtered it lists matches instead of the hierarchy, so in
    neither case is there a branch to walk down. */
async function revealOpenFileInExplorer() {
  const filePath = activeDocument?.path;
  if (!filePath) { notify('No file is open.'); return; }
  if (!pathInsideRoot(filePath)) { notify('The open file is outside this Project.'); return; }
  const filter = document.getElementById('workspace-filter');
  const filtered = Boolean(filter?.value.trim());
  if (filtered) {
    filter.value = '';
    window.clearTimeout(workspaceSearchTimer);
    workspaceSearchToken += 1;
    setWorkspaceSearchLoading(false);
    workspaceSearchEntries = null;
    workspaceSearchIndex = null;
  }
  if (!explorerExpanded || filtered) {
    updateExplorerMode(true);
    await loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true });
  }
  await revealSelectedFileBranch(filePath);
  const entry = [...document.querySelectorAll('[data-file-path]')].find((candidate) => candidate.dataset.filePath === filePath);
  if (!entry) { notify('The open file is no longer in the workspace tree.'); return; }
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  entry.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  // Restarting the highlight is what makes a second press read as an answer
  // rather than as nothing happening when the file is already in view.
  entry.classList.remove('just-revealed');
  void entry.offsetWidth;
  entry.classList.add('just-revealed');
}

function updateRevealOpenFileButton() {
  const button = document.querySelector('[data-action="reveal-open-file"]');
  if (!button) return;
  const available = Boolean(activeDocument?.path) && pathInsideRoot(activeDocument.path);
  const label = available ? 'Select the open file in the tree' : 'No file is open';
  button.disabled = !available;
  button.title = label;
  button.setAttribute('aria-label', label);
}

async function expandExplorer() {
  updateExplorerMode(true);
  await loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true });
  await revealSelectedFileBranch();
}

async function collapseExplorer() {
  window.clearTimeout(workspaceSearchTimer);
  workspaceSearchToken += 1;
  setWorkspaceSearchLoading(false);
  updateExplorerMode(false);
  await loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true });
}

async function connectSidecar(snapshot) {
  const invoke = window.__TAURI__?.core?.invoke;
  const listen = window.__TAURI__?.event?.listen;
  if (!invoke || !listen) return;
  nativeInvoke = invoke;
  await listen('terminal:output', (event) => {
    const payload = event.payload;
    if (typeof payload === 'string') appendTerminalTranscript(activeTerminalId, payload);
    else appendTerminalTranscript(payload?.session_id ?? payload?.sessionId, payload?.data ?? '');
  });
  let recoveryAttempted = false;
  const requestSnapshot = async () => {
    const configuredProjectId = await invoke('project_id');
    activeProjectId = configuredProjectId;
    await sendContextRequest('project.list', {}, 'projects');
    await requestProjectSnapshot(configuredProjectId);
    await invoke('sidecar_request', {
      request: JSON.stringify({ id: `runtime-${Date.now()}`, method: 'runtime.status' }),
    });
    await invoke('sidecar_request', { request: JSON.stringify({ id: `providers-${Date.now()}`, method: 'providers.inspect' }) });
    await invoke('sidecar_request', { request: JSON.stringify({ id: `services-${Date.now()}`, method: 'service.list', params: { repositoryPath: activeProject.repositoryPath } }) });
    requestAgentSessions(activeProject.repositoryPath);
    /** The catalog can only be asked for once the sidecar exists, so the first
        read happens here rather than when the module loads. */
    requestRunConfigurations(activeProject.repositoryPath);
  };
  try {
    await listen('sidecar:response', async (event) => {
      const response = JSON.parse(event.payload);
      const contextPurpose = pendingContextRequests.get(String(response.id));
      if (contextPurpose) pendingContextRequests.delete(String(response.id));
      const agentSessionRequestPath = pendingAgentSessionPaths.get(String(response.id));
      if (agentSessionRequestPath) pendingAgentSessionPaths.delete(String(response.id));
      const agentMessageRequestSession = pendingAgentMessageSessions.get(String(response.id));
      if (agentMessageRequestSession) pendingAgentMessageSessions.delete(String(response.id));
      const deletedAgentSessionId = pendingAgentSessionDeletes.get(String(response.id));
      if (deletedAgentSessionId) pendingAgentSessionDeletes.delete(String(response.id));
      if (contextPurpose === 'git-pending') pendingGitRefreshInFlight = false;
      const snapshotProjectId = pendingSnapshotProjects.get(String(response.id));
      if (snapshotProjectId) {
        pendingSnapshotProjects.delete(String(response.id));
        if (snapshotProjectId !== activeProjectId) return;
      }
      const agentPromptProject = pendingAgentPromptProjects.get(String(response.id));
      if (agentPromptProject && agentPromptProject !== activeProjectId) {
        if (response.error || response.result?.status === 'COMPLETED' || response.type === 'agent.stopped') pendingAgentPromptProjects.delete(String(response.id));
        return;
      }
      if (response.error) {
        if (String(response.id).startsWith('agent-prompt-')) {
          pendingAgentPromptProjects.delete(String(response.id));
          agentPromptRunning = false;
          clearPendingAgentTurn();
          activeAgentRequestId = null;
          agentStopRequested = false;
          const sendButton = document.getElementById('agent-send-button');
          if (sendButton) sendButton.disabled = false;
          const turnState = document.getElementById('agent-turn-state');
          if (turnState) { turnState.textContent = 'ERROR'; turnState.dataset.state = 'error'; }
        }
        if (contextPurpose === 'remove-project') pendingProjectRemovals.delete(String(response.id));
        if (contextPurpose === 'projects') {
          projectCatalogLoaded = false;
          const menu = document.getElementById('repository-context-menu');
          if (menu && !menu.hidden) menu.innerHTML = `<p class="git-context-empty">${escapeHTML(response.error.message)}</p>`;
        }
        if (contextPurpose === 'branches') {
          const menu = document.getElementById('branch-context-menu');
          if (menu && !menu.hidden) menu.innerHTML = `<p class="git-context-empty">${escapeHTML(response.error.message)}</p>`;
        }
        if (contextPurpose === 'run-save') {
          /** The file was not written: the dialog stays open with the field the
              sidecar named, so the work in it is not lost to a toast. */
          setRunConfigError(response.error.message);
          pendingRunSaveMessage = null;
          return;
        }
        if (contextPurpose === 'run-list') {
          /** An invalid file is not an empty Project: the menu says which field
              is wrong instead of pretending nothing is declared. */
          runCatalogError = response.error.message;
          runConfigurations = [];
          renderRunControl();
        }
        if (String(response.id).startsWith('run-start-') || String(response.id).startsWith('run-stop-')) {
          notify(response.error.code === 'RUN_PORT_CONFLICT' ? `${response.error.message}. Free it or change the declared port.` : response.error.message);
          requestRunConfigurations(workspaceRootPath);
          return;
        }
        const feedback = document.getElementById('agent-feedback');
        if (feedback) feedback.textContent = 'The operation needs attention.';
        if (contextPurpose === 'git-pending' && pendingGitRequestPath !== workspaceRootPath) requestPendingGitChanges(workspaceRootPath, { showLoading: true });
        showOperationError(response.error, contextPurpose);
        return;
      }
      if (contextPurpose === 'run-list' && response.result?.configurations) {
        runCatalogError = null;
        runConfigurations = response.result.configurations;
        runSessions = response.result.sessions ?? [];
        /** Nothing declared is the moment a proposal helps; a Project that
            already has a catalog is not asked to grow one. */
        if (!runConfigurations.length) void sendContextRequest('run.detect', { repositoryPath: workspaceRootPath }, 'run-detect');
        renderRunControl();
        return;
      }
      if (contextPurpose === 'run-detect' && Array.isArray(response.result)) {
        runSuggestions = response.result;
        renderRunConfigurationMenu();
        return;
      }
      if (contextPurpose === 'run-save' && response.result?.configurations) {
        runConfigurations = response.result.configurations;
        runSuggestions = runSuggestions.filter((draft) => !runConfigurations.some((configuration) => configuration.id === draft.id));
        document.getElementById('run-config-dialog')?.close();
        editedRunConfigurationId = null;
        if (pendingRunSaveMessage) notify(pendingRunSaveMessage);
        pendingRunSaveMessage = null;
        renderRunControl();
        return;
      }
      if (contextPurpose === 'projects' && Array.isArray(response.result)) {
        registeredProjects = response.result;
        projectCatalogLoaded = true;
        renderRepositoryMenu();
        renderProjectsList();
        return;
      }
      if (contextPurpose === 'register-project' && response.result?.id) {
        registeredProjects = [...registeredProjects.filter((project) => project.id !== response.result.id), response.result];
        projectCatalogLoaded = true;
        renderRepositoryMenu();
        renderProjectsList();
        await switchProjectFromContext(response.result);
        return;
      }
      if (contextPurpose === 'remove-project' && response.result?.removed) {
        const removedProjectId = pendingProjectRemovals.get(String(response.id));
        pendingProjectRemovals.delete(String(response.id));
        registeredProjects = registeredProjects.filter((project) => project.id !== removedProjectId);
        projectCatalogLoaded = true;
        renderRepositoryMenu();
        renderProjectsList();
        if (removedProjectId === activeProjectId) {
          const nextProject = registeredProjects[0];
          if (nextProject) await switchProjectFromContext(nextProject);
        } else {
          setSyncState('ready', 'Synced just now');
          notify('Project removed from Assay. Files were kept on disk.');
        }
        return;
      }
      if (contextPurpose === 'agent-session-delete' && response.result?.removed) {
        agentSessions = agentSessions.filter((session) => session.id !== deletedAgentSessionId);
        if (deletedAgentSessionId === activeAgentSessionId) startNewAgentSession();
        else renderAgentSessions(agentSessions);
        notify('Saved conversation deleted.');
        return;
      }
      if (contextPurpose === 'branches' && response.result?.branches) {
        gitBranches = response.result.branches;
        renderBranchMenu();
        return;
      }
      if (contextPurpose === 'git-history' && Array.isArray(response.result)) {
        renderGitHistory(response.result);
        gitUnpushedCommitCount = response.result.filter((commit) => commit.unpushed).length;
        gitCommitNeedsPush = gitUnpushedCommitCount > 0;
        renderCommitControls();
        renderVersionControlRemoteStatus();
        const first = response.result.find((commit) => commit.hash === selectedGitCommit?.hash) ?? response.result[0];
        if (first) selectGitCommit(first.hash);
        return;
      }
      if (contextPurpose === 'git-pending' && response.result?.files) {
        if (pendingGitRequestPath !== workspaceRootPath) {
          requestPendingGitChanges(workspaceRootPath, { showLoading: true });
          return;
        }
        renderPendingGitChanges(response.result);
        return;
      }
      if (contextPurpose === 'git-pending-diff' && response.result?.file === selectedPendingGitFile) {
        renderDiffOutput(document.getElementById('git-pending-diff'), response.result.diff, 'No textual diff for this file.');
        return;
      }
      if (contextPurpose === 'agent-sessions' && Array.isArray(response.result)) {
        if (agentSessionRequestPath !== workspaceRootPath) return;
        renderAgentSessions(response.result);
        return;
      }
      if (contextPurpose === 'agent-messages' && Array.isArray(response.result)) {
        if (agentMessageRequestSession !== activeAgentSessionId) return;
        renderAgentMessages(response.result);
        return;
      }
      if (contextPurpose === 'git-diff' && response.result?.commit && selectedGitCommit?.hash === response.result.commit) {
        renderGitCommitDetail(selectedGitCommit, response.result.diff);
        return;
      }
      if (contextPurpose === 'git-fetch') {
        setSyncState('ready', 'Fetched just now');
        setVersionControlRemoteStatus('Fetched just now');
        notify('Fetched origin.');
        requestVersionControlData(workspaceRootPath);
        return;
      }
      if (contextPurpose === 'git-commit-local' && response.result?.operation === 'commit.create') {
        gitCommitNeedsPush = true;
        gitUnpushedCommitCount += 1;
        renderCommitControls();
        setSyncState('stale', 'Local commit ready to push');
        setVersionControlRemoteStatus('Local commit ready to push');
        notify(`Commit ${response.result.commit?.slice(0, 7) ?? ''} created locally.`.trim());
        const title = document.getElementById('commit-title');
        const body = document.getElementById('commit-body');
        if (title) title.value = '';
        if (body) body.value = '';
        document.getElementById('commit-dialog')?.close();
        requestVersionControlData(workspaceRootPath);
        return;
      }
      if (contextPurpose === 'git-push-origin' && response.result?.operation === 'push') {
        gitCommitNeedsPush = false;
        gitUnpushedCommitCount = 0;
        renderCommitControls();
        setSyncState('ready', 'Pushed just now');
        setVersionControlRemoteStatus('Pushed just now');
        notify(`Pushed ${response.result.branch ?? 'current branch'} to origin.`);
        requestVersionControlData(workspaceRootPath);
        return;
      }
      if (contextPurpose === 'switch-branch' && response.result?.operation === 'branch.switch') {
        const path = document.getElementById('project-path')?.textContent;
        if (path) await refreshGitWorkspace(path, nativeInvoke);
        gitCommitNeedsPush = false;
        gitUnpushedCommitCount = 0;
        setSyncState('ready', 'Synced just now');
        notify(`Branch switched to ${response.result.branch}.`);
        renderCommitControls();
        return;
      }
      if (response.type?.startsWith('runtime.') && response.status) {
        renderRuntimeStatus(response.status);
        if (response.type === 'runtime.event') renderRuntimeEvent(response.taskId, response.event);
        if (response.type === 'runtime.completed') notify(`Implementer completed ${response.taskId}.`);
        if (response.type === 'runtime.failed') notify(`Implementer failed: ${response.status.lastError}`);
        if (response.type !== 'runtime.event') {
          await requestProjectSnapshot(activeProjectId, `runtime-${response.taskId}`);
        }
        return;
      }
      if (response.type === 'skill.event') {
        const feedback = document.getElementById('agent-feedback');
        const payload = response.event?.payload;
        if (feedback) feedback.textContent = `${response.skillId}: ${payload?.type ?? response.event?.type ?? 'event'}`;
        renderRuntimeEvent(selectedTaskId ?? 'skill', response.event);
        return;
      }
      if (response.type === 'run.session' && response.session) {
        applyRunSession(response.session);
        return;
      }
      if (response.type === 'run.output' && response.sessionId) {
        appendRunOutput(response.sessionId, response.text ?? '');
        return;
      }
      if (response.type === 'agent.activity' && pendingAgentTurn) {
        pendingAgentTurn.activity.push(response.item);
        renderAgentMessages(agentRenderedMessages);
        return;
      }
      if (response.type === 'agent.started') {
        activeAgentSessionId = response.sessionId;
        activeAgentTaskId = response.taskId ?? null;
        const providerLabel = document.getElementById('agent-session-provider');
        const title = document.getElementById('agent-session-title');
        const context = document.getElementById('agent-session-context');
        if (providerLabel) providerLabel.textContent = response.provider;
        if (title) title.textContent = response.title || `Conversation ${response.sessionId.slice(0, 12)}`;
        if (context) context.textContent = agentTaskName(activeAgentTaskId);
        renderAgentTaskSelection();
        if (pendingAgentTurn) {
          pendingAgentTurn.sessionId = response.sessionId;
          renderAgentMessages(agentRenderedMessages);
        }
        const turnState = document.getElementById('agent-turn-state');
        if (turnState) { turnState.textContent = 'WORKING'; turnState.dataset.state = 'working'; }
        return;
      }
      if (response.type === 'agent.stopped') {
        pendingAgentPromptProjects.delete(String(response.id));
        agentPromptRunning = false;
        clearPendingAgentTurn();
        activeAgentRequestId = null;
        agentStopRequested = false;
        const button = document.getElementById('agent-send-button');
        const feedback = document.getElementById('agent-feedback');
        if (button) button.disabled = false;
        if (feedback) feedback.textContent = `${response.provider} stopped this turn.`;
        const turnState = document.getElementById('agent-turn-state');
        if (turnState) { turnState.textContent = 'READY'; turnState.dataset.state = 'ready'; }
        if (typeof response.sessionId === 'string' && response.sessionId.includes('-pending-')) {
          activeAgentSessionId = null;
          activeAgentTaskId = null;
          renderAgentTaskSelection();
          renderAgentSessions(agentSessions);
          renderAgentMessages([]);
        } else if (activeAgentSessionId) {
          requestAgentSessions(workspaceRootPath);
          requestAgentMessages(activeAgentSessionId);
        }
        return;
      }
      if (response.result?.sessionId && response.result?.provider && response.result?.status === 'COMPLETED') {
        pendingAgentPromptProjects.delete(String(response.id));
        activeAgentSessionId = response.result.sessionId;
        agentPromptRunning = false;
        clearPendingAgentTurn();
        activeAgentRequestId = null;
        agentStopRequested = false;
        const button = document.getElementById('agent-send-button');
        const feedback = document.getElementById('agent-feedback');
        if (button) button.disabled = false;
        if (feedback) feedback.textContent = `${response.result.provider} completed this turn.`;
        const turnState = document.getElementById('agent-turn-state');
        if (turnState) { turnState.textContent = 'READY'; turnState.dataset.state = 'ready'; }
        requestAgentSessions(workspaceRootPath);
        requestAgentMessages(activeAgentSessionId);
        return;
      }
      if (response.result?.agentRuntime) {
        renderRuntimeStatus(response.result);
        return;
      }
      if (response.result?.serviceId) {
        activeServiceId = response.result.serviceId;
        renderServiceStatus(response.result);
        notify(`Local service ${response.result.status.toLowerCase()}.`);
        nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `services-${Date.now()}`, method: 'service.list', params: { repositoryPath: document.getElementById('project-path')?.textContent } }) });
        return;
      }
      if (Array.isArray(response.result) && response.result[0]?.command && response.result[0]?.status) {
        renderServices(response.result);
        return;
      }
      if (response.result?.branches && response.result?.worktrees) {
        gitBranches = response.result.branches;
        const branchName = response.result.currentBranch || 'detached';
        activeGitBranch = branchName;
        document.getElementById('current-branch-name')?.replaceChildren(document.createTextNode(branchName));
        const projectBranch = document.getElementById('project-branch');
        if (projectBranch) projectBranch.textContent = branchName;
        const statusBranch = document.getElementById('status-branch-name');
        if (statusBranch) statusBranch.textContent = branchName;
        renderBranchMenu();
        renderCommitControls();
        const output = document.getElementById('git-workspace-output');
        if (output) output.textContent = `Current branch\n${response.result.currentBranch}\n\nChanged files\n${response.result.changedFiles.join('\n') || 'clean'}\n\nBranches\n${response.result.branches.join('\n') || '—'}\n\nWorktrees\n${response.result.worktrees.join('\n') || '—'}\n\nRemotes\n${response.result.remotes.join('\n') || '—'}`;
        return;
      }
      if (response.result?.gitWorkflow) {
        gitWorkflow = response.result.gitWorkflow;
        const detail = document.getElementById('git-workspace-detail');
        if (detail) detail.textContent = `Workflow: ${gitWorkflow === 'direct' ? 'commit and push' : 'pull request'}.`;
        return;
      }
      if (response.result?.available !== undefined && response.result?.detail) {
        const detail = document.getElementById('git-workspace-detail');
        if (detail) detail.textContent = `GitHub: ${response.result.available ? 'available' : 'unavailable'} · ${response.result.detail}`;
        return;
      }
      if (response.result?.operation) {
        const detail = document.getElementById('git-workspace-detail');
        if (detail) detail.textContent = `${response.result.operation} completed${response.result.url ? `: ${response.result.url}` : response.result.branch ? `: ${response.result.branch}` : response.result.commit ? `: ${response.result.commit.slice(0, 12)}` : ''}.`;
        notify(`${response.result.operation} completed.`);
        if (selectedTaskId) nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `git-ops-${Date.now()}`, method: 'task.git.operations', params: { taskId: selectedTaskId } }) });
        return;
      }
      if (Array.isArray(response.result) && response.result[0]?.operation && response.result[0]?.taskId) {
        renderGitOperations(response.result);
        return;
      }
      if (response.result?.graph?.mermaid && response.result?.proposal) {
        const graph = document.getElementById('knowledge-graph-output');
        const proposal = document.getElementById('knowledge-reconcile-output');
        if (graph) graph.textContent = `${response.result.graph.mermaid}\n\n${response.result.graph.uml}`;
        if (proposal) proposal.textContent = `${response.result.proposal} Affected: ${response.result.affected.join(', ') || 'none'}. Broken: ${[...(response.result.broken ?? []), ...(response.result.graph.brokenReferences ?? []).map((item) => `${item.from} → ${item.target}`)].join(', ') || 'none'}.`;
        return;
      }
      if (Array.isArray(response.result) && response.result[0]?.capability) {
        renderProviders(response.result);
        return;
      }
      if (response.result?.skillId && response.result?.sessionId) {
        const feedback = document.getElementById('agent-feedback');
        if (feedback) feedback.textContent = `${response.result.skillId} completed in ${response.result.sessionId} (${selectedProvider}).`;
        return;
      }
      if (response.type === 'review.completed' || response.type === 'review.failed') {
        notify(response.type === 'review.completed' ? 'Re-review completed.' : `Re-review failed: ${response.error}`);
        nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `review-refresh-${Date.now()}`, method: 'change.review', params: { taskId: response.taskId } }) });
        return;
      }
      if (response.result?.task?.history) {
        renderTaskDetail(response.result);
        return;
      }
      if (response.result?.gates) {
        renderChangeReview(response.result);
        return;
      }
      if (response.result?.healthy !== undefined) {
        renderRuntimeStatus(response.result.status);
        notify(response.result.healthy ? `OpenCode connected${response.result.version ? ` (${response.result.version})` : ''}.` : 'OpenCode is unhealthy.');
        return;
      }
      // task.create and task.advance answer with the Task itself, not with a
      // snapshot. Both already ask for a fresh snapshot straight after, so the
      // mutation reply is acknowledged and dropped -- letting it fall through
      // to the snapshot branch below rebuilt the view from the startup fixture
      // and emptied the Task list.
      if (response.result?.id && response.result?.intent && response.result?.status && !response.result.tasks) {
        return;
      }
      // Only an actual snapshot renders as one. Anything else the shell does not
      // recognize is ignored rather than mistaken for project state.
      if (response.result?.project && Array.isArray(response.result?.tasks)) {
        const nextProject = mergeActiveProject(activeProject, response.result.project);
        renderSnapshot({
          ...snapshot,
          ...response.result,
          project: nextProject,
          metrics: { ...snapshot.metrics, ...response.result.metrics },
        });
        setSyncState('ready', 'Synced just now');
        recoveryAttempted = false;
        const firstTask = response.result.tasks?.[0];
        if (firstTask) {
          nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `detail-${firstTask.id}-${Date.now()}`, method: 'task.detail', params: { taskId: firstTask.id } }) });
          nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `review-${firstTask.id}-${Date.now()}`, method: 'change.review', params: { taskId: firstTask.id } }) });
        }
      }
      if (response.error) {
        if (response.status) renderRuntimeStatus(response.status);
        setSyncState('failed', 'Snapshot unavailable');
        notify(`Sidecar: ${response.error.message}`);
      }
    });
    await listen('sidecar:error', (event) => {
      setSyncState('failed', 'Sidecar disconnected');
      notify(`Sidecar error: ${event.payload}`);
    });
    await listen('sidecar:exited', () => {
      setSyncState('failed', 'Sidecar exited');
      if (recoveryAttempted) return;
      recoveryAttempted = true;
      notify('Sidecar exited; attempting one recovery.');
      window.setTimeout(async () => {
        try {
          await invoke('sidecar_restart');
          await requestSnapshot();
        } catch (error) {
          setSyncState('failed', 'Recovery required');
          notify('Sidecar recovery failed; retry from Runtime.');
          console.warn('Sidecar recovery unavailable:', error);
        }
      }, 500);
    });
    await invoke('sidecar_start');
    await requestSnapshot();
  } catch (error) {
    setSyncState('failed', 'Local snapshot unavailable');
    console.warn('Sidecar unavailable:', error);
  }
}

async function createTaskFromUI(intent) {
  if (!nativeInvoke) {
    notify('Task creation requires the local sidecar.');
    return;
  }
  const taskId = `task-${Date.now()}`;
  await nativeInvoke('sidecar_request', {
    request: JSON.stringify({
      id: `create-${taskId}`,
      method: 'task.create',
      params: { taskId, intent, projectId: activeProjectId, repositoryPath: document.getElementById('project-path')?.textContent },
    }),
  });
  notify(`Created ${taskId}.`);
  await requestProjectSnapshot(activeProjectId, `create-${taskId}`);
}

async function advanceTaskFromUI(taskId, next, button) {
  if (!nativeInvoke) {
    notify('Task transitions require the local sidecar.');
    return;
  }
  button.disabled = true;
  try {
    await nativeInvoke('sidecar_request', {
      request: JSON.stringify({ id: `advance-${taskId}-${Date.now()}`, method: 'task.advance', params: { taskId, next, reason: `Transition requested from Work: ${next}`, actor: 'human' } }),
    });
    notify(`${taskId} moved to ${next.replaceAll('_', ' ')}.`);
    await requestProjectSnapshot(activeProjectId, `advance-${taskId}`);
  } catch (error) {
    button.disabled = false;
    notify('Task transition failed.');
    console.warn('Task transition unavailable:', error);
  }
}

async function runTaskFromUI(taskId, button) {
  if (!nativeInvoke) {
    notify('Task execution requires the local sidecar.');
    return;
  }
  button.disabled = true;
  try {
    await nativeInvoke('sidecar_request', {
      request: JSON.stringify({ id: `run-${taskId}-${Date.now()}`, method: 'task.run', params: { taskId } }),
    });
    notify(`Starting Implementer for ${taskId}.`);
  } catch (error) {
    button.disabled = false;
    notify('Task execution failed to start.');
    console.warn('Task execution unavailable:', error);
  }
}

async function restartSidecarFromUI() {
  if (!nativeInvoke) {
    notify('Sidecar recovery requires the local desktop runtime.');
    return;
  }
  setSyncState('stale', 'Restarting sidecar…');
  try {
    await nativeInvoke('sidecar_restart');
    await requestProjectSnapshot(activeProjectId, 'recovery');
    await nativeInvoke('sidecar_request', {
      request: JSON.stringify({ id: `recovery-health-${Date.now()}`, method: 'runtime.health' }),
    });
    notify('Sidecar restarted; refreshing project state.');
  } catch (error) {
    setSyncState('failed', 'Recovery required');
    notify('Sidecar recovery failed.');
    console.warn('Sidecar recovery unavailable:', error);
  }
}

function showView(view) {
  activeView = view;
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  panels.forEach((panel) => panel.classList.toggle('active-view', panel.dataset.panel === view));
  document.querySelector('.main-content')?.classList.toggle('editor-focus', view === 'editor');
  const mainContent = document.querySelector('.main-content');
  mainContent?.classList.toggle('agent-focus', view === 'agents');
  mainContent?.classList.toggle('version-control-focus', view === 'changes');
  if (mainContent) mainContent.scrollTop = 0;
  if (view === 'changes') requestVersionControlData(workspaceRootPath);
  if (view === 'agents') requestAgentSessions(workspaceRootPath);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

/** Every asynchronous sidecar failure uses this dialog. Toasts remain for
    short-lived confirmations; an error needs a stable explanation and a
    collapsible diagnostic instead of leaking an opaque JSON payload. */
function showOperationError(error, purpose = '') {
  const technical = typeof error?.message === 'string' ? error.message : String(error ?? 'Unknown error');
  const { title, copy } = operationErrorCopy(technical, purpose);
  const dialog = document.getElementById('operation-error-dialog');
  const titleNode = document.getElementById('operation-error-title');
  const copyNode = document.getElementById('operation-error-copy');
  const technicalNode = document.getElementById('operation-error-technical');
  if (!dialog?.showModal || !titleNode || !copyNode || !technicalNode) { notify(copy); return; }
  titleNode.textContent = title;
  copyNode.textContent = copy;
  technicalNode.textContent = technical;
  if (!dialog.open) dialog.showModal();
}

function operationErrorCopy(technical, purpose) {
  if (/Permission to .+ denied|HTTP 403|returned error: 403/i.test(technical)) {
    return { title: 'Push requires write access', copy: 'This remote does not allow your account to push changes. Use a fork or a repository where you have write access.' };
  }
  if (/failed to index|index\.lock|\.mv\.db/i.test(technical)) {
    return { title: 'Commit blocked by a file in use', copy: 'A runtime file is locked by a running service. Stop that service or add the generated file to your local Git exclusions, then try again.' };
  }
  const operation = {
    'git-commit-local': 'commit',
    'git-push-origin': 'push',
    'git-fetch': 'fetch',
    'run-start': 'start the run',
    'run-stop': 'stop the run',
    'agent-prompt': 'send the agent message',
  }[purpose] ?? 'complete the operation';
  return { title: 'Operation could not be completed', copy: `Assay could not ${operation}. Review the technical details below and try again.` };
}

navItems.forEach((item) => item.addEventListener('click', () => showView(item.dataset.view)));
renderSnapshot(projectSnapshot);
renderRuntimeStatus({ sidecar: 'STARTING', agentRuntime: 'DISCONNECTED', activeTaskId: null, lastEventAt: null, lastError: null });
refreshProjectContext(projectSnapshot);
connectSidecar(projectSnapshot);
window.setInterval(() => {
  if (activeView === 'changes' && document.visibilityState !== 'hidden') requestPendingGitChanges(workspaceRootPath);
}, 1200);
document.querySelectorAll('[data-view-target]').forEach((item) => item.addEventListener('click', () => showView(item.dataset.viewTarget)));
document.querySelectorAll('[data-action]').forEach((item) => item.addEventListener('click', () => {
  if (item.dataset.action === 'toggle-theme') {
    const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
    notify(`${nextTheme === 'light' ? 'Light' : 'Dark'} theme enabled.`);
    return;
  }
  if (item.dataset.action === 'focus-search' || item.dataset.action === 'quick-open') {
    document.getElementById('workspace-filter')?.focus();
    notify('Workspace search focused.');
    return;
  }
  if (item.dataset.action === 'new-task') {
    taskDialog?.showModal();
    taskIntent?.focus();
    return;
  }
  if (item.dataset.action === 'add-project') {
    void addProjectFromUI();
    return;
  }
  if (item.dataset.action === 'check-runtime') {
    if (!nativeInvoke) {
      notify('Runtime diagnostics require the local sidecar.');
      return;
    }
    nativeInvoke('sidecar_request', {
      request: JSON.stringify({ id: `health-${Date.now()}`, method: 'runtime.health' }),
    }).catch((error) => console.warn('Runtime health unavailable:', error));
    notify('Checking OpenCode connection…');
    return;
  }
  if (item.dataset.action === 'restart-sidecar') {
    restartSidecarFromUI();
    return;
  }
  if (item.dataset.action === 'run-start' || item.dataset.action === 'run-debug') {
    startRun(item.dataset.action === 'run-debug' ? 'debug' : 'run');
    return;
  }
  if (item.dataset.action === 'run-stop') {
    stopRun();
    return;
  }
  if (item.dataset.action === 'open-run-url') {
    openRunUrl();
    return;
  }
  if (item.dataset.action === 'start-service' || item.dataset.action === 'stop-service') {
    if (!nativeInvoke) { notify('Local services require the sidecar.'); return; }
    const method = item.dataset.action === 'start-service' ? 'service.start' : 'service.stop';
    const params = method === 'service.start'
      ? { repositoryPath: document.getElementById('project-path')?.textContent }
      : { serviceId: activeServiceId };
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `${method}-${Date.now()}`, method, params }) }).catch((error) => { notify('Local service action failed.'); console.warn(error); });
    return;
  }
  if (item.dataset.action === 'open-terminal') {
    showView('projects');
    document.querySelector('.terminal-dock')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    activeTerminal()?.terminal?.focus();
    notify('Integrated terminal focused at the project root.');
    return;
  }
  if (item.dataset.action === 'refresh-tree') {
    window.clearTimeout(workspaceSearchTimer);
    workspaceSearchToken += 1;
    setWorkspaceSearchLoading(false);
    workspaceSearchEntries = null;
    workspaceSearchIndex = null;
    loadWorkspaceTree(document.getElementById('project-path')?.textContent, nativeInvoke);
    return;
  }
  if (item.dataset.action === 'toggle-sidebar') {
    setSidebarCollapsed(!sidebarCollapsed, { animate: true });
    return;
  }
  if (item.dataset.action === 'reveal-open-file') {
    void revealOpenFileInExplorer();
    return;
  }
  if (item.dataset.action === 'toggle-explorer') {
    if (explorerExpanded) void collapseExplorer();
    else void expandExplorer();
    return;
  }
  if (item.dataset.action === 'toggle-agent-rail') {
    setAgentRailCollapsed(!agentRailCollapsed);
    return;
  }
  if (item.dataset.action === 'refresh-git') {
    refreshGitWorkspace(document.getElementById('project-path')?.textContent, nativeInvoke);
    return;
  }
  if (item.dataset.action === 'refresh-version-control') {
    requestVersionControlData(workspaceRootPath);
    return;
  }
  if (item.dataset.action === 'fetch-origin') {
    if (!nativeInvoke || activeVersionControl === 'none') { notify('Fetch requires a Git Project.'); return; }
    setSyncState('stale', 'Fetching origin…');
    void sendContextRequest('git.fetch.origin', { repositoryPath: workspaceRootPath, actor: 'human', reason: 'Fetch requested from Version control', confirmed: true }, 'git-fetch').catch((error) => notify(error instanceof Error ? error.message : 'Fetch failed.'));
    return;
  }
  if (item.dataset.action === 'open-commit-dialog') {
    if (!nativeInvoke || activeVersionControl === 'none') { notify('Commit requires a Git Project.'); return; }
    const pendingStatus = document.getElementById('git-pending-status')?.textContent ?? '';
    if (pendingStatus === 'Working tree clean' || pendingStatus.startsWith('This Project')) { notify('There are no pending changes to commit.'); return; }
    const dialog = document.getElementById('commit-dialog');
    if (dialog?.showModal) {
      dialog.showModal();
      requestAnimationFrame(() => document.getElementById('commit-title')?.focus());
    }
    return;
  }
  if (item.dataset.action === 'close-commit-dialog') {
    document.getElementById('commit-dialog')?.close();
    return;
  }
  if (item.dataset.action === 'cancel-delete-agent-session') {
    closeDeleteAgentSessionDialog();
    return;
  }
  if (item.dataset.action === 'confirm-delete-agent-session') {
    confirmDeleteAgentSession();
    return;
  }
  if (item.dataset.action === 'commit-local') return;
  if (item.dataset.action === 'push-origin') {
    if (!nativeInvoke || activeVersionControl === 'none') { notify('Push requires a Git Project.'); return; }
    if (!gitCommitNeedsPush) { notify('Create a local commit before pushing.'); return; }
    setSyncState('stale', 'Pushing to origin…');
    void sendContextRequest('git.push', { repositoryPath: workspaceRootPath, reason: 'Push requested from Version control', actor: 'human', confirmed: true }, 'git-push-origin').catch((error) => notify(error instanceof Error ? error.message : 'Push failed.'));
    return;
  }
  if (item.dataset.action === 'refresh-knowledge') {
    const repositoryPath = document.getElementById('project-path')?.textContent;
    const taskId = selectedTaskId;
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `knowledge-${Date.now()}`, method: 'knowledge.reconcile.changed', params: { repositoryPath, ...(taskId && taskId !== '—' ? { taskId } : {}) } }) });
    return;
  }
  if (item.dataset.action === 'open-file-external') {
    const filePath = activeDocument?.path ?? selectedFilePath;
    if (!filePath || !nativeInvoke) { notify('No file is available to open externally.'); return; }
    nativeInvoke('open_file', { path: filePath }).then(() => notify('File opened externally.')).catch((error) => {
      notify('Unable to open file externally.');
      console.warn('External file open unavailable:', error);
    });
    return;
  }
  if (item.dataset.action === 'save-file') {
    void saveActiveDocument();
    return;
  }
  if (item.dataset.action === 'format-document') {
    void formatActiveDocument();
    return;
  }
  if (item.dataset.action === 'discard-file') {
    void discardDocumentChanges();
    return;
  }
  if (item.dataset.action === 'close-file') {
    void closeFilePreview();
    return;
  }
  if (item.dataset.action === 'create-worktree') {
    if (!nativeInvoke) { notify('Git operations require the sidecar.'); return; }
    openWorktreeDialog();
    return;
  }
  if (item.dataset.action === 'close-worktree-dialog') {
    document.getElementById('worktree-dialog')?.close();
    return;
  }
  if (item.dataset.action === 'cancel-confirm') {
    closeConfirmation();
    return;
  }
  if (item.dataset.action === 'accept-confirm') {
    acceptConfirmation();
    return;
  }
  if (['create-branch', 'create-commit', 'push-branch', 'create-pr'].includes(item.dataset.action)) {
    if (!nativeInvoke) { notify('Git operations require the sidecar.'); return; }
    const taskSuffix = selectedTaskId ? selectedTaskId.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'ade-next';
    const labels = { 'create-branch': ['git.branch.create', `feature/${taskSuffix}`], 'create-commit': ['git.commit.create', selectedTaskId ? `chore: record ${selectedTaskId}` : 'chore: record Assay changes'], 'push-branch': ['git.push', ''], 'create-pr': [gitWorkflow === 'direct' ? 'git.push' : 'github.pr.create', gitWorkflow === 'direct' ? '' : selectedTaskIntent || 'Assay change'] };
    const [method, intent] = labels[item.dataset.action];
    requestConfirmation({
      eyebrow: 'GIT OPERATION',
      title: `Run ${method}?`,
      copy: intent ? `ADE runs it on the active Project as “${intent}”.` : 'Assay runs it on the active Project and its current branch.',
      confirmLabel: 'Run',
    }, () => {
      nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `${method}-${Date.now()}`, method, params: { ...(selectedTaskId ? { taskId: selectedTaskId } : {}), repositoryPath: document.getElementById('project-path')?.textContent, intent, actor: 'human', reason: `Confirmed in ADE Git workspace`, confirmed: true } }) }).then(() => {
        notify(`${method} completed.`);
        const taskId = selectedTaskId;
        if (taskId) nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `git-ops-${Date.now()}`, method: 'task.git.operations', params: { taskId } }) });
      }).catch((error) => { notify('Git operation failed.'); console.warn(error); });
    });
    return;
  }
  if (item.dataset.action === 'github-status') {
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `github-${Date.now()}`, method: 'github.status' }) });
    return;
  }
  if (item.dataset.action === 'open-document') {
    if (!nativeInvoke) {
      notify('Opening documentation requires the local desktop runtime.');
      return;
    }
    const repositoryPath = document.getElementById('project-path')?.textContent;
    nativeInvoke('open_document', { repositoryPath, relativePath: `docu/specs/${item.dataset.document}` }).then(() => notify('Documentation opened.')).catch((error) => {
      notify('Unable to open documentation.');
      console.warn('Documentation unavailable:', error);
    });
    return;
  }
  if (item.dataset.action === 'approve') {
    if (!nativeInvoke) {
      notify('Approval requires the local sidecar.');
      return;
    }
    const taskId = document.getElementById('changes-task-id')?.textContent;
    nativeInvoke('sidecar_request', {
      request: JSON.stringify({ id: `approve-${taskId}-${Date.now()}`, method: 'task.approve', params: { taskId, reason: 'Human approval confirmed in Changes', actor: 'human' } }),
    }).then(() => {
      notify('Task approved and completed.');
      return requestProjectSnapshot(activeProjectId, 'approve');
    }).catch((error) => {
      notify('Approval blocked by required gates.');
      console.warn('Approval unavailable:', error);
    });
    return;
  }
  if (item.dataset.action === 'rereview') {
    if (!nativeInvoke) { notify('Re-review requires the local sidecar.'); return; }
    const taskId = document.getElementById('changes-task-id')?.textContent;
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `rereview-${taskId}-${Date.now()}`, method: 'task.rereview', params: { taskId, reason: 'Human requested a fresh independent review', actor: 'human' } }) }).then(() => notify('Re-review started.')).catch((error) => { notify('Re-review unavailable.'); console.warn(error); });
    return;
  }
  const messages = { approve: 'Approval is protected by the required gates.', learn: 'Runtime documentation is coming next.' };
  notify(messages[item.dataset.action] ?? 'Action recorded.');
}));
document.getElementById('terminal-new-tab')?.addEventListener('click', () => {
  createTerminalTab();
  notify('New terminal session opened.');
});
document.getElementById('repository-context-button')?.addEventListener('click', () => toggleGitContextMenu('repository'));
document.getElementById('task-context-button')?.addEventListener('click', () => toggleGitContextMenu('task'));
document.getElementById('branch-context-button')?.addEventListener('click', () => toggleGitContextMenu('branch'));
document.getElementById('git-commit-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!nativeInvoke || activeVersionControl === 'none') { notify('Commit requires a Git Project.'); return; }
  const title = document.getElementById('commit-title')?.value.trim();
  const body = document.getElementById('commit-body')?.value.trim() ?? '';
  const pendingStatus = document.getElementById('git-pending-status')?.textContent ?? '';
  if (!title) { notify('Enter a commit title.'); return; }
  if (pendingStatus === 'Working tree clean' || pendingStatus.startsWith('This Project')) { notify('There are no pending changes to commit.'); return; }
  setSyncState('stale', 'Creating local commit…');
  void sendContextRequest('git.commit.create', { repositoryPath: workspaceRootPath, intent: title, ...(body ? { body } : {}), reason: 'Local commit requested from Version control', actor: 'human', confirmed: true }, 'git-commit-local').catch((error) => notify(error instanceof Error ? error.message : 'Commit failed.'));
});
document.getElementById('worktree-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!nativeInvoke) { notify('Git operations require the sidecar.'); return; }
  const branch = document.getElementById('worktree-branch')?.value.trim();
  const path = document.getElementById('worktree-path')?.value.trim();
  if (!branch || !path) { notify('Enter a branch and an absolute path for the worktree.'); return; }
  document.getElementById('worktree-dialog')?.close();
  nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `git-worktree-${Date.now()}`, method: 'git.worktree.create', params: { ...(selectedTaskId ? { taskId: selectedTaskId } : {}), repositoryPath: document.getElementById('project-path')?.textContent, branch, worktreePath: path, actor: 'human', reason: 'Confirmed in Assay Git workspace', confirmed: true } }) }).catch((error) => { notify('Worktree creation failed.'); console.warn(error); });
});
document.getElementById('confirm-dialog')?.addEventListener('close', () => { pendingConfirmation = null; });
document.addEventListener('click', (event) => {
  const historyPaneToggle = event.target.closest('[data-history-pane-toggle]');
  if (historyPaneToggle) {
    const pane = historyPaneToggle.dataset.historyPaneToggle;
    setHistoryPaneCollapsed(pane, pane === 'commits' ? !historyCommitsCollapsed : !historyFilesCollapsed);
    return;
  }
  const changesPaneToggle = event.target.closest('[data-changes-pane-toggle]');
  if (changesPaneToggle) {
    setChangesPaneCollapsed(!changesFilesCollapsed);
    return;
  }
  const versionControlTab = event.target.closest('[data-version-control-tab]');
  if (versionControlTab) {
    const tab = versionControlTab.dataset.versionControlTab;
    renderVersionControlTabs(tab);
    return;
  }
  const commitFile = event.target.closest('[data-git-commit-file]');
  if (commitFile && selectedGitCommit) {
    selectGitCommit(selectedGitCommit.hash, commitFile.dataset.gitCommitFile);
    return;
  }
  const pendingFile = event.target.closest('[data-git-pending-file]');
  if (pendingFile) {
    selectedPendingGitFile = pendingFile.dataset.gitPendingFile;
    document.querySelectorAll('[data-git-pending-file]').forEach((file) => file.classList.toggle('active', file === pendingFile));
    renderDiffOutput(document.getElementById('git-pending-diff'), null, 'Loading file diff…');
    requestPendingGitDiff(selectedPendingGitFile);
    return;
  }
  const commitOption = event.target.closest('[data-git-commit]');
  if (commitOption) {
    selectGitCommit(commitOption.dataset.gitCommit);
    return;
  }
  const removeProjectButton = event.target.closest('[data-remove-project-id]');
  if (removeProjectButton) {
    const project = registeredProjects.find((candidate) => candidate.id === removeProjectButton.dataset.removeProjectId);
    if (project) removeProjectFromUI(project);
    return;
  }
  const projectOption = event.target.closest('[data-project-id]');
  if (projectOption) {
    const project = registeredProjects.find((candidate) => candidate.id === projectOption.dataset.projectId);
    if (project) void switchProjectFromContext(project);
    return;
  }
  const branchOption = event.target.closest('[data-branch-name]');
  if (branchOption) {
    void switchBranchFromContext(branchOption.dataset.branchName);
    return;
  }
  const taskOption = event.target.closest('[data-task-context-id]');
  if (taskOption) {
    selectTaskContext(taskOption.dataset.taskContextId);
    return;
  }
  const closeButton = event.target.closest('[data-terminal-close-id]');
  if (closeButton) {
    closeTerminalTab(closeButton.dataset.terminalCloseId);
    return;
  }
  const tabButton = event.target.closest('[data-terminal-tab-id]');
  if (tabButton) selectTerminalTab(tabButton.dataset.terminalTabId);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.git-context-control')) closeGitContextMenus();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeGitContextMenus();
});
document.addEventListener('click', (event) => {
  const runEdit = event.target.closest('[data-run-edit-id]');
  if (runEdit) { openRunConfigDialog(runConfigurations.find((configuration) => configuration.id === runEdit.dataset.runEditId)); return; }
  const runSuggestion = event.target.closest('[data-run-suggestion-id]');
  if (runSuggestion) { addRunSuggestion(runSuggestion.dataset.runSuggestionId); return; }
  if (event.target.closest('[data-action="new-run-config"]')) { openRunConfigDialog(null); return; }
  const runOption = event.target.closest('[data-run-configuration-id]');
  if (runOption) { chooseRunConfiguration(runOption.dataset.runConfigurationId); return; }
  const trigger = event.target.closest('.picker-button');
  if (trigger?.dataset.pickerKind === 'run') { toggleRunPicker(); return; }
  if (!event.target.closest('.run-picker')) closeRunPicker();
  if (trigger) { toggleAgentPicker(trigger.dataset.pickerKind); return; }
  const defaultToggle = event.target.closest('.picker-default');
  if (defaultToggle) { toggleDefaultModel(defaultToggle.dataset.defaultModel); return; }
  const option = event.target.closest('.picker-option');
  if (option) { chooseAgentPickerOption(option.dataset.pickerKind, option.dataset.pickerValue); return; }
  if (!event.target.closest('.picker')) closeAgentPickers();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !agentPickerIsOpen()) return;
  const kind = document.querySelector('.picker-menu:not([hidden])')?.id.replace('agent-', '').replace('-menu', '');
  closeAgentPickers();
  document.getElementById(`agent-${kind}-button`)?.focus();
  /** Escape closed the menu; it must not also stop the running turn. */
  event.preventDefault();
});
document.addEventListener('click', (event) => {
  const serviceButton = event.target.closest('[data-service-action][data-service-id]');
  if (serviceButton) {
    if (!nativeInvoke) { notify('Local services require the sidecar.'); return; }
    const method = serviceButton.dataset.serviceAction === 'start' ? 'service.start' : 'service.stop';
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `${method}-${Date.now()}`, method, params: { serviceId: serviceButton.dataset.serviceId, repositoryPath: document.getElementById('project-path')?.textContent } }) }).catch((error) => { notify('Local service action failed.'); console.warn(error); });
    return;
  }
  const resumeButton = event.target.closest('[data-resume-session]');
  if (resumeButton) {
    resumeAgentConversation(resumeButton.dataset.resumeSession, resumeButton.dataset.sessionProvider);
    return;
  }
  const agentSession = event.target.closest('[data-agent-session-id]');
  if (agentSession) {
    selectAgentSession(agentSession.dataset.agentSessionId);
    return;
  }
  const agentGroupToggle = event.target.closest('[data-agent-group-toggle]');
  if (agentGroupToggle) {
    toggleAgentSessionGroup(agentGroupToggle.dataset.agentGroupToggle);
    return;
  }
  const deleteAgentSessionButton = event.target.closest('[data-delete-agent-session-id]');
  if (deleteAgentSessionButton) {
    openDeleteAgentSessionDialog(deleteAgentSessionButton.dataset.deleteAgentSessionId);
    return;
  }
  const directoryEntry = event.target.closest('[data-directory-path].directory');
  if (directoryEntry) {
    if (!explorerExpanded) void expandExplorerFrom(directoryEntry);
    else void toggleWorkspaceDirectory(directoryEntry);
    return;
  }
  const fileEntry = event.target.closest('[data-file-path].file');
  if (fileEntry) {
    const filter = document.getElementById('workspace-filter');
    const wasSearching = Boolean(filter?.value.trim());
    void openFileInADE(fileEntry.dataset.filePath).finally(() => {
      if (!wasSearching) return;
      if (filter) filter.value = '';
      setWorkspaceSearchLoading(false);
      void collapseExplorer();
    });
    return;
  }
  const copyButton = event.target.closest('[data-copy-message]');
  if (copyButton) {
    void copyAgentMessage(copyButton.dataset.copyMessage, copyButton);
    return;
  }
  const taskRow = event.target.closest('[data-task-select]');
  if (taskRow) {
    const taskId = taskRow.dataset.taskSelect;
    // Selecting a Task here *is* setting the shell's active Task, the same one the
    // topbar shows. One path, so the view can never disagree with the topbar.
    if (taskId !== selectedTaskId) selectTaskContext(taskId);
    else toggleTaskDetail(taskRow);
    return;
  }
  const runButton = event.target.closest('[data-task-id][data-task-run]');
  if (runButton) {
    runTaskFromUI(runButton.dataset.taskId, runButton);
    return;
  }
  const button = event.target.closest('[data-task-id][data-task-next]');
  if (!button) return;
  advanceTaskFromUI(button.dataset.taskId, button.dataset.taskNext, button);
});
// The binding every editor spends on this, and one the window system does not
// already claim inside a webview.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'b' && event.key !== 'B') return;
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.defaultPrevented) return;
  event.preventDefault();
  setSidebarCollapsed(!sidebarCollapsed, { animate: true });
});
const documentTabStrip = document.getElementById('document-tabs');
documentTabStrip?.addEventListener('click', (event) => {
  const close = event.target.closest('[data-document-close-id]');
  if (close) { closeDocumentTab(close.dataset.documentCloseId); return; }
  const tab = event.target.closest('[data-document-tab-id]');
  if (tab) void activateDocumentTab(tab.dataset.documentTabId);
});
// Middle click closes a tab, as it does in the editors this strip borrows from.
documentTabStrip?.addEventListener('auxclick', (event) => {
  const tab = event.button === 1 && event.target.closest('[data-document-tab-id]');
  if (!tab) return;
  event.preventDefault();
  closeDocumentTab(tab.dataset.documentTabId);
});
documentTabStrip?.addEventListener('keydown', (event) => {
  const tabs = [...documentTabStrip.querySelectorAll('[data-document-tab-id]')];
  const currentIndex = tabs.indexOf(event.target);
  if (currentIndex < 0) return;
  // Delete on the focused tab is how its close control stays reachable without
  // adding a second stop to the roving tab order.
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    closeDocumentTab(event.target.dataset.documentTabId);
    return;
  }
  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  else return;
  event.preventDefault();
  focusDocumentTabAt(nextIndex);
});
// A strip that has overflowed is scrolled with the wheel, not only by dragging
// a scrollbar that most pointing devices never show.
documentTabStrip?.addEventListener('wheel', (event) => {
  if (event.deltaX !== 0 || documentTabStrip.scrollWidth <= documentTabStrip.clientWidth) return;
  documentTabStrip.scrollLeft += event.deltaY;
}, { passive: true });
if (documentTabStrip && window.ResizeObserver) new ResizeObserver(() => updateDocumentTabsOverflow()).observe(documentTabStrip);
document.getElementById('document-tabs-more')?.addEventListener('click', toggleDocumentTabsMenu);
document.getElementById('document-tabs-menu')?.addEventListener('click', (event) => {
  const item = event.target.closest('[data-document-tab-id]');
  if (!item) return;
  closeDocumentTabsMenu();
  void activateDocumentTab(item.dataset.documentTabId);
});
document.addEventListener('click', (event) => {
  if (document.getElementById('document-tabs-menu')?.hidden !== false) return;
  if (event.target.closest('.document-tabs-overflow')) return;
  closeDocumentTabsMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.getElementById('document-tabs-menu')?.hidden === false) {
    event.preventDefault();
    closeDocumentTabsMenu();
    document.getElementById('document-tabs-more')?.focus();
    return;
  }
  // Ctrl+Tab cycles the open files, the one binding every editor agrees on and
  // the one macOS does not already spend on the window.
  if (event.key !== 'Tab' || !event.ctrlKey || activeView !== 'editor' || openDocuments.length < 2) return;
  event.preventDefault();
  stepDocumentTab(event.shiftKey ? -1 : 1);
});
document.querySelector('.version-control-tabs')?.addEventListener('keydown', (event) => {
  const tabs = [...document.querySelectorAll('[data-version-control-tab]')];
  const currentIndex = tabs.indexOf(event.target);
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  else return;
  event.preventDefault();
  const nextTab = tabs[nextIndex];
  renderVersionControlTabs(nextTab.dataset.versionControlTab);
  nextTab.focus();
});
document.getElementById('git-history-filter')?.addEventListener('input', (event) => {
  gitHistoryFilter = event.target.value;
  renderFilteredGitHistory();
});
document.getElementById('git-pending-filter')?.addEventListener('input', (event) => {
  pendingGitFilter = event.target.value;
  renderPendingGitChanges({ files: pendingGitFiles });
});
restoreHistoryPaneLayout();
restoreChangesPaneLayout();
document.getElementById('agent-provider')?.addEventListener('change', (event) => {
  selectedProvider = event.target.value;
  selectedAgentModel = defaultModelForProvider(selectedProvider);
  if (activeAgentSessionId && agentSessions.some((session) => session.id === activeAgentSessionId && session.provider !== selectedProvider)) startNewAgentSession();
  renderProviderSelection();
  renderModelSelection();
});
document.getElementById('agent-delete-dialog')?.addEventListener('cancel', () => {
  pendingAgentSessionDeletion = null;
});
document.getElementById('agent-prompt-form')?.addEventListener('submit', sendAgentPrompt);
document.getElementById('agent-prompt-input')?.addEventListener('keydown', handleAgentComposerKeydown);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.defaultPrevented || activeView !== 'agents' || !agentPromptRunning || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  stopAgentPrompt();
});
document.getElementById('agent-model')?.addEventListener('change', (event) => {
  selectedAgentModel = event.target.value;
  const session = agentSessions.find((candidate) => candidate.id === activeAgentSessionId);
  if (session) session.model = selectedAgentModel;
});
document.querySelector('[data-action="new-agent-session"]')?.addEventListener('click', startNewAgentSession);
renderAgentPickers();
resetRunControlForProject();
document.getElementById('run-config-form')?.addEventListener('submit', submitRunConfigDialog);
document.getElementById('run-config-kind')?.addEventListener('change', syncRunConfigFields);
document.getElementById('run-config-delete')?.addEventListener('click', deleteEditedRunConfiguration);
document.querySelector('[data-action="close-run-dialog"]')?.addEventListener('click', () => document.getElementById('run-config-dialog')?.close());
document.getElementById('run-config-dialog')?.addEventListener('close', () => { editedRunConfigurationId = null; });
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.defaultPrevented || document.getElementById('run-configuration-menu')?.hidden !== false) return;
  closeRunPicker();
  document.getElementById('run-configuration-button')?.focus();
  event.preventDefault();
});
initializeCodeEditor();
document.getElementById('workspace-filter')?.addEventListener('input', (event) => { scheduleWorkspaceFileSearch(event.target.value); });
window.addEventListener('beforeunload', () => {
  nativeInvoke?.('terminal_stop_all').catch(() => {});
});
taskForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const intent = taskIntent?.value.trim();
  if (!intent) return;
  const button = document.getElementById('create-task-button');
  if (button) button.disabled = true;
  try {
    await createTaskFromUI(intent);
    taskForm.reset();
    taskDialog?.close();
  } catch (error) {
    notify('Task creation failed.');
    console.warn('Task creation unavailable:', error);
  } finally {
    if (button) button.disabled = false;
  }
});
