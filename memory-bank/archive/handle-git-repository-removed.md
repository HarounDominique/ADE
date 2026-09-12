# Archive: handle-git-repository-removed

## Summary

A Project's `.git` directory can be deleted outside Assay (Finder, terminal, another
tool) while it is still the active Project. Every Git read path assumed it still
existed and let the raw `git` failure ("fatal: not a git repository") surface as a
modal "Operation could not be completed" error — including unprompted, from the 1.2s
background pending-changes poll. Fixed by detecting the missing repository up front and
recovering gracefully instead.

Satisfies: `memory-bank/specs/SPEC-handle-git-repository-removed.md` (all sections).

## What was built

- **`src/adapters/git-command.ts`**: `GitRepositoryMissingError` (mirrors the existing
  `GitUnavailableError` exactly) and `isInsideGitWorkTree(directory)`.
- **`src/application/git/workspace-status.ts`** / **`version-control.ts`**:
  `inspectGitWorkspace` and `inspectPendingGitChanges` both check
  `isInsideGitWorkTree` up front and throw the typed error instead of letting any of
  their underlying `executeGit` calls fail raw. `readPendingGitDiff` inherits the guard
  through `inspectPendingGitChanges`. `listGitCommits` needed no change — its existing
  zero-commit guard (from `offer-git-init-when-no-vcs`) already happened to cover this
  case too.
- **`src/desktop-sidecar.ts`**: `gitError()` maps `GitRepositoryMissingError` to a new
  `GIT_REPOSITORY_MISSING` code, alongside its existing `GIT_UNAVAILABLE` mapping.
- **`desktop/src/main.js`**: the generic `sidecar:response` error handler recognizes
  `GIT_REPOSITORY_MISSING` and calls `refreshProjectContext` (the same re-sync
  `initGitRepositoryFromUI` already uses) plus a plain `notify()`, instead of falling
  through to the modal `operation-error-dialog` — deliberately never a modal, since this
  can fire with no operator action in progress.
- **`tests/workspace-status.test.ts`** (new file — `inspectGitWorkspace` had no prior
  coverage at all), plus additions to `tests/version-control.test.ts`,
  `tests/desktop-sidecar.test.ts` (a real spawned-process round trip), and
  `tests/desktop-ui-contract.test.ts`.

## Deviations accepted

Two minor deviations, both caught in-build rather than by the operator; full detail in
`memory-bank/tasks/handle-git-repository-removed.md`'s `## Deviations`. No user-facing
follow-up rounds — confirmed working on the first manual pass.

## Reflection

See `memory-bank/reflection/handle-git-repository-removed.md`. One rule appended to the
existing `stale-cached-state.md` topic (`read-paths-must-tolerate-external-drift`): the
mirror image of `offer-git-init-when-no-vcs`'s finding — a read path must not trust its
cached understanding of external state (here, the filesystem) any more than a mutation
may leave its own cache stale.
