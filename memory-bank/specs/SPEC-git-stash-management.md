# SPEC: Stash the checked files, and manage existing stashes

status: approved

## Objective

Two related capabilities in `Version control > Changes`, both approved by the
operator as in-scope together:

1. A **Stash** button in the persistent header, next to `Commit` — stashes exactly
   the files currently checked via `pendingCommitSelection` (the same selection
   `Commit` already reads), never the whole working tree regardless of what else is
   unchecked. Disabled when nothing is checked, mirroring `Commit`'s own guard.
2. A minimal **stash list** inside the `Repository actions` disclosure (where the
   app's other less-frequent git operations already live — branches, worktrees,
   GitHub/PR) showing existing stashes with **Apply** and **Drop** per entry. No diff
   preview of a stash's contents in this cut — out of scope, noted in Boundaries.

## Commands

`npm test`; `npm run build`; `npm run desktop:dev`; `git stash list` (manual
verification against a real repo).

## Structure

- **`src/application/git/git-mutations.ts`**: three new mutations, same
  `ConfirmedOperation` contract as every existing one —
  - `createStash({ files: string[]; message?: string; ... })` — always requires an
    explicit, non-empty `files` array (unlike `createCommit`, which treats an omitted
    `files` as "everything"; stash's whole contract is "only what's checked", so there
    is no "everything" fallback to omit into).
  - `applyStash({ ref: string; ... })`.
  - `dropStash({ ref: string; ... })`.
- **`src/application/git/version-control.ts`**: new read query `listStashes(directory)`
  — runs plain `git stash list` (not `--format`, which isn't reliably supported the
  same way `git log --format` is across stash's own reflog-backed listing) and parses
  each line's standard `stash@{N}: <description>` shape with a regex, returning
  `{ ref: string; message: string }[]`.
- **`src/desktop-sidecar.ts`**: `git.stash.create` (confirmed mutation, alongside
  `git.commit.create`), `git.stash.apply`, `git.stash.drop` (confirmed mutations,
  simple params `{repositoryPath, ref, actor, reason, confirmed}`), `git.stash.list`
  (a read, alongside `git.pending`/`git.history` — no confirmation needed).
- **`desktop/src/index.html`**: a `Stash` button beside `Commit` in the Changes
  header; a stash-list section inside the existing `Repository actions` disclosure
  (its own markup convention — read that section first and match it, not invent a new
  disclosure).
- **`desktop/src/main.js`**: `stashCheckedFiles()` (button handler, confirmation →
  `git.stash.create` with `files: [...pendingCommitSelection]`, always explicit,
  disabled state driven by `pendingCommitSelection.size === 0` exactly like `Commit`'s
  own guard at the `git-commit-form` submit handler); `renderStashList(stashes)` and
  `applyStashFromUI(ref)`/`dropStashFromUI(ref)` (each behind their own
  `requestConfirmation`, `Drop` tone `danger` since irreversible, `Apply` tone default
  since recoverable but can produce conflicts the operator should expect).

## Style

Backend, `git-mutations.ts` (stash push scoped to an explicit pathspec, including
untracked files that were checked):

```ts
export async function createStash(
  input: ConfirmedOperation & { files: string[]; message?: string },
) {
  assertConfirmed(input);
  if (!input.files.length) throw new Error("Stash requires at least one file");
  const message = input.message ?? `Stashed from Assay (${input.files.length} file${input.files.length === 1 ? "" : "s"})`;
  const result = await executeGit(
    ["stash", "push", "--include-untracked", "-m", message, "--", ...input.files],
    { cwd: input.directory },
  );
  return { operation: "stash.create", message, output: result.stdout.trim(), actor: input.actor, reason: input.reason };
}

export async function applyStash(input: ConfirmedOperation & { ref: string }) {
  assertConfirmed(input);
  const result = await executeGit(["stash", "apply", input.ref], { cwd: input.directory });
  return { operation: "stash.apply", ref: input.ref, output: result.stdout.trim(), actor: input.actor, reason: input.reason };
}

export async function dropStash(input: ConfirmedOperation & { ref: string }) {
  assertConfirmed(input);
  await executeGit(["stash", "drop", input.ref], { cwd: input.directory });
  return { operation: "stash.drop", ref: input.ref, actor: input.actor, reason: input.reason };
}
```

Read query, `version-control.ts`:

```ts
const STASH_LINE = /^(stash@\{\d+\}):\s(.*)$/;

export async function listStashes(directory: string) {
  const result = await executeGit(["stash", "list"], { cwd: directory });
  return result.stdout.split("\n").filter(Boolean).map((line) => {
    const match = STASH_LINE.exec(line);
    return match ? { ref: match[1], message: match[2] } : { ref: line, message: "" };
  });
}
```

Frontend button guard (`desktop/src/main.js`, mirroring the `git-commit-form`
handler's own `pendingCommitSelection.size` check):

```js
document.getElementById('git-stash-checked')?.addEventListener('click', () => {
  if (!pendingCommitSelection.size) { notify('Select at least one file to stash.'); return; }
  const files = [...pendingCommitSelection];
  requestConfirmation({
    eyebrow: 'STASH',
    title: `Stash ${files.length} file${files.length === 1 ? '' : 's'}?`,
    copy: 'Checked changes are moved out of the working tree. Recover them with git stash pop or git stash apply from a terminal.',
    confirmLabel: 'Stash',
  }, () => sendContextRequest('git.stash.create', {
    repositoryPath: workspaceRootPath, files,
    reason: 'Stash requested from Version control', actor: 'human', confirmed: true,
  }, 'git-stash-create'));
});
```

Corrected 2026-09-14, found in Phase 1 review: this copy originally referenced
"Repository actions" as where to apply a stash back — that surface doesn't exist
until Phase 2. Phase 2 must update this string once the stash list actually ships,
back to pointing at it (`Repository actions`) instead of the terminal instruction
above — tracked as part of Phase 2's own scope, not a separate task.

Also added in the same review pass: the success-response branch in the sidecar
response listener (`desktop/src/main.js`), matching every sibling mutation
(`git-commit-local`, `git-push-origin`, `git-fetch`) — the original Style section
omitted this and the request-dispatch snippet's own `.catch()` only covers transport
failure, not git failure or (silently) success:

```js
if (contextPurpose === 'git-stash-create' && response.result?.operation === 'stash.create') {
  notify(response.result.message ?? 'Changes stashed.');
  requestVersionControlData(workspaceRootPath, { force: true });
  return;
}
```

Plus a `'git-stash-create': 'stash'` entry in `operationErrorCopy`'s purpose map, so a
failure reads "Assay could not stash." instead of the generic fallback.

## Test strategy

- Unit tests for `createStash`/`applyStash`/`dropStash`/`listStashes` against a real
  temporary git fixture: stashing a subset of two modified files leaves the third
  file's changes untouched in the working tree; stashing a checked untracked file
  actually removes it (proving `--include-untracked` behaves as expected against this
  environment's real git — flagged as a genuine unknown until proven, see Boundaries);
  `listStashes` parses a real multi-entry `git stash list` output correctly; `apply`
  restores the files without removing the stash entry; `drop` removes the entry.
- Contract-test additions in `tests/desktop-ui-contract.test.ts`: the `Stash` button
  exists and is disabled when `pendingCommitSelection` is empty (mirroring the
  existing `Commit`-disabled-state contract test if one exists — reuse its pattern);
  the stash-list markup exists inside `Repository actions`; `git.stash.*` methods are
  registered in the sidecar dispatch.
- **Manual verification is mandatory before this task is called done**, in
  `npm run desktop:dev`: check two of three pending files (including one untracked
  new file), Stash, confirm exactly those two disappear from Changes and the third
  remains; open Repository actions, confirm the stash entry lists with a sensible
  message; Apply it, confirm the two files reappear as pending changes again; Drop a
  stash, confirm it's removed from the list.

## Boundaries

**Always:** `Stash` sends an explicit `files` pathspec, never omits it — the button's
entire contract is "only what's checked," unlike `Commit`'s "everything unless
narrowed" default.

**Ask first:** `--include-untracked` combined with an explicit pathspec has had
version-dependent git behavior in the past (older git releases could stash *all*
untracked files rather than only the pathspec'd ones). This spec assumes current git
handles it correctly (scoped to the given pathspec) but that is unverified until the
manual test above actually checks a third, unchecked, untracked file is *not* swept up
— if it is, report back rather than shipping a silent over-broad stash.

**Never:** no diff preview of a stash's contents in this cut — Apply/Drop act on the
whole stash entry, sight-unseen beyond its one-line message. No stash rename/edit-
message action. Never blocks `Commit` or `Push origin` — stash is an independent,
optional action on the same checkbox state, not a required step in either flow.
