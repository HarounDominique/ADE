---
slug: handle-git-repository-removed
spec: SPEC-handle-git-repository-removed.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Sidecar: `GitRepositoryMissingError` + `isInsideGitWorkTree`
  (`src/adapters/git-command.ts`); up-front guards in `inspectGitWorkspace`
  (`workspace-status.ts`) and `inspectPendingGitChanges` (`version-control.ts`);
  `gitError()` mapping (`desktop-sidecar.ts`). No creative needed — mirrors
  `GitUnavailableError`'s existing shape exactly.
  (satisfies: SPEC-handle-git-repository-removed.md#structure, #style — sidecar half)
  Test strategy: `npm run build`; `node --import tsx --test tests/version-control.test.ts
  tests/desktop-sidecar.test.ts`.

- [x] Phase 2 — Frontend: `GIT_REPOSITORY_MISSING` branch in the `sidecar:response`
  listener, calling `refreshProjectContext` + a plain `notify()` instead of
  `showOperationError`. No creative needed — reuses the exact re-sync path
  `initGitRepositoryFromUI` already established.
  (satisfies: SPEC-handle-git-repository-removed.md#structure, #style — frontend half)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions in
  `tests/desktop-ui-contract.test.ts`.

- [ ] Phase 3 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (delete `.git` from an open Project outside Assay,
  confirm no crash dialog, confirm the topbar reverts to "Initialize Git repository",
  confirm a plain notification appears instead of a modal) before reporting the task
  done. No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-handle-git-repository-removed.md#test-strategy, #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: RUNNING
**Current Phase**: 2
**Current Step**: 5/6
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- Phase 1: `inspectGitWorkspace` had no existing test coverage at all (neither happy path
  nor error path) before this task — added `tests/workspace-status.test.ts` from
  scratch with both, rather than only the new guard case, since exercising a guard with
  zero coverage of the function it guards would leave the happy path unverified.

- Phase 2: the first RED assertion for the frontend branch used a regex that tried to
  extract the matched `if` block's body as a substring, and never matched real source
  (a comment between the `if` and the body broke the capture window). Simplified to two
  direct assertions — the branch calls `refreshProjectContext` within a few lines of its
  own literal string, and its source position is strictly before
  `showOperationError(response.error, contextPurpose);` — rather than one fragile
  block-extraction regex. Caught immediately by running GREEN and getting an unexpected
  empty-match failure, not by the operator.

- Phase 2 review: confirmed `refreshGitWorkspace`'s pre-existing `activeVersionControl
  === 'none'` guard makes the fix self-terminating — once `refreshProjectContext` re-syncs
  the live state, the 1.2s background poll (`requestPendingGitChanges`) stops reaching
  `git.pending` on its own, no additional de-duplication needed.
