# SPEC: Changes tab — status glyphs and selective commit

status: approved

## Objective

Version Control → Changes currently shows each pending file's raw `git status --short`
code as text (`M`, `A`, `??`, …) and its "Commit" button always stages and commits
every pending file (`git add --all`). Two changes, same panel:

1. Replace the raw status text with a colored glyph, three buckets: new/untracked → a
   green `+`; deleted → a red `−`; modified, renamed, or in conflict → a yellow `º`.
   Reuses the Explorer tree's existing `workspaceGitStateClass()` classification, with
   new colors specific to this list — the Explorer tree's own decoration colors are
   untouched.
2. A checkbox per file (all checked by default) plus a select-all/none toggle near the
   file-count header, so the operator can commit a subset. The commit mutation stages
   exactly the checked set deterministically (`git reset` then `git add -- <files>`),
   not layered on top of whatever happened to already be staged outside Assay.
   Unchecking every file and clicking Commit refuses with a message instead of creating
   an empty commit.

Scope: only the plain "Commit" button in Version Control → Changes
(`git.commit.create` / `createCommit`). The Ship flow (`task.ship`) and the Task
git-workflow panel's own "create-commit" button (`main.js`, pre-fills a task-based
message) are untouched — `createCommit` gains an optional capability neither of those
call sites uses.

## Commands

- Backend (sidecar) type-check: `npm run build`
- Backend (sidecar) unit tests: `npm test`
- Frontend syntax check: `node --check desktop/src/main.js`
- Frontend rebuild (for manual verification): `cd desktop && node build.mjs`
- Full app, manual run: `npm run desktop:dev` — GUI behavior verified by the operator
  directly; see `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
- Contract/regression suite: `npm test` (repo root; runs `tests/desktop-ui-contract.test.ts`)

## Structure

- **`src/application/git/git-mutations.ts`**: `createCommit` gains an optional
  `files?: string[]`. Unconditionally runs `git reset` first (confirmed safe on a
  zero-commit/unborn-HEAD repository — `git init && git add x && git reset` unstages
  cleanly with no error), then `git add -- <files>` when `files` is given and non-empty,
  else `git add --all` (unchanged default, so every existing caller — Ship,
  the Task git-workflow panel's own commit button — keeps today's behavior exactly).
- **`src/desktop-sidecar.ts`**: the `git.commit.create` case's `createCommit` call
  forwards `...(params.files ? { files: params.files } : {})`. `git.commit.push`
  (Ship's underlying path) is left exactly as it is — this task does not wire `files`
  through it.
- **`desktop/src/main.js`**:
  - New module-level `pendingCommitSelection` (a `Set<string>` of selected paths).
    `renderPendingGitChanges` resets it to "every visible file" whenever the fetched
    file set actually changed (compare against the previous `pendingGitFiles`
    path list) — not on every render, so mid-typing filter changes don't silently
    re-select files the operator had unchecked.
  - `gitFileLabelMarkup(file)`: the `<span class="git-file-status">` content changes
    from the raw status text to one glyph, chosen by a new `gitStatusGlyph(status)`
    function built on the existing `workspaceGitStateClass(status)`. A new
    `git-file-status-<bucket>` class carries the color (`new` / `deleted` /
    `modified`), replacing the current plain `.git-file-status` cyan styling for this
    list only.
  - The pending-file row markup changes from a bare `<button>` (invalid to nest a
    checkbox inside) to a `<div role="button" tabindex="0">` wrapper carrying the
    existing `data-git-pending-file` (diff-preview selection, delegated click handler
    unchanged — `closest()` still matches a `div`) plus a sibling `<label>` holding
    `<input type="checkbox" data-git-pending-file-select="<path>">`. A new delegated
    click handler for `[data-git-pending-file-select]` is checked *before* the existing
    `[data-git-pending-file]` one and returns immediately, so checking a box never also
    triggers the diff-preview selection.
  - A new `<input type="checkbox" id="git-pending-select-all">` in
    `desktop/src/index.html`'s `.changes-section-heading`, wired with `.indeterminate`
    support (`checked` when every visible file is selected, `indeterminate` when some
    but not all are).
  - `updatePendingCommitSelectionUI()`: syncs the select-all checkbox's
    checked/indeterminate state and the commit button's enabled state
    (`pendingCommitSelection.size > 0`) after any selection change, without a full
    `renderPendingGitChanges` re-render (checkbox toggling must not re-fetch or
    re-render the whole list).
  - The `git-commit-form` submit handler: if `pendingCommitSelection.size === 0`,
    `notify('Select at least one file to commit.')` and return before dispatching;
    otherwise sends `files: [...pendingCommitSelection]` in the `git.commit.create`
    request only when the selection is a *strict subset* of `pendingGitFiles`
    (everything selected → omit `files` entirely, identical to today's request shape,
    so the default path is provably unchanged).
- **Tests**: `tests/git-mutations.test.ts` gains cases for `createCommit` with a
  `files` subset (only the named files staged/committed, others left pending) and
  confirms the zero-commit-repo `git reset` safety directly. `tests/desktop-ui-
  contract.test.ts` gains string-match assertions for the glyph function, the
  checkbox markup/delegation, the select-all wiring, and the empty-selection refusal.

## Style

`src/application/git/git-mutations.ts`:

```ts
export async function createCommit(input: ConfirmedOperation & { message: string; body?: string; files?: string[] }) {
  assertConfirmed(input);
  await executeGit(["reset"], { cwd: input.directory });
  if (input.files?.length) {
    await executeGit(["add", "--", ...input.files], { cwd: input.directory });
  } else {
    await executeGit(["add", "--all"], { cwd: input.directory });
  }
  const result = await executeGit(["commit", "-m", input.message, ...(input.body ? ["-m", input.body] : [])], { cwd: input.directory });
  const commit = (await executeGit(["rev-parse", "HEAD"], { cwd: input.directory })).stdout.trim();
  return { operation: "commit.create", message: input.message, commit, output: result.stdout.trim(), actor: input.actor, reason: input.reason };
}
```

`desktop/src/main.js`, glyph mapping (mirrors `workspaceGitStateClass`'s own shape):

```js
function gitStatusGlyph(status) {
  const state = workspaceGitStateClass(status);
  if (state === 'git-added' || state === 'git-untracked') return { symbol: '+', bucket: 'new' };
  if (state === 'git-deleted') return { symbol: '−', bucket: 'deleted' };
  return { symbol: 'º', bucket: 'modified' };
}
```

Pending-file row, checkbox + diff-select kept independent:

```js
function pendingGitFileRowMarkup(file) {
  const selected = pendingCommitSelection.has(file.path);
  return `<div class="git-pending-file${file.path === selectedPendingGitFile ? ' active' : ''}" role="button" tabindex="0" data-git-pending-file="${escapeHTML(file.path)}" title="${escapeHTML(workspaceGitRelativePath(file.path))}">
    <label class="git-pending-file-checkbox"><input type="checkbox" data-git-pending-file-select="${escapeHTML(file.path)}"${selected ? ' checked' : ''}></label>
    ${gitFileLabelMarkup(file)}
  </div>`;
}
```

Delegated handlers, checkbox checked first — no `stopPropagation` needed: both branches
live in the same single delegated listener, so returning early from the checkbox branch
already skips the row's diff-select branch below it, since they never both run for one
click:

```js
const selectToggle = event.target.closest('[data-git-pending-file-select]');
if (selectToggle) {
  const path = selectToggle.dataset.gitPendingFileSelect;
  if (selectToggle.checked) pendingCommitSelection.add(path); else pendingCommitSelection.delete(path);
  updatePendingCommitSelectionUI();
  return;
}
```

Commit submit, refusing an empty selection and omitting `files` when everything is selected:

```js
if (!pendingCommitSelection.size) { notify('Select at least one file to commit.'); return; }
const allSelected = pendingCommitSelection.size === pendingGitFiles.length;
void sendContextRequest('git.commit.create', { repositoryPath: workspaceRootPath, intent: title, ...(body ? { body } : {}), ...(selectedTaskId ? { taskId: selectedTaskId } : {}), ...(allSelected ? {} : { files: [...pendingCommitSelection] }), reason: 'Local commit requested from Version control', actor: 'human', confirmed: true }, 'git-commit-local').catch((error) => notify(error instanceof Error ? error.message : 'Commit failed.'));
```

## Test strategy

- **Sidecar**: `createCommit` with a `files` subset on a repo with two changed files
  commits only the named one, leaving the other still pending
  (`git status --short` afterward still lists it). A case confirming `git reset`
  does not fail on a repository with no commits yet (unborn HEAD) — this session hit
  the zero-commit-repository invariant three separate times already; verified directly
  against real `git` before this spec was written, and asserted here so it never
  regresses silently.
- **Frontend**: string-match additions in `tests/desktop-ui-contract.test.ts` for
  `gitStatusGlyph`, the three `git-file-status-<bucket>` classes, the checkbox markup
  and its `data-git-pending-file-select` delegation appearing *before* the existing
  `data-git-pending-file` handler in source order, the select-all checkbox wiring, and
  the empty-selection refusal string.
- **Manual verification is mandatory before this task is called done**, driven by the
  operator in `npm run desktop:dev`: modify, add, and delete files in an open Project;
  confirm the three glyphs/colors render correctly for each; confirm checkboxes default
  checked; uncheck one file and commit, confirm only the checked files land in the
  commit (`git log` / `git show`) and the unchecked one is still pending afterward;
  confirm the select-all toggle selects/deselects everything and shows indeterminate
  when partially selected; confirm unchecking everything disables committing with a
  clear message; confirm clicking a checkbox never changes the diff preview pane.

## Boundaries

**Always:**
- Reuse `workspaceGitStateClass()` for the status→bucket classification — never a
  second, parallel mapping of git status codes.
- `createCommit`'s default behavior (no `files` passed) stays byte-for-byte identical
  to today's `git add --all` — every existing caller (Ship, the Task git-workflow
  panel) is unaffected.
- Checking/unchecking a file's checkbox never triggers a full `renderPendingGitChanges`
  re-fetch — it is local UI state until the next commit or file-set change.

**Ask first:**
- Before wiring `files`-based selective staging into `git.commit.push`/Ship or the
  Task git-workflow panel's own commit button — this task's scope is the plain Commit
  button only.
- Before persisting selection state across a Project switch or app restart — resets to
  all-selected on every genuine file-set change, per the confirmed assumption.

**Never:**
- Never create an empty commit — refuse with a message when the selection is empty,
  the same boundary already established for "no pending changes" in the existing
  submit handler.
- Never let the checkbox and the diff-preview row-click interfere with each other —
  clicking one must never also trigger the other.
