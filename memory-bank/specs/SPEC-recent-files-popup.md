# SPEC: "Recent files" popup

status: approved

## Objective

Add a "Recent files" popup (`Ctrl+E` on Windows/Linux, `Cmd+E` on macOS) listing the
files most recently opened in the editor, most-recent-first, for the operator to jump
back to without touching the Explorer tree. This app tracks no such history today —
`openDocuments` is only currently-open tabs — so this task adds a new, small,
session-scoped (not persisted across app restarts — a deliberate scope limit, not an
oversight; see Boundaries) most-recently-used list, updated every time
`openFileInADE(filePath)` (`desktop/src/main.js`) runs. No filter/search input in this
first version — the list is short (capped at 20) and arrow-key browsable; typing to
filter can be a fast follow-up if wanted, not built speculatively now.

## Structure

- **`desktop/src/main.js`**:
  - New `recentFiles` (an array of paths, most-recent-first, capped at 20) and
    `recordRecentFile(filePath)`, called as the first action inside `openFileInADE`
    once `nativeInvoke` is confirmed present — covers every path through that
    function (a brand-new tab, reactivating an already-open tab, and focusing a
    file detached into its own window all count as "recently opened").
  - `openRecentFilesDialog()`: renders `recentFiles` into the results list using the
    exact same row markup and CSS classes `go-to-file-popup` already established
    (`quickOpenRowMarkup`-shaped output, `.quick-open-result` styling) — reused
    directly rather than duplicated, since the visual shape is identical.
  - A new global keydown trigger for `Ctrl+E`/`Cmd+E`, guarded the same way
    `go-to-file-popup`'s trigger already is (`document.querySelector('dialog[open]')`
    check, so this can never stack over another open dialog either).
  - Arrow-key/Enter navigation: delegated at `document` level, scoped to this
    dialog's own `.open` state — mirroring `go-to-file-popup`'s corrected pattern
    exactly (not its original, broken one), since that correction is now proven.
- **`desktop/src/index.html`**: new `<dialog class="task-dialog quick-open-dialog"
  id="recent-files-dialog">` containing only a results `<ul
  id="recent-files-results">` (no search input — see Objective) with a heading label.
- **`desktop/src/styles.css`**: no new rules — reuses `.quick-open-dialog`/
  `.quick-open-result`/`.quick-open-hint` wholesale, including the corrected
  `color-mix(var(--blue))` + inset `box-shadow` active-row indicator.
- No Rust/backend changes — this is a purely in-memory, frontend-only list.

## Style

MRU tracking (top of `openFileInADE`):

```js
const recentFilesLimit = 20;
let recentFiles = [];

function recordRecentFile(filePath) {
  if (!filePath) return;
  recentFiles = [filePath, ...recentFiles.filter((path) => path !== filePath)].slice(0, recentFilesLimit);
}

async function openFileInADE(filePath) {
  if (!nativeInvoke) {
    notify('Opening files requires the local desktop runtime.');
    return;
  }
  recordRecentFile(filePath);
  showView('editor');
  // ...unchanged
}
```

Trigger, mirroring `go-to-file-popup`'s exactly:

```js
document.addEventListener('keydown', (event) => {
  const isRecentFiles = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'e';
  if (!isRecentFiles) return;
  event.preventDefault();
  openRecentFilesDialog();
});
```

Opening, reusing `quickOpenRowMarkup`:

```js
function openRecentFilesDialog() {
  const dialog = document.getElementById('recent-files-dialog');
  const results = document.getElementById('recent-files-results');
  if (!dialog?.showModal || !results) return;
  if (document.querySelector('dialog[open]')) return;
  quickOpenActiveIndex = recentFiles.length ? 0 : -1;
  results.innerHTML = recentFiles.length
    ? recentFiles.map((path, index) => quickOpenRowMarkup({ path, name: pathBaseName(path) }, index)).join('')
    : '<li class="quick-open-hint">No recently opened files.</li>';
  dialog.showModal();
}
```

## Test strategy

- `node --check desktop/src/main.js`.
- Contract-test additions in `tests/desktop-ui-contract.test.ts`: the dialog markup,
  `recordRecentFile` called from `openFileInADE`, the capped/deduped list shape, the
  `Ctrl/Cmd+E` trigger, the dialog-stacking guard, and that it reuses
  `quickOpenRowMarkup` rather than a second row-rendering implementation.
- **Manual verification is mandatory before this task is called done**: in
  `npm run desktop:dev`, open a few different files, confirm `Ctrl/Cmd+E` lists them
  most-recent-first, confirm re-opening an already-listed file moves it to the top
  instead of duplicating it, confirm arrow-key navigation and its active-row
  highlight are visible (this exact class of bug was already found and fixed once
  this session — retest it here too, on a fresh dialog, since CSS reuse alone isn't
  proof the fix generalizes), confirm Enter/click open and close, confirm Escape
  closes without opening anything, confirm the list is empty-safe on a Project with
  no files opened yet.

## Boundaries

**Always:** reuse `go-to-file-popup`'s row markup, CSS, dialog-stacking guard, and
corrected document-delegated keyboard pattern — never a second, parallel
implementation of any of those.

**Ask first:** before persisting `recentFiles` across app restarts (a new storage
concern — localStorage, the sqlite store, or a settings file — none of which this
task touches) or adding a filter/search input to this dialog — both are real,
reasonable next steps, deliberately deferred rather than built speculatively.

**Never:** never lets `recentFiles` grow unbounded — always capped at 20, oldest
entries dropped silently.
