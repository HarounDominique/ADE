const navItems = [...document.querySelectorAll('.nav-item[data-view]')];
const panels = [...document.querySelectorAll('.view')];
const toast = document.querySelector('.toast');

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
document.querySelectorAll('[data-view-target]').forEach((item) => item.addEventListener('click', () => showView(item.dataset.viewTarget)));
document.querySelectorAll('[data-action]').forEach((item) => item.addEventListener('click', () => {
  const messages = { 'new-task': 'Task creation will connect to the ADE workflow.', approve: 'Approval is protected by the required gates.', learn: 'Runtime documentation is coming next.' };
  notify(messages[item.dataset.action] ?? 'Action recorded.');
}));
