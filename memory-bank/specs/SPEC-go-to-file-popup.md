# SPEC: "Go to file" quick-open popup

status: approved

## Objective

Add a global "Go to file" popup (`Ctrl+Shift+N` on Windows/Linux, `Cmd+Shift+O` on
macOS — this task accepts *either* combination regardless of platform, rather than
platform-sniffing which one to bind, since accepting both is strictly more forgiving
and costs nothing) that lets the operator jump straight to any file in the active
Project by typing part of its name, without touching the Explorer tree. Reuses the
existing filename-search backend (`search_directory` / `search_directory_in`,
`desktop/src-tauri/src/lib.rs`) that already backs the Explorer's own inline filter —
no backend change, no new Rust command. Opening a result calls the existing
`openFileInADE(filePath)` (`desktop/src/main.js`), the same function every other
"open this file" entry point in the app already uses.

## Structure

- **`desktop/src/index.html`**: new `<dialog class="task-dialog quick-open-dialog"
  id="quick-open-dialog">` — a search `<input>` (autofocus on open) plus a
  `<ul id="quick-open-results">` results list, mirroring the existing `.task-dialog`
  visual convention (already used by `new-task-dialog`, `new-project-dialog`, etc.)
  with a new results-list layout added for this dialog specifically.
- **`desktop/src/main.js`**:
  - A new global `keydown` listener (its own small block, matching this codebase's
    convention of several narrowly-scoped listeners rather than one large one) opens
    the dialog on `Ctrl+Shift+N` or `Cmd+Shift+O`, `preventDefault`-ed (Ctrl+Shift+N
    has no competing browser/WebView default to worry about, unlike the `Mod-r`
    replace binding in the prior task; still calling `preventDefault` defensively).
  - `openQuickOpenDialog()` / `closeQuickOpenDialog()`: show/reset the dialog, focus
    the input, clear the previous query and results.
  - `scheduleQuickOpenSearch(query)` / `runQuickOpenSearch(query)`: mirrors
    `scheduleWorkspaceFileSearch`/`searchWorkspaceFiles`'s exact shape (140ms debounce,
    a request-token guard against a stale response overwriting a newer one) but calls
    `search_directory` directly rather than repainting the Explorer tree, and filters
    the response to `entry.kind === 'file'` (directories excluded — this is a *file*
    picker). An empty query shows a hint ("Type to search files"), not the full
    (potentially huge) file list.
  - Row rendering is a new, smaller markup than `renderWorkspaceEntry` (which carries
    drag-and-drop, context-menu, and tree-decoration wiring this popup does not need)
    — just an icon (reusing `iconForFileName`, already imported), name, and relative
    path hint.
  - Keyboard nav inside the open dialog: `ArrowDown`/`ArrowUp` move a `.active` class
    among rendered result rows (wrapping at either end), `Enter` opens the active row
    (or the first, if none is yet marked active), `Escape` closes — `<dialog>`'s own
    native Escape-closes behavior is free and needs no extra code. Selecting a result
    (click or Enter) calls `openFileInADE(path)` then closes the dialog.
- **`desktop/src/styles.css`**: `.quick-open-dialog` results-list layout (scrollable,
  capped height, active-row highlight), reusing existing tokens.
- No Rust changes at all — this task is 100% frontend, calling an already-existing,
  already-tested backend command.

## Style

Trigger (new, small keydown listener):

```js
document.addEventListener('keydown', (event) => {
  const isGoToFile = (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n')
    || (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'o');
  if (!isGoToFile) return;
  event.preventDefault();
  openQuickOpenDialog();
});
```

Search, mirroring `scheduleWorkspaceFileSearch`/`searchWorkspaceFiles`'s shape:

```js
let quickOpenSearchId = 0;
let quickOpenSearchTimer = null;

function scheduleQuickOpenSearch(query) {
  window.clearTimeout(quickOpenSearchTimer);
  const search = ++quickOpenSearchId;
  const needle = query.trim();
  const results = document.getElementById('quick-open-results');
  if (!needle) {
    if (results) results.innerHTML = '<li class="quick-open-hint">Type to search files</li>';
    return;
  }
  quickOpenSearchTimer = window.setTimeout(() => void runQuickOpenSearch(needle, search), 140);
}

async function runQuickOpenSearch(query, search) {
  const invoke = nativeInvoke ?? window.__TAURI__?.core?.invoke;
  const results = document.getElementById('quick-open-results');
  if (!invoke || !results) return;
  const matches = await invoke('search_directory', { path: workspaceRootPath, query }).catch(() => []);
  if (search !== quickOpenSearchId) return;
  const files = matches.filter((entry) => entry.kind === 'file');
  results.innerHTML = files.length
    ? files.map((entry) => quickOpenRowMarkup(entry)).join('')
    : '<li class="quick-open-hint">No matching files.</li>';
}
```

## Test strategy

- `node --check desktop/src/main.js`.
- Contract-test additions in `tests/desktop-ui-contract.test.ts`: the dialog markup in
  `html`, the keydown trigger accepting both combos, `scheduleQuickOpenSearch`/
  `runQuickOpenSearch` existing and filtering on `kind === 'file'`, the empty-query
  hint, and that a selected result calls `openFileInADE`.
- **Manual verification is mandatory before this task is called done**: in
  `npm run desktop:dev`, confirm the popup opens on the bound shortcut from anywhere
  in the app (not just when the Explorer has focus), typing filters live, arrow keys
  move the highlight, Enter and click both open the file and close the popup, Escape
  closes without opening anything, and the popup does not list directories.

## Boundaries

**Always:** reuse `search_directory` / `openFileInADE` — never a second, parallel
filename-search or file-open implementation.

**Ask first:** before adding recent-files to this popup's empty state — that is a
separate, explicitly scoped task (item #18) already queued; this task's empty state is
just a hint, nothing more.

**Never:** never lists directories in the results — this is a file picker, not a
general workspace-item picker.
