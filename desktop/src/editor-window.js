import { createCodeEditorSurface, languageLabelForPath } from './code-editor.js';
import { pathBaseName } from './paths.js';

/** A file in a window of its own. It carries the editor and nothing else of the
    shell: no Project rail, no terminal, no agents. What it must not do is own a
    second copy of a document the main window still has -- the tab moves here,
    it is not cloned -- and it must not lose work when it closes. */
const invoke = window.__TAURI__?.core?.invoke;
const currentWindow = window.__TAURI__?.window?.getCurrentWindow?.();
const emit = window.__TAURI__?.event?.emit;
const filePath = new URLSearchParams(window.location.search).get('path') ?? '';

let original = '';
let editable = false;
let surface = null;
let closing = false;

/** The theme is this machine's, so it is read where the shell keeps it. */
try { document.documentElement.dataset.theme = localStorage.getItem('ade-theme') ?? 'light'; } catch { document.documentElement.dataset.theme = 'light'; }

const nameNode = document.getElementById('detached-name');
const pathNode = document.getElementById('detached-path');
const kindNode = document.getElementById('detached-kind');
const stateNode = document.getElementById('detached-state');
const saveButton = document.getElementById('detached-save');
const discardButton = document.getElementById('detached-discard');
const messageNode = document.getElementById('detached-message');

function isDirty() {
  return editable && surface !== null && surface.value() !== original;
}

function renderState() {
  const dirty = isDirty();
  if (stateNode) stateNode.textContent = dirty ? 'Unsaved' : editable ? 'Saved' : '';
  if (saveButton) saveButton.disabled = !dirty;
  if (discardButton) discardButton.disabled = !dirty;
  void currentWindow?.setTitle?.(`${dirty ? '• ' : ''}${pathBaseName(filePath) || 'Assay'}`);
}

function showMessage(text) {
  if (!messageNode) return;
  messageNode.textContent = text;
  messageNode.hidden = !text;
}

async function save() {
  if (!invoke || !isDirty()) return false;
  try {
    await invoke('write_file', { path: filePath, content: surface.value() });
    original = surface.value();
    renderState();
    return true;
  } catch (error) {
    showMessage(String(error));
    return false;
  }
}

function discard() {
  if (!surface) return;
  void surface.setContent(original, filePath, true);
  renderState();
}

async function openFile() {
  if (!invoke || !filePath) { showMessage('This window was opened without a file.'); return; }
  if (nameNode) nameNode.textContent = pathBaseName(filePath);
  if (pathNode) pathNode.textContent = filePath;
  try {
    const result = await invoke('read_file', { path: filePath });
    if (kindNode) kindNode.textContent = languageLabelForPath(filePath);
    if (result.kind !== 'text') {
      /** A binary or oversized file is readable in the main window's viewer and
          not here: this window is an editor, and it says so rather than opening
          an empty one. */
      showMessage(result.message ?? 'This file cannot be edited as text.');
      return;
    }
    editable = true;
    original = result.content ?? '';
    surface = createCodeEditorSurface({
      parent: document.getElementById('detached-content'),
      onChange: renderState,
      onSave: () => { void save(); },
    });
    await surface.setContent(original, filePath, true);
    renderState();
  } catch (error) {
    showMessage(String(error));
  }
}

saveButton?.addEventListener('click', () => { void save(); });
discardButton?.addEventListener('click', discard);

/** Closing with unsaved work asks first. The window is the only owner of this
    document while it is open, so nobody else can answer for it. */
/** The webview never answers the browser's own confirm, so the question is
    asked in the page, with all three answers a person actually has. */
function askBeforeClosing() {
  const dialog = document.getElementById('detached-close-dialog');
  const copy = document.getElementById('detached-close-copy');
  if (!dialog?.showModal) return Promise.resolve('discard');
  if (copy) copy.textContent = `${pathBaseName(filePath)} has changes that exist only in this window.`;
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue || 'cancel'), { once: true });
    dialog.showModal();
  });
}

void currentWindow?.onCloseRequested?.(async (event) => {
  if (closing || !isDirty()) { void emit?.('editor-window:closed', { path: filePath }); return; }
  event.preventDefault();
  const answer = await askBeforeClosing();
  if (answer === 'cancel') return;
  if (answer === 'save' && !(await save())) return;
  closing = true;
  void emit?.('editor-window:closed', { path: filePath });
  void currentWindow.destroy();
});

void openFile();
