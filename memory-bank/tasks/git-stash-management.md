---
slug: git-stash-management
spec: SPEC-git-stash-management.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Stash the checked files. `createStash` mutation, `git.stash.create`
  sidecar dispatch, the `Stash` header button (disabled when nothing is checked,
  confirmation dialog, always an explicit `files` pathspec). Independently useful and
  testable without the list/apply/drop surface. (satisfies:
  SPEC-git-stash-management.md#structure, #style, capability 1)

  - `src/application/git/git-mutations.ts`: `createStash`.
  - `src/desktop-sidecar.ts`: `git.stash.create` dispatch.
  - `desktop/src/index.html`: `Stash` button beside `Commit`.
  - `desktop/src/main.js`: the button's click handler.

  Test strategy: unit test for `createStash` against a real temp git fixture —
  stashing a subset of files leaves an unchecked file's changes untouched, and a
  checked untracked file is actually swept up by `--include-untracked` (this is the
  spec's flagged unknown, verified here at the unit level first, before the manual
  pass); contract-test additions for the button's markup and disabled-state binding;
  full `npm test`.

- [ ] Phase 2 — Stash list, Apply, Drop. `listStashes` read query, `applyStash`/
  `dropStash` mutations, their sidecar dispatch, and the list surface inside
  `Repository actions` with per-entry Apply/Drop. Depends on Phase 1 only for the
  `Stash` button existing to have produced something to list — no shared code.
  (satisfies: SPEC-git-stash-management.md#structure, #style, capability 2)

  - `src/application/git/version-control.ts`: `listStashes`.
  - `src/application/git/git-mutations.ts`: `applyStash`, `dropStash`.
  - `src/desktop-sidecar.ts`: `git.stash.list` (read), `git.stash.apply`,
    `git.stash.drop` (confirmed mutations).
  - `desktop/src/index.html`: stash-list section inside the existing `Repository
    actions` disclosure, matching its established markup convention.
  - `desktop/src/main.js`: `renderStashList`, `applyStashFromUI`, `dropStashFromUI`
    (each behind its own confirmation, Drop tone `danger`, Apply tone default).

  Test strategy: unit tests for `listStashes` (parses a real multi-entry `git stash
  list` output), `applyStash` (restores files, stash entry remains), `dropStash`
  (entry removed); contract-test additions for the list markup and its wiring inside
  `Repository actions`; full `npm test`. **Mandatory manual verification for the whole
  task** (both phases together) in `npm run desktop:dev`: check two of three pending
  files including one untracked, Stash, confirm exactly those two disappear and the
  third remains untouched (this is where the `--include-untracked` pathspec-scoping
  unknown gets its real-environment confirmation); open Repository actions, confirm
  the entry lists with a sensible message; Apply it, confirm the two files reappear
  as pending; Drop a stash, confirm it's removed from the list.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

None yet.
