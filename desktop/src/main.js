import { projectSnapshot } from './project-snapshot.js';
import { TerminalEmulator } from './terminal-emulator.js';

const navItems = [...document.querySelectorAll('.nav-item[data-view]')];
const panels = [...document.querySelectorAll('.view')];
const toast = document.querySelector('.toast');
const taskDialog = document.getElementById('new-task-dialog');
const taskForm = document.getElementById('new-task-form');
const taskIntent = document.getElementById('task-intent');
const themeMeta = document.querySelector('meta[name="theme-color"]');
let nativeInvoke;
let terminalStarted = false;
const terminalHistory = [];
let terminalEmulator;
let terminalHistoryIndex = -1;
let terminalHistoryDraft = '';
let terminalCompletionCwd = projectSnapshot.project.repositoryPath;
let terminalSuggestionCandidates = [];
let terminalSuggestionContext = null;
let selectedProvider = 'opencode';
let activeProjectId = projectSnapshot.project.id;
let workspaceRootPath = projectSnapshot.project.repositoryPath;
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
let sidebarWidth = 246;
let sidebarResizeState = null;
let activeServiceId = null;
let gitWorkflow = 'pull-request';
let selectedTaskId = null;
let selectedTaskIntent = '';
let providerStatuses = [];
const runtimeEvents = [];

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
  if (persist) {
    try { localStorage.setItem(terminalStorageKey, String(terminalHeight)); } catch { /* Persistence is optional. */ }
  }
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

function appendTerminalTranscript(text) {
  const output = document.getElementById('terminal-output');
  if (!output) return;
  if (!terminalEmulator) {
    output.textContent += text;
    output.scrollTop = output.scrollHeight;
    return;
  }
  terminalEmulator.write(text);
}

terminalEmulator = new TerminalEmulator({
  onChange(text) {
    const output = document.getElementById('terminal-output');
    if (!output) return;
    output.textContent = text;
    output.scrollTop = output.scrollHeight;
  },
});

function escapeTerminalSuggestion(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function hideTerminalSuggestions() {
  const suggestions = document.getElementById('terminal-suggestions');
  terminalSuggestionCandidates = [];
  terminalSuggestionContext = null;
  if (suggestions) { suggestions.hidden = true; suggestions.innerHTML = ''; }
}

function renderTerminalSuggestions(input) {
  const suggestions = document.getElementById('terminal-suggestions');
  if (!suggestions || !terminalSuggestionContext || !terminalSuggestionCandidates.length) return;
  suggestions.innerHTML = terminalSuggestionCandidates.map((candidate, index) => `<button class="terminal-suggestion${index === 0 ? ' selected' : ''}" type="button" role="option" aria-selected="${index === 0}" data-terminal-suggestion="${escapeTerminalSuggestion(candidate)}">${escapeTerminalSuggestion(candidate)}</button>`).join('');
  suggestions.hidden = false;
  suggestions.querySelectorAll('[data-terminal-suggestion]').forEach((button) => button.addEventListener('click', () => {
    input.value = `${terminalSuggestionContext.before}${button.dataset.terminalSuggestion}`;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    hideTerminalSuggestions();
  }));
}

function updateTerminalSuggestionSelection(input, direction) {
  if (!terminalSuggestionCandidates.length || !terminalSuggestionContext) return false;
  const current = Number(input.dataset.terminalSuggestionIndex ?? -1);
  const next = current === -1
    ? (direction > 0 ? 0 : terminalSuggestionCandidates.length - 1)
    : (current + direction + terminalSuggestionCandidates.length) % terminalSuggestionCandidates.length;
  input.dataset.terminalSuggestionIndex = String(next);
  input.value = `${terminalSuggestionContext.before}${terminalSuggestionCandidates[next]}`;
  document.querySelectorAll('[data-terminal-suggestion]').forEach((button, index) => {
    const selected = index === next;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  input.setSelectionRange(input.value.length, input.value.length);
  return true;
}

function terminalCompletionContext(value) {
  const match = value.match(/^(\s*cd\s+)(.*)$/);
  if (!match) return null;
  const rawPath = match[2];
  const slashIndex = rawPath.lastIndexOf('/');
  const directoryPrefix = slashIndex >= 0 ? rawPath.slice(0, slashIndex + 1) : '';
  const token = slashIndex >= 0 ? rawPath.slice(slashIndex + 1) : rawPath;
  const lookupPath = resolveTerminalCompletionPath(directoryPrefix.replace(/\/$/, ''));
  return { before: `${match[1]}${directoryPrefix}`, lookupPath, token };
}

function resolveTerminalCompletionPath(relativePath) {
  const base = relativePath.startsWith('/') ? relativePath : `${terminalCompletionCwd}/${relativePath}`;
  const parts = [];
  base.split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') { parts.pop(); return; }
    parts.push(part);
  });
  return `/${parts.join('/')}`;
}

async function completeTerminalInput(input) {
  const context = terminalCompletionContext(input.value);
  if (!context || !nativeInvoke) { hideTerminalSuggestions(); return; }
  try {
    const entries = await nativeInvoke('list_directory', { path: context.lookupPath, maxDepth: 0 });
    const candidates = entries.filter((entry) => entry.kind === 'directory' && entry.name.toLowerCase().startsWith(context.token.toLowerCase())).map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
    if (!candidates.length) { hideTerminalSuggestions(); return; }
    terminalSuggestionCandidates = candidates;
    terminalSuggestionContext = context;
    input.dataset.terminalSuggestionIndex = '-1';
    if (candidates.length === 1) {
      input.value = `${context.before}${candidates[0]}`;
      input.setSelectionRange(input.value.length, input.value.length);
      hideTerminalSuggestions();
      return;
    }
    renderTerminalSuggestions(input);
  } catch (error) {
    hideTerminalSuggestions();
    console.warn('Terminal completion unavailable:', error);
  }
}

function updateTerminalCompletionCwd(command) {
  const match = command.match(/^cd(?:\s+(.+))?$/);
  if (!match) return;
  const target = match[1]?.trim();
  terminalCompletionCwd = target ? resolveTerminalCompletionPath(target) : workspaceRootPath;
}

try {
  const storedTerminalHeight = Number(localStorage.getItem(terminalStorageKey));
  if (Number.isFinite(storedTerminalHeight)) terminalHeight = storedTerminalHeight;
} catch { /* Persistence is optional. */ }
setTerminalHeight(terminalHeight, false);
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
  const values = {
    'project-name': snapshot.project.name,
    'project-description': snapshot.project.description ?? 'Local ADE project',
    'project-path': snapshot.project.repositoryPath,
    'project-branch': snapshot.project.branch,
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
  if (statusBranch) statusBranch.textContent = snapshot.project.branch;
  const terminalCwd = document.getElementById('terminal-cwd');
  if (terminalCwd) terminalCwd.textContent = snapshot.project.repositoryPath;
  renderChanges(snapshot.tasks ?? []);
  renderProjectTasks(snapshot.tasks ?? []);
  if (snapshot.sync) setSyncState(snapshot.sync.state, snapshot.sync.label);
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
    const context = await invoke('project_context', { repositoryPath: snapshot.project.repositoryPath });
    renderSnapshot({ ...snapshot, project: { ...snapshot.project, ...context } });
    window.clearTimeout(workspaceSearchTimer);
    workspaceSearchToken += 1;
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
  if (!invoke || !path) return;
  try {
    const result = await invoke('sidecar_request', { request: JSON.stringify({ id: `git-workspace-${Date.now()}`, method: 'git.workspace', params: { repositoryPath: path } }) });
    await invoke('sidecar_request', { request: JSON.stringify({ id: `git-workflow-${Date.now()}`, method: 'git.workflow', params: { repositoryPath: path } }) });
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
  updateExplorerMode(false);
  await loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true });
}

async function connectSidecar(snapshot) {
  const invoke = window.__TAURI__?.core?.invoke;
  const listen = window.__TAURI__?.event?.listen;
  if (!invoke || !listen) return;
  nativeInvoke = invoke;
  await listen('terminal:output', (event) => {
    appendTerminalTranscript(event.payload);
  });
  let recoveryAttempted = false;
  const requestSnapshot = async () => {
    const configuredProjectId = await invoke('project_id');
    activeProjectId = configuredProjectId;
    await invoke('sidecar_request', {
      request: JSON.stringify({ id: `snapshot-${Date.now()}`, method: 'project.snapshot', params: { projectId: configuredProjectId } }),
    });
    await invoke('sidecar_request', {
      request: JSON.stringify({ id: `runtime-${Date.now()}`, method: 'runtime.status' }),
    });
    await invoke('sidecar_request', { request: JSON.stringify({ id: `skills-${Date.now()}`, method: 'skills.list', params: { repositoryPath: snapshot.project.repositoryPath } }) });
    await invoke('sidecar_request', { request: JSON.stringify({ id: `providers-${Date.now()}`, method: 'providers.inspect' }) });
    await invoke('sidecar_request', { request: JSON.stringify({ id: `services-${Date.now()}`, method: 'service.list', params: { repositoryPath: snapshot.project.repositoryPath } }) });
  };
  try {
    await listen('sidecar:response', async (event) => {
      const response = JSON.parse(event.payload);
      if (response.error) {
        const feedback = document.getElementById('agent-feedback');
        if (feedback) feedback.textContent = `${response.error.code}: ${response.error.message}`;
        notify(response.error.message);
        return;
      }
      if (response.type?.startsWith('runtime.') && response.status) {
        renderRuntimeStatus(response.status);
        if (response.type === 'runtime.event') renderRuntimeEvent(response.taskId, response.event);
        if (response.type === 'runtime.completed') notify(`Implementer completed ${response.taskId}.`);
        if (response.type === 'runtime.failed') notify(`Implementer failed: ${response.status.lastError}`);
        if (response.type !== 'runtime.event') {
          await nativeInvoke('sidecar_request', {
            request: JSON.stringify({ id: `refresh-${response.taskId}-${Date.now()}`, method: 'project.snapshot', params: { projectId: activeProjectId } }),
          });
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
        renderSnapshot({
          ...snapshot,
          ...response.result,
          project: { ...snapshot.project, ...response.result.project },
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
      params: { taskId, intent, projectId: activeProjectId, repositoryPath: projectSnapshot.project.repositoryPath },
    }),
  });
  notify(`Created ${taskId}.`);
  await nativeInvoke('sidecar_request', {
    request: JSON.stringify({ id: `refresh-${taskId}`, method: 'project.snapshot', params: { projectId: activeProjectId } }),
  });
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
    await nativeInvoke('sidecar_request', {
      request: JSON.stringify({ id: `refresh-${taskId}-${Date.now()}`, method: 'project.snapshot', params: { projectId: activeProjectId } }),
    });
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
    await nativeInvoke('sidecar_request', {
      request: JSON.stringify({ id: `recovery-${Date.now()}`, method: 'project.snapshot', params: { projectId: activeProjectId } }),
    });
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
  const labels = { project: 'Overview', work: 'Tasks', knowledge: 'Project context', changes: 'Review queue', runtime: 'Local runtime' };
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
    showView('project');
    document.querySelector('.terminal-dock')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    document.getElementById('terminal-command')?.focus();
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
      return nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `refresh-approve-${Date.now()}`, method: 'project.snapshot', params: { projectId: activeProjectId } }) });
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
document.getElementById('terminal-command')?.addEventListener('keydown', (event) => {
  const input = event.currentTarget;
  if (event.key === 'Tab') {
    event.preventDefault();
    void completeTerminalInput(input);
    return;
  }
  if (event.key === 'Escape') {
    hideTerminalSuggestions();
    return;
  }
  if (terminalSuggestionCandidates.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    updateTerminalSuggestionSelection(input, event.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (event.key === 'ArrowUp') {
    if (!terminalHistory.length) return;
    event.preventDefault();
    if (terminalHistoryIndex === -1) terminalHistoryDraft = input.value;
    terminalHistoryIndex = Math.min(terminalHistoryIndex + 1, terminalHistory.length - 1);
    input.value = terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex];
  }
  if (event.key === 'ArrowDown' && terminalHistoryIndex !== -1) {
    event.preventDefault();
    terminalHistoryIndex -= 1;
    input.value = terminalHistoryIndex === -1 ? terminalHistoryDraft : terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex];
  }
});
document.getElementById('terminal-command')?.addEventListener('input', (event) => {
  event.currentTarget.dataset.terminalSuggestionIndex = '-1';
  hideTerminalSuggestions();
});
document.getElementById('terminal-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('terminal-command');
  const command = input?.value.trim();
  const cwd = document.getElementById('project-path')?.textContent;
  if (!nativeInvoke || !command || !cwd) { notify('Native terminal requires the desktop runtime.'); return; }
  try {
    if (!terminalStarted) { await nativeInvoke('terminal_start', { cwd }); terminalStarted = true; }
    terminalHistory.push(command);
    updateTerminalCompletionCwd(command);
    hideTerminalSuggestions();
    terminalHistoryIndex = -1;
    terminalHistoryDraft = '';
    if (input) input.value = '';
    // Shells map CR to a line feed in canonical mode; TUIs in raw mode need
    // the actual Enter key code to submit prompts and actions.
    await nativeInvoke('terminal_input', { input: `${command}\r` });
  } catch (error) {
    appendTerminalTranscript(`\n[ADE] ${String(error)}\n`);
    notify('Terminal command failed.');
  }
});
window.addEventListener('beforeunload', () => {
  if (terminalStarted) nativeInvoke?.('terminal_stop').catch(() => {});
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
