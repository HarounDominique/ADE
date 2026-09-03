import { projectSnapshot } from './project-snapshot.js';

const navItems = [...document.querySelectorAll('.nav-item[data-view]')];
const panels = [...document.querySelectorAll('.view')];
const toast = document.querySelector('.toast');

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
  renderProjectTasks(snapshot.tasks ?? []);
  const syncLabel = document.querySelector('.sync-label');
  if (syncLabel) syncLabel.lastChild.textContent = ` ${snapshot.sync.label}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function renderProjectTasks(tasks) {
  const list = document.getElementById('project-task-list');
  if (!list || tasks.length === 0) return;
  list.innerHTML = tasks.map((task, index) => {
    const status = escapeHTML(task.status.replaceAll('_', ' '));
    const tone = ['UNDER_REVIEW', 'READY_FOR_HUMAN', 'BLOCKED'].includes(task.status) ? 'review' : 'building';
    const phase = task.status === 'UNDER_REVIEW' ? 'Reviewer active' : task.status === 'READY_FOR_HUMAN' ? 'Awaiting approval' : 'Task state confirmed';
    return `<article class="task-card${index === 0 ? ' selected-task' : ''}"><div class="task-top"><span class="task-id">${escapeHTML(task.id)}</span><span class="task-status ${tone}">${status}</span></div><h3>${escapeHTML(task.intent)}</h3><p>Project Task · state from ADE metadata</p><div class="task-bottom"><span class="phase"><span class="phase-dot${tone === 'building' ? ' blue' : ''}"></span>${phase}</span><span class="task-time">${escapeHTML(task.updatedAt ? new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}</span><span class="task-arrow">→</span></div></article>`;
  }).join('');
}

async function refreshProjectContext(snapshot) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return;
  try {
    const context = await invoke('project_context', { repositoryPath: snapshot.project.repositoryPath });
    renderSnapshot({ ...snapshot, project: { ...snapshot.project, ...context } });
    notify('Project context loaded from the local repository.');
  } catch (error) {
    console.warn('Project context unavailable:', error);
  }
}

async function connectSidecar(snapshot) {
  const invoke = window.__TAURI__?.core?.invoke;
  const listen = window.__TAURI__?.event?.listen;
  if (!invoke || !listen) return;
  try {
    await listen('sidecar:response', (event) => {
      const response = JSON.parse(event.payload);
      if (response.result) {
        renderSnapshot({
          ...snapshot,
          ...response.result,
          project: { ...snapshot.project, ...response.result.project },
          metrics: { ...snapshot.metrics, ...response.result.metrics },
        });
      }
      if (response.error) notify(`Sidecar: ${response.error.message}`);
    });
    await listen('sidecar:error', (event) => notify(`Sidecar error: ${event.payload}`));
    await invoke('sidecar_start');
    const configuredProjectId = await invoke('project_id');
    await invoke('sidecar_request', {
      request: JSON.stringify({ id: `snapshot-${Date.now()}`, method: 'project.snapshot', params: { projectId: configuredProjectId } }),
    });
  } catch (error) {
    console.warn('Sidecar unavailable:', error);
  }
}

function showView(view) {
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  panels.forEach((panel) => panel.classList.toggle('active-view', panel.dataset.panel === view));
  const crumb = document.querySelector('.breadcrumb strong');
  if (crumb) crumb.textContent = view === 'project' ? 'ADE' : view[0].toUpperCase() + view.slice(1);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

navItems.forEach((item) => item.addEventListener('click', () => showView(item.dataset.view)));
renderSnapshot(projectSnapshot);
refreshProjectContext(projectSnapshot);
connectSidecar(projectSnapshot);
document.querySelectorAll('[data-view-target]').forEach((item) => item.addEventListener('click', () => showView(item.dataset.viewTarget)));
document.querySelectorAll('[data-action]').forEach((item) => item.addEventListener('click', () => {
  const messages = { 'new-task': 'Task creation will connect to the ADE workflow.', approve: 'Approval is protected by the required gates.', learn: 'Runtime documentation is coming next.' };
  notify(messages[item.dataset.action] ?? 'Action recorded.');
}));
