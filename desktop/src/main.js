import { projectSnapshot } from './project-snapshot.js';
import { mergeActiveProject } from './project-context.js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

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
let activeProjectId = projectSnapshot.project.id;
let activeProject = mergeActiveProject({}, projectSnapshot.project);
let workspaceRootPath = projectSnapshot.project.repositoryPath;
let activeGitBranch = null;
let activeVersionControl = 'git';
let selectedFilePath = null;
let activeDocument = null;
let documentOriginalContent = '';
let documentDirty = false;
let explorerExpanded = false;
let workspaceSearchEntries = null;
let workspaceSearchIndex = null;
let workspaceSearchToken = 0;
let workspaceSearchTimer = null;
const terminalResizer = document.getElementById('terminal-resizer');
const sidebarResizer = document.getElementById('sidebar-resizer');
const terminalStorageKey = `ade-terminal-height:${activeProjectId}`;
const sidebarStorageKey = `ade-sidebar-width:${activeProjectId}`;
let terminalHeight = 138;
let terminalResizeState = null;
let terminalFitFrame = null;
let sidebarWidth = 246;
let sidebarResizeState = null;
let activeServiceId = null;
let gitWorkflow = 'pull-request';
let selectedTaskId = null;
let selectedTaskIntent = '';
let providerStatuses = [];
const runtimeEvents = [];
let registeredProjects = [];
let projectCatalogLoaded = false;
let gitBranches = [];
let gitHistoryCommits = [];
let selectedGitCommit = null;
const pendingContextRequests = new Map();
const pendingSnapshotProjects = new Map();
const pendingProjectRemovals = new Map();

function applyTheme(theme) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  try { localStorage.setItem('ade-theme', nextTheme); } catch { /* Tauri privacy settings may disable storage. */ }
  if (themeMeta) themeMeta.content = nextTheme === 'light' ? '#f5f7fa' : '#0b0f14';
  document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => {
    button.setAttribute('aria-checked', String(nextTheme === 'light'));
    const nextLabel = nextTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    button.title = nextLabel;
    button.setAttribute('aria-label', nextLabel);
    const label = button.querySelector('.theme-switch-label');
    if (label) label.textContent = nextTheme === 'light' ? 'Dark' : 'Light';
  });
  const terminalTheme = nextTheme === 'light'
    ? { background: '#e8f2ef', foreground: '#195c4c', cursor: '#0e827b', selectionBackground: '#b9ddd2' }
    : { background: '#0d1416', foreground: '#b7e9d0', cursor: '#1aa889', selectionBackground: '#24574a' };
  terminalTabs?.forEach((tab) => {
    if (tab.terminal) tab.terminal.options.theme = terminalTheme;
  });
}

let initialTheme = 'dark';
const requestedTheme = new URLSearchParams(window.location.search).get('theme');
try { initialTheme = requestedTheme ?? localStorage.getItem('ade-theme') ?? 'dark'; } catch { initialTheme = requestedTheme ?? 'dark'; }
applyTheme(initialTheme);

function setTerminalHeight(nextHeight, persist = true) {
  const minHeight = 110;
  const maxHeight = Math.max(260, Math.round(window.innerHeight * 0.72));
  terminalHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(nextHeight)));
  document.documentElement.style.setProperty('--terminal-height', `${terminalHeight}px`);
  terminalResizer?.setAttribute('aria-valuemax', String(maxHeight));
  terminalResizer?.setAttribute('aria-valuenow', String(terminalHeight));
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
  return { min: 190, max: Math.min(720, Math.max(420, Math.round(window.innerWidth * 0.58))) };
}

function setSidebarWidth(nextWidth, persist = true) {
  const bounds = sidebarWidthBounds();
  sidebarWidth = Math.max(bounds.min, Math.min(bounds.max, Math.round(nextWidth)));
  document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  sidebarResizer?.setAttribute('aria-valuemax', String(bounds.max));
  sidebarResizer?.setAttribute('aria-valuenow', String(sidebarWidth));
  if (persist) {
    try { localStorage.setItem(sidebarStorageKey, String(sidebarWidth)); } catch { /* Persistence is optional. */ }
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

function createTerminalTab({ focus = true } = {}) {
  terminalTabSequence += 1;
  const id = `terminal-${Date.now()}-${terminalTabSequence}`;
  const tab = {
    id,
    label: `Terminal ${terminalTabSequence}`,
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
    theme: { background: '#0d1416', foreground: '#b7e9d0', cursor: '#1aa889' },
  });
  tab.fitAddon = new FitAddon();
  tab.terminal.loadAddon(tab.fitAddon);
  tab.terminal.onData((data) => {
    void sendTerminalInput(tab, data);
  });
  tab.terminal.onResize(({ cols, rows }) => {
    if (tab.started && nativeInvoke) void nativeInvoke('terminal_resize', { sessionId: tab.id, cols, rows }).catch(() => {});
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
  if (tab.started) nativeInvoke?.('terminal_stop', { sessionId: tab.id }).catch(() => {});
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
} catch { /* Persistence is optional. */ }
setSidebarWidth(sidebarWidth, false);

terminalResizer?.addEventListener('pointerdown', (event) => {
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
  if (event.key === 'Home') { event.preventDefault(); setTerminalHeight(110); }
  if (event.key === 'End') { event.preventDefault(); setTerminalHeight(window.innerHeight * 0.72); }
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
    'project-description': activeProject.description ?? 'Local ADE project',
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
  const breadcrumbRoot = document.querySelector('.breadcrumb-root');
  if (breadcrumbRoot) breadcrumbRoot.textContent = activeProject.name;
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
  renderChanges(snapshot.tasks ?? []);
  renderProjectTasks(snapshot.tasks ?? []);
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
    return `<div class="project-list-item${isActive ? ' active' : ''}"><button class="project-list-select" type="button" data-project-id="${escapeHTML(project.id)}"><span class="project-list-icon" aria-hidden="true">${isActive ? '●' : '○'}</span><span class="project-list-copy"><strong>${escapeHTML(project.name)}</strong><small>${escapeHTML(project.repositoryPath)}</small></span><span class="project-list-vcs">${versionControl}</span><span class="project-list-arrow" aria-hidden="true">→</span></button><button class="project-list-remove" type="button" data-remove-project-id="${escapeHTML(project.id)}" aria-label="Remove ${escapeHTML(project.name)} from ADE" title="Remove from ADE"${canRemove ? '' : ' disabled'}>×</button></div>`;
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
    if (selectedFilePath && !selectedFilePath.startsWith(`${workspaceRootPath}/`)) {
      selectedFilePath = null;
      activeDocument = null;
      document.getElementById('document-viewer')?.setAttribute('hidden', '');
    }
    renderSnapshot({ ...projectSnapshot, project: activeProject, metrics: { ...projectSnapshot.metrics, activeTasks: 0, inReview: 0 } });
    window.clearTimeout(workspaceSearchTimer);
    workspaceSearchToken += 1;
    setWorkspaceSearchLoading(false);
    workspaceSearchEntries = null;
    workspaceSearchIndex = null;
    await loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true });
    await refreshGitWorkspace(workspaceRootPath, nativeInvoke);
    await sendContextRequest('project.snapshot', { projectId: activeProjectId }, 'snapshot');
    await sendContextRequest('skills.list', { repositoryPath: workspaceRootPath }, 'skills');
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
    await sendContextRequest('git.branch.switch', { repositoryPath: path, branch, actor: 'human', reason: 'Branch selected from ADE Git context bar', confirmed: true }, 'switch-branch');
  } catch (error) {
    setSyncState('failed', 'Branch switch failed');
    notify(error instanceof Error ? error.message : 'Branch switch failed.');
  }
}

function projectIdForPath(path) {
  const base = path.split('/').filter(Boolean).at(-1) ?? 'project';
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
  if (!registeredProjects.some((project) => project.id === slug)) return slug;
  return `${slug}-${Date.now().toString(36)}`;
}

async function addProjectFromUI() {
  if (!nativeInvoke) { notify('Adding a project requires the local desktop runtime.'); return; }
  try {
    const selectedPath = await nativeInvoke('select_project_directory');
    if (!selectedPath) return;
    const name = selectedPath.split('/').filter(Boolean).at(-1) ?? 'Project';
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
  if (!window.confirm(`Remove “${project.name}” from ADE? Its files will stay on disk.`)) return;
  setSyncState('stale', `Removing ${project.name}…`);
  void sendContextRequest('project.remove', { projectId: project.id }, 'remove-project').catch((error) => {
    notify(error instanceof Error ? error.message : 'Unable to remove project.');
  });
}

function renderChanges(tasks) {
  const task = tasks.find((item) => item.id === selectedTaskId) ?? tasks.find((item) => ['UNDER_REVIEW', 'READY_FOR_HUMAN'].includes(item.status)) ?? tasks[0];
  selectedTaskId = task?.id ?? null;
  selectedTaskIntent = task?.intent ?? '';
  const values = {
    'changes-task-id': task?.id ?? '—',
    'changes-task-title': task?.intent ?? 'No Task selected',
    'changes-task-detail': task ? `Current persisted state: ${task.status.replaceAll('_', ' ')}.` : 'Create a Task from Work to populate the review queue.',
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
  });
  document.querySelectorAll('[data-version-control-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.versionControlPanel !== activeTab;
  });
}

function renderGitHistory(commits) {
  const list = document.getElementById('git-commit-list');
  const status = document.getElementById('git-history-status');
  if (!list) return;
  gitHistoryCommits = Array.isArray(commits) ? commits : [];
  if (!gitHistoryCommits.length) {
    list.innerHTML = '<div class="git-empty-state">No commits found.</div>';
    if (status) status.textContent = 'No commits';
    selectedGitCommit = null;
    renderGitCommitDetail(null);
    return;
  }
  list.innerHTML = gitHistoryCommits.map((commit) => `<button class="git-commit-item${commit.hash === selectedGitCommit?.hash ? ' active' : ''}" type="button" data-git-commit="${escapeHTML(commit.hash)}"><span class="git-commit-subject">${escapeHTML(commit.subject)}</span><span class="git-commit-item-meta"><code>${escapeHTML(commit.shortHash)}</code><span>${escapeHTML(commit.author)}</span><time>${escapeHTML(formatGitDate(commit.date))}</time></span></button>`).join('');
  if (status) status.textContent = `${gitHistoryCommits.length} recent commit${gitHistoryCommits.length === 1 ? '' : 's'}`;
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
    if (output) output.textContent = 'Select a commit to inspect its diff.';
    return;
  }
  if (hash) hash.textContent = commit.shortHash;
  if (title) title.textContent = commit.subject;
  if (meta) meta.textContent = `${commit.author} · ${formatGitDate(commit.date)} · ${commit.hash}`;
  if (count) count.textContent = `${commit.files.length} file${commit.files.length === 1 ? '' : 's'}`;
  if (files) files.innerHTML = commit.files.length
    ? commit.files.map((file) => `<button class="git-commit-file" type="button" data-git-commit-file="${escapeHTML(file.path)}" title="Show diff for ${escapeHTML(file.path)}"><span class="git-file-status">${escapeHTML(file.status)}</span><code>${escapeHTML(file.path)}</code></button>`).join('')
    : '<div class="git-empty-state">No file changes recorded.</div>';
  if (output && diff !== null) output.textContent = diff || 'No textual diff for this commit.';
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
  const pendingFiles = result?.files ?? [];
  if (status) status.textContent = pendingFiles.length ? `${pendingFiles.length} pending file${pendingFiles.length === 1 ? '' : 's'}` : 'Working tree clean';
  if (files) files.innerHTML = pendingFiles.length
    ? pendingFiles.map((file) => `<div class="git-pending-file"><span class="git-file-status">${escapeHTML(file.status)}</span><code>${escapeHTML(file.path)}</code></div>`).join('')
    : '<div class="git-empty-state">No changes pending.</div>';
  if (diff) diff.textContent = result?.diff || 'No pending textual diff.';
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
  void sendContextRequest('git.pending', { repositoryPath: path }, 'git-pending').catch((error) => notify(error instanceof Error ? error.message : 'Unable to load pending changes.'));
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

function documentRelativePath(filePath) {
  return filePath.startsWith(`${workspaceRootPath}/`) ? filePath.slice(workspaceRootPath.length + 1) : filePath;
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

function updateDocumentEditState() {
  const editor = document.getElementById('document-content');
  const saveButton = document.getElementById('save-file');
  const discardButton = document.getElementById('discard-file');
  const kindElement = document.getElementById('document-kind');
  const editable = Boolean(activeDocument?.kind === 'text' && editor && !editor.hidden);
  documentDirty = editable && editor.value !== documentOriginalContent;
  if (saveButton) saveButton.disabled = !documentDirty;
  if (discardButton) discardButton.disabled = !documentDirty;
  if (kindElement && activeDocument?.kind === 'text') kindElement.textContent = documentDirty ? 'TEXT · UNSAVED' : 'TEXT';
}

function renderDocumentLoading(filePath) {
  const viewer = document.getElementById('document-viewer');
  const status = document.getElementById('document-viewer-status');
  const content = document.getElementById('document-content');
  if (!viewer || !status || !content) return;
  viewer.hidden = false;
  document.getElementById('editor-empty-state')?.setAttribute('hidden', '');
  setDocumentHeader({ title: filePath.split('/').at(-1) ?? 'File', path: documentRelativePath(filePath), kind: 'LOADING' });
  status.hidden = false;
  status.textContent = 'Reading file…';
  content.hidden = true;
  content.value = '';
  documentOriginalContent = '';
  documentDirty = false;
  updateDocumentEditState();
}

function renderDocumentResult(result) {
  const viewer = document.getElementById('document-viewer');
  const status = document.getElementById('document-viewer-status');
  const content = document.getElementById('document-content');
  if (!viewer || !status || !content) return;
  viewer.hidden = false;
  document.getElementById('editor-empty-state')?.setAttribute('hidden', '');
  activeDocument = result;
  setDocumentHeader({ title: result.name, path: result.relativePath, kind: result.kind === 'text' ? 'TEXT' : result.kind.toUpperCase(), externalDisabled: false });
  const isText = result.kind === 'text';
  status.hidden = isText;
  status.textContent = isText ? '' : (result.message ?? 'This file cannot be previewed inside ADE.');
  content.hidden = !isText;
  content.value = isText ? (result.content ?? '') : '';
  documentOriginalContent = isText ? (result.content ?? '') : '';
  documentDirty = false;
  updateDocumentEditState();
  if (isText) content.focus({ preventScroll: true });
}

function renderDocumentError(filePath, error) {
  const viewer = document.getElementById('document-viewer');
  const status = document.getElementById('document-viewer-status');
  const content = document.getElementById('document-content');
  if (!viewer || !status || !content) return;
  viewer.hidden = false;
  document.getElementById('editor-empty-state')?.setAttribute('hidden', '');
  activeDocument = { path: filePath };
  setDocumentHeader({ title: filePath.split('/').at(-1) ?? 'File', path: documentRelativePath(filePath), kind: 'FAILED', externalDisabled: false });
  status.hidden = false;
  status.textContent = `Unable to read file: ${String(error)}`;
  content.hidden = true;
  content.value = '';
  documentOriginalContent = '';
  documentDirty = false;
  updateDocumentEditState();
}

async function openFileInADE(filePath) {
  if (!nativeInvoke) {
    notify('Opening files requires the local desktop runtime.');
    return;
  }
  showView('editor');
  updateWorkspaceFileSelection(filePath);
  renderDocumentLoading(filePath);
  try {
    const result = await nativeInvoke('read_file', { path: filePath });
    renderDocumentResult(result);
  } catch (error) {
    renderDocumentError(filePath, error);
    notify('Unable to read file inside ADE.');
    console.warn('File preview unavailable:', error);
  }
}

function closeFilePreview() {
  if (documentDirty && !window.confirm('Discard unsaved changes to this file?')) return;
  const viewer = document.getElementById('document-viewer');
  if (viewer) viewer.hidden = true;
  document.getElementById('editor-empty-state')?.removeAttribute('hidden');
  activeDocument = null;
  documentOriginalContent = '';
  documentDirty = false;
  updateDocumentEditState();
}

async function saveActiveDocument() {
  const editor = document.getElementById('document-content');
  if (!nativeInvoke || !editor || activeDocument?.kind !== 'text' || !activeDocument.path) return;
  try {
    await nativeInvoke('write_file', { path: activeDocument.path, content: editor.value });
    documentOriginalContent = editor.value;
    activeDocument = { ...activeDocument, content: editor.value, size: new TextEncoder().encode(editor.value).length };
    updateDocumentEditState();
    notify('File saved in ADE.');
  } catch (error) {
    notify('Unable to save file.');
    console.warn('File save unavailable:', error);
  }
}

function discardDocumentChanges() {
  const editor = document.getElementById('document-content');
  if (!editor || !documentDirty) return;
  editor.value = documentOriginalContent;
  updateDocumentEditState();
  notify('Unsaved changes discarded.');
}

function providerIsAvailable(providerId) {
  const provider = providerStatuses.find((item) => item.id === providerId);
  return !provider || provider.available;
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
}

function refreshSelectedSkill() {
  const select = document.getElementById('agent-skill');
  const option = select?.selectedOptions?.[0];
  const update = document.getElementById('update-skill-button');
  const detail = document.getElementById('agent-skill-status');
  const projectSkill = option?.dataset.source === 'project';
  const installedFrom = option?.dataset.installedFrom;
  if (update) update.disabled = !projectSkill || !installedFrom;
  if (detail) detail.textContent = projectSkill
    ? (installedFrom ? `Project skill · source: ${installedFrom}` : 'Project skill without a recorded source; update is unavailable.')
    : 'Native ADE skill · versioned with the application.';
}

function renderSkills(skills) {
  const detail = document.getElementById('native-skills-list');
  if (detail) detail.textContent = skills.map((skill) => skill.label).join(' · ');
  const select = document.getElementById('agent-skill');
  if (select) {
    const previous = select.value;
    select.innerHTML = skills.map((skill) => `<option value="${escapeHTML(skill.id)}" data-permissions="${escapeHTML(skill.permissions.join(','))}" data-source="${escapeHTML(skill.source)}"${skill.installedFrom ? ` data-installed-from="${escapeHTML(skill.installedFrom)}"` : ''}>${escapeHTML(skill.label)}${skill.source === 'project' ? ' · Project' : ''}</option>`).join('');
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  refreshSelectedSkill();
}

function renderProjectTasks(tasks) {
  const lists = [...document.querySelectorAll('#project-task-list, #work-task-list')];
  if (lists.length === 0 || tasks.length === 0) return;
  const cards = tasks.map((task, index) => {
    const status = escapeHTML(task.status.replaceAll('_', ' '));
    const tone = ['UNDER_REVIEW', 'READY_FOR_HUMAN', 'BLOCKED'].includes(task.status) ? 'review' : 'building';
    const phase = task.status === 'UNDER_REVIEW' ? 'Reviewer active' : task.status === 'READY_FOR_HUMAN' ? 'Awaiting approval' : 'Task state confirmed';
    const transitions = { DRAFT: ['READY', 'Mark ready'], READY: ['RUN', 'Start task'], CHANGES_REQUESTED: ['RUN', 'Resume task'], BLOCKED: ['RUN', 'Re-enter task'] };
    const action = transitions[task.status];
    const actionMarkup = action ? action[0] === 'RUN'
      ? `<button class="task-action" data-task-id="${escapeHTML(task.id)}" data-task-run="true">${action[1]}</button>`
      : `<button class="task-action" data-task-id="${escapeHTML(task.id)}" data-task-next="${action[0]}">${action[1]}</button>` : '';
    return `<article class="task-card${task.id === selectedTaskId || (!selectedTaskId && index === 0) ? ' selected-task' : ''}" data-task-select="${escapeHTML(task.id)}"><div class="task-top"><span class="task-id">${escapeHTML(task.id)}</span><span class="task-status ${tone}">${status}</span></div><h3>${escapeHTML(task.intent)}</h3><p>Project Task · state from ADE metadata</p><div class="task-bottom"><span class="phase"><span class="phase-dot${tone === 'building' ? ' blue' : ''}"></span>${phase}</span><span class="task-time">${escapeHTML(task.updatedAt ? new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}</span><span class="task-arrow">→</span></div>${actionMarkup}</article>`;
  }).join('');
  lists.forEach((list) => { list.innerHTML = cards; });
}

function renderTaskDetail(detail) {
  const panel = document.getElementById('task-detail-panel');
  if (!panel) return;
  const task = detail.task;
  selectedTaskId = task.id;
  selectedTaskIntent = task.intent;
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
  panel.innerHTML = `<p class="eyebrow">TASK DETAIL</p><div class="task-detail-heading"><div><span class="task-id">${escapeHTML(task.id)}</span><h2>${escapeHTML(task.intent)}</h2></div><span class="task-status building">${escapeHTML(task.status.replaceAll('_', ' '))}</span></div><p>${task.history.length} history events · ${detail.changeSets.length} ChangeSets · ${detail.reviews.length} Reviews · ${detail.runtimeEvidence.length} runtime events</p><p><strong>ChangeSet:</strong> ${escapeHTML(changeset)}</p><p><strong>Gates:</strong> ${escapeHTML(gates)}</p><h3 class="task-trace-heading">Git trace</h3>${operations}<h3 class="task-trace-heading">Agent sessions</h3>${sessions}<h3 class="task-trace-heading">Persisted activity</h3>${evidence}`;
}

function runSkillFromUI(sessionId) {
  if (!nativeInvoke) { notify('Skill execution requires the sidecar.'); return; }
  const select = document.getElementById('agent-skill');
  const skillId = select?.value;
  const providerSelect = document.getElementById('agent-provider');
  selectedProvider = providerSelect?.value ?? 'opencode';
  const feedback = document.getElementById('agent-feedback');
  if (!skillId) { notify('No native skill selected.'); return; }
  if (!providerIsAvailable(selectedProvider)) {
    if (feedback) feedback.textContent = `${selectedProvider} is unavailable. Check the provider connection before running a skill.`;
    notify('Selected provider is unavailable.');
    return;
  }
  const declared = (select?.selectedOptions?.[0]?.dataset.permissions ?? '').split(',').filter(Boolean);
  const explicit = declared.filter((permission) => !['read_project', 'write_docs'].includes(permission));
  if (explicit.length && !window.confirm(`${skillId} requests: ${explicit.join(', ')}. Allow for this run?`)) {
    if (feedback) feedback.textContent = `${skillId} cancelled: permission not granted.`;
    return;
  }
  const taskId = selectedTaskId;
  if (feedback) feedback.textContent = `${sessionId ? 'Resuming' : 'Starting'} ${skillId} with ${selectedProvider}…`;
  nativeInvoke('sidecar_request', {
    request: JSON.stringify({
      id: `skill-run-${Date.now()}`,
      method: 'skills.run',
      params: {
        skillId,
        provider: selectedProvider,
        intent: selectedTaskIntent || document.getElementById('task-intent')?.value || 'Inspect the active Project and propose the next useful action.',
        repositoryPath: document.getElementById('project-path')?.textContent,
        grantedPermissions: explicit,
        ...(sessionId ? { sessionId } : {}),
        ...(taskId && taskId !== '—' ? { taskId } : {}),
      },
    }),
  }).catch((error) => { if (feedback) feedback.textContent = `Skill failed: ${error}`; notify('Skill execution failed.'); });
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
  const pathSegments = relativePath.split('/').filter(Boolean);
  const parentPath = pathSegments.slice(0, -1).join(' / ') || 'Project root';
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
  if (!filePath || !filePath.startsWith(`${workspaceRootPath}/`)) return renderWorkspaceEntries(rootEntries);
  const segments = filePath.slice(workspaceRootPath.length + 1).split('/').filter(Boolean);
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
  const sidebar = document.querySelector('.sidebar');
  const primaryNav = document.querySelector('.primary-nav');
  const toggle = document.querySelector('[data-action="toggle-explorer"]');
  sidebar?.classList.toggle('explorer-expanded', expanded);
  primaryNav?.setAttribute('aria-hidden', String(expanded));
  toggle?.setAttribute('aria-expanded', String(expanded));
  toggle?.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} workspace tree`);
  toggle?.setAttribute('title', `${expanded ? 'Collapse' : 'Expand'} workspace tree`);
  toggle?.querySelector('svg')?.style.setProperty('transform', expanded ? 'rotate(90deg)' : 'none');
}

async function expandExplorerFrom(button) {
  updateExplorerMode(true);
  await loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true });
  const targetPath = button.dataset.directoryPath;
  if (!targetPath?.startsWith(`${workspaceRootPath}/`)) return;
  const segments = targetPath.slice(workspaceRootPath.length + 1).split('/').filter(Boolean);
  let currentPath = workspaceRootPath;
  for (const segment of segments) {
    currentPath = `${currentPath}/${segment}`;
    const matchingButton = [...document.querySelectorAll('[data-directory-path].directory')]
      .find((candidate) => candidate.dataset.directoryPath === currentPath);
    if (!matchingButton) break;
    if (matchingButton.getAttribute('aria-expanded') !== 'true') await toggleWorkspaceDirectory(matchingButton);
  }
}

async function revealSelectedFileBranch() {
  if (!explorerExpanded || !selectedFilePath?.startsWith(`${workspaceRootPath}/`)) return;
  const segments = selectedFilePath.slice(workspaceRootPath.length + 1).split('/').filter(Boolean);
  let currentPath = workspaceRootPath;
  for (const segment of segments.slice(0, -1)) {
    currentPath = `${currentPath}/${segment}`;
    const directoryButton = [...document.querySelectorAll('[data-directory-path].directory')]
      .find((candidate) => candidate.dataset.directoryPath === currentPath);
    if (!directoryButton) return;
    if (directoryButton.getAttribute('aria-expanded') !== 'true') await toggleWorkspaceDirectory(directoryButton);
  }
  updateWorkspaceFileSelection(selectedFilePath);
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
    await invoke('sidecar_request', { request: JSON.stringify({ id: `skills-${Date.now()}`, method: 'skills.list', params: { repositoryPath: activeProject.repositoryPath } }) });
    await invoke('sidecar_request', { request: JSON.stringify({ id: `providers-${Date.now()}`, method: 'providers.inspect' }) });
    await invoke('sidecar_request', { request: JSON.stringify({ id: `services-${Date.now()}`, method: 'service.list', params: { repositoryPath: activeProject.repositoryPath } }) });
  };
  try {
    await listen('sidecar:response', async (event) => {
      const response = JSON.parse(event.payload);
      const contextPurpose = pendingContextRequests.get(String(response.id));
      if (contextPurpose) pendingContextRequests.delete(String(response.id));
      const snapshotProjectId = pendingSnapshotProjects.get(String(response.id));
      if (snapshotProjectId) {
        pendingSnapshotProjects.delete(String(response.id));
        if (snapshotProjectId !== activeProjectId) return;
      }
      if (response.error) {
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
        const feedback = document.getElementById('agent-feedback');
        if (feedback) feedback.textContent = `${response.error.code}: ${response.error.message}`;
        notify(response.error.message);
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
          notify('Project removed from ADE. Files were kept on disk.');
        }
        return;
      }
      if (contextPurpose === 'branches' && response.result?.branches) {
        gitBranches = response.result.branches;
        renderBranchMenu();
        return;
      }
      if (contextPurpose === 'git-history' && Array.isArray(response.result)) {
        renderGitHistory(response.result);
        const first = response.result.find((commit) => commit.hash === selectedGitCommit?.hash) ?? response.result[0];
        if (first) selectGitCommit(first.hash);
        return;
      }
      if (contextPurpose === 'git-pending' && response.result?.files) {
        renderPendingGitChanges(response.result);
        return;
      }
      if (contextPurpose === 'git-diff' && response.result?.commit && selectedGitCommit?.hash === response.result.commit) {
        renderGitCommitDetail(selectedGitCommit, response.result.diff);
        return;
      }
      if (contextPurpose === 'git-fetch') {
        setSyncState('ready', 'Fetched just now');
        notify('Fetched origin.');
        requestVersionControlData(workspaceRootPath);
        return;
      }
      if (contextPurpose === 'git-commit-push') {
        setSyncState('ready', 'Synced just now');
        notify('Commit created and pushed.');
        const title = document.getElementById('commit-title');
        const body = document.getElementById('commit-body');
        if (title) title.value = '';
        if (body) body.value = '';
        requestVersionControlData(workspaceRootPath);
        return;
      }
      if (contextPurpose === 'switch-branch' && response.result?.operation === 'branch.switch') {
        const path = document.getElementById('project-path')?.textContent;
        if (path) await refreshGitWorkspace(path, nativeInvoke);
        setSyncState('ready', 'Synced just now');
        notify(`Branch switched to ${response.result.branch}.`);
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
      if (Array.isArray(response.result) && response.result[0]?.permissions) {
        renderSkills(response.result);
        notify(`${response.result.length} native skills available.`);
        return;
      }
      if (response.result?.skillId && response.result?.sessionId) {
        const feedback = document.getElementById('agent-feedback');
        if (feedback) feedback.textContent = `${response.result.skillId} completed in ${response.result.sessionId} (${selectedProvider}).`;
        return;
      }
      if (response.result?.id && response.result?.source && response.result?.permissions) {
        const feedback = document.getElementById('agent-feedback');
        if (feedback) feedback.textContent = `${response.result.label} ${response.result.updated ? 'updated from its recorded source' : 'installed in this Project'}.`;
        nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `skills-${Date.now()}`, method: 'skills.list', params: { repositoryPath: document.getElementById('project-path')?.textContent } }) });
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
      if (response.result) {
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
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  panels.forEach((panel) => panel.classList.toggle('active-view', panel.dataset.panel === view));
  const labels = { projects: 'Projects', editor: 'Editor', work: 'Tasks', knowledge: 'Project context', changes: 'Version control', runtime: 'Local runtime' };
  const crumb = document.getElementById('breadcrumb-current');
  if (crumb) crumb.textContent = labels[view] ?? view;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

navItems.forEach((item) => item.addEventListener('click', () => showView(item.dataset.view)));
renderSnapshot(projectSnapshot);
renderRuntimeStatus({ sidecar: 'STARTING', agentRuntime: 'DISCONNECTED', activeTaskId: null, lastEventAt: null, lastError: null });
refreshProjectContext(projectSnapshot);
connectSidecar(projectSnapshot);
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
  if (item.dataset.action === 'show-notifications') {
    notify('No new notifications.');
    return;
  }
  if (item.dataset.action === 'show-help') {
    notify('Use the activity bar, ⌘K search and the terminal dock to navigate ADE.');
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
  if (item.dataset.action === 'toggle-explorer') {
    if (explorerExpanded) void collapseExplorer();
    else void expandExplorer();
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
    if (!window.confirm('Fetch origin for the active Project?')) return;
    setSyncState('stale', 'Fetching origin…');
    void sendContextRequest('git.fetch.origin', { repositoryPath: workspaceRootPath, actor: 'human', reason: 'Fetch requested from Version control', confirmed: true }, 'git-fetch').catch((error) => notify(error instanceof Error ? error.message : 'Fetch failed.'));
    return;
  }
  if (item.dataset.action === 'commit-push') return;
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
  if (item.dataset.action === 'discard-file') {
    discardDocumentChanges();
    return;
  }
  if (item.dataset.action === 'close-file') {
    closeFilePreview();
    return;
  }
  if (item.dataset.action === 'create-worktree') {
    if (!nativeInvoke) { notify('Git operations require the sidecar.'); return; }
    const taskSuffix = selectedTaskId ? selectedTaskId.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'ade-next';
    const branch = window.prompt('Branch for the new worktree:', `feature/${taskSuffix}`)?.trim();
    if (!branch) return;
    const path = window.prompt('Absolute path for the new worktree:', `${document.getElementById('project-path')?.textContent}-worktree-${taskSuffix}`)?.trim();
    if (!path) return;
    if (!window.confirm(`Create worktree ${path} on ${branch}?`)) return;
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `git-worktree-${Date.now()}`, method: 'git.worktree.create', params: { ...(selectedTaskId ? { taskId: selectedTaskId } : {}), repositoryPath: document.getElementById('project-path')?.textContent, branch, worktreePath: path, actor: 'human', reason: 'Confirmed in ADE Git workspace', confirmed: true } }) }).catch((error) => { notify('Worktree creation failed.'); console.warn(error); });
    return;
  }
  if (['create-branch', 'create-commit', 'push-branch', 'create-pr'].includes(item.dataset.action)) {
    if (!nativeInvoke) { notify('Git operations require the sidecar.'); return; }
    const taskSuffix = selectedTaskId ? selectedTaskId.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'ade-next';
    const labels = { 'create-branch': ['git.branch.create', `feature/${taskSuffix}`], 'create-commit': ['git.commit.create', selectedTaskId ? `chore: record ${selectedTaskId}` : 'chore: record ADE changes'], 'push-branch': ['git.push', ''], 'create-pr': [gitWorkflow === 'direct' ? 'git.push' : 'github.pr.create', gitWorkflow === 'direct' ? '' : selectedTaskIntent || 'ADE change'] };
    const [method, intent] = labels[item.dataset.action];
    if (!window.confirm(`Confirm ${method}: ${intent}?`)) return;
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `${method}-${Date.now()}`, method, params: { ...(selectedTaskId ? { taskId: selectedTaskId } : {}), repositoryPath: document.getElementById('project-path')?.textContent, intent, actor: 'human', reason: `Confirmed in ADE Git workspace`, confirmed: true } }) }).then(() => {
      notify(`${method} completed.`);
      const taskId = selectedTaskId;
      if (taskId) nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `git-ops-${Date.now()}`, method: 'task.git.operations', params: { taskId } }) });
    }).catch((error) => { notify('Git operation failed.'); console.warn(error); });
    return;
  }
  if (item.dataset.action === 'run-skill') {
    runSkillFromUI();
    return;
  }
  if (item.dataset.action === 'install-skill') {
    if (!nativeInvoke) { notify('Skill installation requires the sidecar.'); return; }
    const source = document.getElementById('skill-source')?.value.trim();
    const remote = /^(https?:\/\/|git@)/.test(source ?? '') || /^[\w.-]+\/[\w.-]+$/.test(source ?? '');
    if (!source) { notify('Enter a local skill.json path or GitHub repository.'); return; }
    if (remote && !window.confirm(`Install ${source} from the network into this Project?`)) return;
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `skill-install-${Date.now()}`, method: 'skills.install', params: { repositoryPath: document.getElementById('project-path')?.textContent, intent: source, confirmed: remote } }) }).catch((error) => { notify('Skill installation failed.'); console.warn(error); });
    return;
  }
  if (item.dataset.action === 'update-skill') {
    if (!nativeInvoke) { notify('Skill update requires the sidecar.'); return; }
    const select = document.getElementById('agent-skill');
    const option = select?.selectedOptions?.[0];
    const source = option?.dataset.installedFrom;
    if (!option || option.dataset.source !== 'project' || !source) { notify('Select a Project skill with a recorded source.'); return; }
    const remote = /^(https?:\/\/|git@)/.test(source) || /^[\w.-]+\/[\w.-]+$/.test(source);
    if (remote && !window.confirm(`Update ${option.value} from ${source}?`)) return;
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `skill-update-${Date.now()}`, method: 'skills.update', params: { repositoryPath: document.getElementById('project-path')?.textContent, skillId: option.value, confirmed: remote } }) }).catch((error) => { notify('Skill update failed.'); console.warn(error); });
    return;
  }
  if (item.dataset.action === 'github-status') {
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `github-${Date.now()}`, method: 'github.status' }) });
    return;
  }
  if (item.dataset.action === 'inspect-providers') {
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `providers-${Date.now()}`, method: 'providers.inspect' }) });
    return;
  }
  if (item.dataset.action === 'list-skills') {
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `skills-${Date.now()}`, method: 'skills.list', params: { repositoryPath: document.getElementById('project-path')?.textContent } }) });
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
document.getElementById('branch-context-button')?.addEventListener('click', () => toggleGitContextMenu('branch'));
document.getElementById('git-commit-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!nativeInvoke || activeVersionControl === 'none') { notify('Commit requires a Git Project.'); return; }
  const title = document.getElementById('commit-title')?.value.trim();
  const body = document.getElementById('commit-body')?.value.trim() ?? '';
  const pendingStatus = document.getElementById('git-pending-status')?.textContent ?? '';
  if (!title) { notify('Enter a commit title.'); return; }
  if (pendingStatus === 'Working tree clean' || pendingStatus.startsWith('This Project')) { notify('There are no pending changes to commit.'); return; }
  if (!window.confirm(`Commit and push “${title}”?`)) return;
  setSyncState('stale', 'Committing and pushing…');
  void sendContextRequest('git.commit.push', { repositoryPath: workspaceRootPath, intent: title, ...(body ? { body } : {}), reason: 'Commit requested from Version control', actor: 'human', confirmed: true }, 'git-commit-push').catch((error) => notify(error instanceof Error ? error.message : 'Commit and push failed.'));
});
document.addEventListener('click', (event) => {
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
  const serviceButton = event.target.closest('[data-service-action][data-service-id]');
  if (serviceButton) {
    if (!nativeInvoke) { notify('Local services require the sidecar.'); return; }
    const method = serviceButton.dataset.serviceAction === 'start' ? 'service.start' : 'service.stop';
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `${method}-${Date.now()}`, method, params: { serviceId: serviceButton.dataset.serviceId, repositoryPath: document.getElementById('project-path')?.textContent } }) }).catch((error) => { notify('Local service action failed.'); console.warn(error); });
    return;
  }
  const resumeButton = event.target.closest('[data-resume-session]');
  if (resumeButton) {
    const provider = resumeButton.dataset.sessionProvider;
    const providerSelect = document.getElementById('agent-provider');
    if (providerSelect && provider) providerSelect.value = provider;
    runSkillFromUI(resumeButton.dataset.resumeSession);
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
  const taskCard = event.target.closest('[data-task-select]');
  if (taskCard && !event.target.closest('button')) {
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `detail-${taskCard.dataset.taskSelect}-${Date.now()}`, method: 'task.detail', params: { taskId: taskCard.dataset.taskSelect } }) });
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `git-ops-${taskCard.dataset.taskSelect}-${Date.now()}`, method: 'task.git.operations', params: { taskId: taskCard.dataset.taskSelect } }) });
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `review-${taskCard.dataset.taskSelect}-${Date.now()}`, method: 'change.review', params: { taskId: taskCard.dataset.taskSelect } }) });
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
document.getElementById('agent-provider')?.addEventListener('change', (event) => {
  selectedProvider = event.target.value;
  renderProviderSelection();
});
document.getElementById('document-content')?.addEventListener('input', updateDocumentEditState);
document.getElementById('document-content')?.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    void saveActiveDocument();
  }
});
document.getElementById('agent-skill')?.addEventListener('change', refreshSelectedSkill);
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
