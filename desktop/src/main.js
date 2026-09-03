import { projectSnapshot } from './project-snapshot.js';

const navItems = [...document.querySelectorAll('.nav-item[data-view]')];
const panels = [...document.querySelectorAll('.view')];
const toast = document.querySelector('.toast');
const taskDialog = document.getElementById('new-task-dialog');
const taskForm = document.getElementById('new-task-form');
const taskIntent = document.getElementById('task-intent');
let nativeInvoke;
let terminalStarted = false;
let selectedProvider = 'opencode';
let activeProjectId = projectSnapshot.project.id;
const runtimeEvents = [];

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
  renderChanges(snapshot.tasks ?? []);
  if (snapshot.sync) setSyncState(snapshot.sync.state, snapshot.sync.label);
}

function renderChanges(tasks) {
  const task = tasks.find((item) => ['UNDER_REVIEW', 'READY_FOR_HUMAN'].includes(item.status)) ?? tasks[0];
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
  if (taskId) taskId.textContent = review.taskId;
  if (detail) detail.textContent = review.review ? `${review.review.summary} · ${review.review.findings.length} finding(s).` : 'No independent review recorded yet.';
  if (status) status.textContent = review.taskStatus.replaceAll('_', ' ');
  if (gates) gates.innerHTML = review.gates.map((gate) => `<span class="gate ${gate.status === 'passed' || gate.status === 'waived' ? 'passed' : 'pending'}">${gate.status === 'passed' ? '✓' : '○'} ${escapeHTML(gate.id.replaceAll('-', ' '))}</span>`).join('');
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
    return `<article class="task-card${index === 0 ? ' selected-task' : ''}" data-task-select="${escapeHTML(task.id)}"><div class="task-top"><span class="task-id">${escapeHTML(task.id)}</span><span class="task-status ${tone}">${status}</span></div><h3>${escapeHTML(task.intent)}</h3><p>Project Task · state from ADE metadata</p><div class="task-bottom"><span class="phase"><span class="phase-dot${tone === 'building' ? ' blue' : ''}"></span>${phase}</span><span class="task-time">${escapeHTML(task.updatedAt ? new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}</span><span class="task-arrow">→</span></div>${actionMarkup}</article>`;
  }).join('');
  lists.forEach((list) => { list.innerHTML = cards; });
}

function renderTaskDetail(detail) {
  const panel = document.getElementById('task-detail-panel');
  if (!panel) return;
  const task = detail.task;
  panel.innerHTML = `<p class="eyebrow">TASK DETAIL</p><div class="task-detail-heading"><div><span class="task-id">${escapeHTML(task.id)}</span><h2>${escapeHTML(task.intent)}</h2></div><span class="task-status building">${escapeHTML(task.status.replaceAll('_', ' '))}</span></div><p>${task.history.length} history events · ${detail.changeSets.length} ChangeSets · ${detail.reviews.length} Reviews · ${detail.runtimeEvidence.length} runtime events</p>`;
}

async function refreshProjectContext(snapshot) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return;
  try {
    const context = await invoke('project_context', { repositoryPath: snapshot.project.repositoryPath });
    renderSnapshot({ ...snapshot, project: { ...snapshot.project, ...context } });
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
    return result;
  } catch (error) { console.warn('Git workspace unavailable:', error); }
}

async function loadWorkspaceTree(path, invoke = window.__TAURI__?.core?.invoke) {
  const tree = document.getElementById('workspace-tree');
  if (!tree || !invoke || !path) return;
  try {
    const entries = await invoke('list_directory', { path, maxDepth: 2 });
    tree.innerHTML = entries.length ? entries.map((entry) => `<li class="workspace-entry ${entry.kind}" data-file-path="${escapeHTML(entry.path)}" style="padding-left:${entry.depth * 16}px"><span>${entry.kind === 'directory' ? '▸' : entry.kind === 'symlink' ? '↗' : '·'}</span><span>${escapeHTML(entry.name)}</span></li>`).join('') : '<li>Directory is empty.</li>';
  } catch (error) {
    tree.innerHTML = '<li>Workspace directory unavailable.</li>';
    console.warn('Workspace tree unavailable:', error);
  }
}

async function connectSidecar(snapshot) {
  const invoke = window.__TAURI__?.core?.invoke;
  const listen = window.__TAURI__?.event?.listen;
  if (!invoke || !listen) return;
  nativeInvoke = invoke;
  await listen('terminal:output', (event) => {
    const output = document.getElementById('terminal-output');
    if (output) output.textContent += event.payload;
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
  };
  try {
    await listen('sidecar:response', async (event) => {
      const response = JSON.parse(event.payload);
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
      if (response.result?.agentRuntime) {
        renderRuntimeStatus(response.result);
        return;
      }
      if (response.result?.serviceId) {
        renderServiceStatus(response.result);
        notify(`Local service ${response.result.status.toLowerCase()}.`);
        return;
      }
      if (response.result?.branches && response.result?.worktrees) {
        const output = document.getElementById('git-workspace-output');
        if (output) output.textContent = `Branches\n${response.result.branches.join('\n') || '—'}\n\nWorktrees\n${response.result.worktrees.join('\n') || '—'}\n\nRemotes\n${response.result.remotes.join('\n') || '—'}`;
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
        const available = response.result.filter((provider) => provider.available).map((provider) => `${provider.label}: ${provider.detail}`);
        const detail = document.getElementById('provider-detail');
        if (detail) detail.textContent = available.length ? available.join(' · ') : 'No configured provider is reachable.';
        return;
      }
      if (Array.isArray(response.result) && response.result[0]?.permissions) {
        const detail = document.getElementById('native-skills-list');
        if (detail) detail.textContent = response.result.map((skill) => skill.label).join(' · ');
        const select = document.getElementById('agent-skill');
        if (select) select.innerHTML = response.result.map((skill) => `<option value="${escapeHTML(skill.id)}">${escapeHTML(skill.label)}</option>`).join('');
        notify(`${response.result.length} native skills available.`);
        return;
      }
      if (response.result?.skillId && response.result?.sessionId) {
        const feedback = document.getElementById('agent-feedback');
        if (feedback) feedback.textContent = `${response.result.skillId} running in ${response.result.sessionId} (${selectedProvider}).`;
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
renderRuntimeStatus({ sidecar: 'STARTING', agentRuntime: 'DISCONNECTED', activeTaskId: null, lastEventAt: null, lastError: null });
refreshProjectContext(projectSnapshot);
connectSidecar(projectSnapshot);
document.querySelectorAll('[data-view-target]').forEach((item) => item.addEventListener('click', () => showView(item.dataset.viewTarget)));
document.querySelectorAll('[data-action]').forEach((item) => item.addEventListener('click', () => {
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
      ? { serviceId: 'ade-dev-service', command: '/bin/sh', args: ['-c', 'sleep 3600'], cwd: document.getElementById('project-path')?.textContent ?? '.' }
      : { serviceId: 'ade-dev-service' };
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `${method}-${Date.now()}`, method, params }) }).catch((error) => { notify('Local service action failed.'); console.warn(error); });
    return;
  }
  if (item.dataset.action === 'open-terminal') {
    showView('project');
    document.getElementById('terminal-command')?.focus();
    notify('Integrated terminal focused at the project root.');
    return;
  }
  if (item.dataset.action === 'refresh-tree') {
    loadWorkspaceTree(document.getElementById('project-path')?.textContent, nativeInvoke);
    return;
  }
  if (item.dataset.action === 'refresh-git') {
    refreshGitWorkspace(document.getElementById('project-path')?.textContent, nativeInvoke);
    return;
  }
  if (item.dataset.action === 'refresh-knowledge') {
    const repositoryPath = document.getElementById('project-path')?.textContent;
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `knowledge-${Date.now()}`, method: 'knowledge.reconcile', params: { repositoryPath, intent: 'SPEC-NEXUS.md' } }) });
    return;
  }
  if (['create-branch', 'create-commit', 'create-pr'].includes(item.dataset.action)) {
    if (!nativeInvoke) { notify('Git operations require the sidecar.'); return; }
    const labels = { 'create-branch': ['git.branch.create', 'feature/ade-next'], 'create-commit': ['git.commit.create', 'chore: record ADE changes'], 'create-pr': ['github.pr.create', 'ADE change'] };
    const [method, intent] = labels[item.dataset.action];
    if (!window.confirm(`Confirm ${method}: ${intent}?`)) return;
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `${method}-${Date.now()}`, method, params: { repositoryPath: document.getElementById('project-path')?.textContent, intent, actor: 'human', reason: `Confirmed in ADE Git workspace`, confirmed: true } }) }).then(() => notify(`${method} completed.`)).catch((error) => { notify('Git operation failed.'); console.warn(error); });
    return;
  }
  if (item.dataset.action === 'run-skill') {
    if (!nativeInvoke) { notify('Skill execution requires the sidecar.'); return; }
    const skillId = document.getElementById('agent-skill')?.value;
    selectedProvider = document.getElementById('agent-provider')?.value ?? 'opencode';
    const feedback = document.getElementById('agent-feedback');
    if (!skillId) { notify('No native skill selected.'); return; }
    if (feedback) feedback.textContent = `Starting ${skillId} with ${selectedProvider}…`;
    nativeInvoke('sidecar_request', { request: JSON.stringify({ id: `skill-run-${Date.now()}`, method: 'skills.run', params: { skillId, provider: selectedProvider, intent: document.getElementById('task-intent')?.value || 'Inspect the active Project and propose the next useful action.', repositoryPath: document.getElementById('project-path')?.textContent } }) }).catch((error) => { if (feedback) feedback.textContent = `Skill failed: ${error}`; notify('Skill execution failed.'); });
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
  const fileEntry = event.target.closest('[data-file-path].file');
  if (fileEntry) {
    nativeInvoke?.('open_file', { path: fileEntry.dataset.filePath }).catch((error) => console.warn('File open unavailable:', error));
    return;
  }
  const taskCard = event.target.closest('[data-task-select]');
  if (taskCard && !event.target.closest('button')) {
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `detail-${taskCard.dataset.taskSelect}-${Date.now()}`, method: 'task.detail', params: { taskId: taskCard.dataset.taskSelect } }) });
    nativeInvoke?.('sidecar_request', { request: JSON.stringify({ id: `git-ops-${taskCard.dataset.taskSelect}-${Date.now()}`, method: 'task.git.operations', params: { taskId: taskCard.dataset.taskSelect } }) });
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
document.getElementById('terminal-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const output = document.getElementById('terminal-output');
  const command = document.getElementById('terminal-command')?.value.trim();
  const cwd = document.getElementById('project-path')?.textContent;
  if (!nativeInvoke || !command || !cwd) { notify('Native terminal requires the desktop runtime.'); return; }
  try {
    if (!terminalStarted) { await nativeInvoke('terminal_start', { cwd }); terminalStarted = true; }
    await nativeInvoke('terminal_input', { input: `${command}\n` });
    if (output) output.textContent += `\n$ ${command}\n`;
  } catch (error) {
    if (output) output.textContent = String(error);
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
