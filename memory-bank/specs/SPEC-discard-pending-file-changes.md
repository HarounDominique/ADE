# SPEC: Discard changes to a single pending file (right-click)

status: approved

## Objective

Add a right-click context menu to each pending-file row in `Version control > Changes`
with a single action, "Discard changes", that restores that one file to its committed
(`HEAD`) state — or deletes it, if it has no committed state at all (a new/untracked
file). Confirmed via the app's existing in-app confirmation dialog before running,
since this is an irreversible git working-tree mutation, not the Editor's own
buffer-only `Discard` (unrelated feature, deliberately kept a different label —
"Discard changes" here always means the git-level operation).

Named "Discard changes" rather than "Revert" per operator confirmation — `git revert`
means something else (undoing an already-committed change), and this label already
matches the app's own convention and GitHub Desktop's, the app's established parity
reference ([ADR-0028](../../docu/adr/0028-github-desktop-version-control-parity.md)).

## Commands

`npm test`; `npm run build`; `npm run desktop:dev`; `git status --short` (manual
verification against a real repo).

## Structure

- **`src/application/git/git-mutations.ts`**: new `discardFileChanges`, same
  `ConfirmedOperation` contract every existing mutation already uses
  (`assertConfirmed`, `executeGit`). Takes an explicit `untracked: boolean` from the
  caller — the frontend already classifies every pending file into exactly this
  bucket for its status glyph (`gitStatusGlyph()` in `desktop/src/main.js`), so no new
  git query is needed to tell a new file apart from a modified/deleted one.
- **`src/desktop-sidecar.ts`**: new method `git.discard.file`, dispatched alongside
  the other confirmed git mutations (`git.commit.create` et al.), params
  `{repositoryPath, file, untracked, actor, reason, confirmed}`.
- **`desktop/src/index.html`**: new `<div id="git-pending-file-context-menu" role="menu" hidden>`,
  mirroring the Explorer tree's existing `#workspace-context-menu` markup shape (a
  plain container of `role="menuitem"` buttons) rather than inventing a new menu
  convention — this is the only `contextmenu`-triggered menu pattern already in the
  codebase.
- **`desktop/src/main.js`**:
  - `openGitPendingFileContextMenu(event)`, attached via
    `document.getElementById('git-pending-files')?.addEventListener('contextmenu', ...)`
    — resolves the target row via `event.target.closest('[data-git-pending-file]')`,
    reads its path and status bucket, positions the menu at the cursor
    (viewport-clamped, mirroring `showWorkspaceContextMenu`'s clamping math).
  - `closeGitPendingFileContextMenu()`, wired into the same outside-click (extend the
    existing check at the `!event.target.closest(...)` global click delegate) and
    Escape-key handlers that already close `#workspace-context-menu`.
  - The single menu item's click handler calls `requestConfirmation({...}, () =>
    sendContextRequest('git.discard.file', {...}))`, following the exact shape of
    `discardDocumentChanges()` and `deleteWorkspaceEntryFromUI()` already in this file.

## Style

Backend mutation (`src/application/git/git-mutations.ts`), mirroring `createCommit`'s
existing use of an unconditional `git reset` first (already proven safe on a
zero-commit repo by a prior task):

```ts
export async function discardFileChanges(
  input: ConfirmedOperation & { file: string; untracked: boolean },
) {
  assertConfirmed(input);
  await executeGit(["reset", "--", input.file], { cwd: input.directory });
  if (input.untracked) {
    await executeGit(["clean", "-f", "--", input.file], { cwd: input.directory });
  } else {
    await executeGit(["checkout", "--", input.file], { cwd: input.directory });
  }
  return { operation: "discard.file", file: input.file, actor: input.actor, reason: input.reason };
}
```

Frontend menu open (`desktop/src/main.js`), mirroring `openWorkspaceContextMenu`/
`showWorkspaceContextMenu`'s viewport-clamping, collapsed to one target since this
menu has exactly one item (no per-entry show/hide branching needed):

```js
function openGitPendingFileContextMenu(event) {
  const row = event.target.closest('[data-git-pending-file]');
  if (!row) return;
  event.preventDefault();
  const path = row.dataset.gitPendingFile;
  const file = pendingGitFiles.find((entry) => entry.path === path);
  if (!file) return;
  const menu = document.getElementById('git-pending-file-context-menu');
  if (!menu) return;
  menu.dataset.targetPath = path;
  menu.dataset.targetUntracked = String(gitStatusGlyph(file.status).bucket === 'new');
  menu.hidden = false;
  const maxX = window.innerWidth - menu.offsetWidth - 8;
  const maxY = window.innerHeight - menu.offsetHeight - 8;
  menu.style.left = `${Math.min(event.clientX, maxX)}px`;
  menu.style.top = `${Math.min(event.clientY, maxY)}px`;
}

function closeGitPendingFileContextMenu() {
  const menu = document.getElementById('git-pending-file-context-menu');
  if (menu) menu.hidden = true;
}
```

Discard action (dispatched from the menu item's click, in the existing global
`[data-action]` delegate):

```js
if (item.dataset.action === 'discard-pending-file') {
  const menu = document.getElementById('git-pending-file-context-menu');
  const path = menu?.dataset.targetPath;
  const untracked = menu?.dataset.targetUntracked === 'true';
  closeGitPendingFileContextMenu();
  if (!path) return;
  requestConfirmation({
    eyebrow: 'DISCARD CHANGES',
    title: `Discard changes to ${pathBaseName(path)}?`,
    copy: untracked
      ? `${path} is a new file with no committed version — discarding deletes it. This cannot be undone.`
      : `${path} is restored to its last committed version. This cannot be undone.`,
    confirmLabel: 'Discard',
    tone: 'danger',
  }, () => sendContextRequest('git.discard.file', {
    repositoryPath: workspaceRootPath, file: path, untracked,
    reason: 'Discard requested from Version control', actor: 'human', confirmed: true,
  }, 'git-discard-file'));
}
```

## Test strategy

- Unit test for `discardFileChanges` against a real temporary git fixture (matching
  the existing style of `git-mutations`'s own tests): a modified tracked file reverts
  to its committed content; a deleted tracked file reappears; an untracked new file is
  removed from disk; a staged-but-uncommitted new file (status `A`, bucket `new`) is
  correctly unstaged-then-removed by the same `untracked: true` path (the `git reset`
  call handles unstaging regardless of whether the file was ever staged).
- Contract-test additions in `tests/desktop-ui-contract.test.ts`: the new menu markup
  exists in `index.html`; `openGitPendingFileContextMenu`/`closeGitPendingFileContextMenu`
  exist and are wired to `#git-pending-files`'s `contextmenu` event and the existing
  outside-click/Escape handlers.
- **Manual verification is mandatory before this task is called done**, in
  `npm run desktop:dev`, covering all three status buckets: a new untracked file
  (right-click → Discard changes → file is gone from disk and from the list), a
  modified tracked file (→ reverts to its last-committed content, confirmed by
  reopening it in the Editor), a deleted tracked file (→ reappears on disk).

## Boundaries

**Always:** run through `requestConfirmation` before any discard — never a
window.confirm, never silent. Reuse `pendingGitFiles`'/`gitStatusGlyph`'s existing
status classification rather than adding a second one.

**Ask first:** if manual verification shows `git checkout --`/`git clean -f` behaving
unexpectedly on a renamed file (renames currently collapse into the "modified" bucket
alongside ordinary edits, per `gitStatusGlyph` — this task does not add rename-specific
handling; report back rather than guessing at one).

**Never:** never touches the Editor's own `discardDocumentChanges()` (unsaved buffer
discard) — unrelated feature, same UI word "Discard" but a different mechanism, kept
deliberately separate per this spec's Objective. Never operates on more than one file
per invocation — the checkbox-driven bulk case belongs to a separate capability
(stash), not this one.
