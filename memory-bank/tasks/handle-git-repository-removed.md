---
slug: handle-git-repository-removed
spec: SPEC-handle-git-repository-removed.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Sidecar: `GitRepositoryMissingError` + `isInsideGitWorkTree`
  (`src/adapters/git-command.ts`); up-front guards in `inspectGitWorkspace`
  (`workspace-status.ts`) and `inspectPendingGitChanges` (`version-control.ts`);
  `gitError()` mapping (`desktop-sidecar.ts`). No creative needed — mirrors
  `GitUnavailableError`'s existing shape exactly.
  (satisfies: SPEC-handle-git-repository-removed.md#structure, #style — sidecar half)
  Test strategy: `npm run build`; `node --import tsx --test tests/version-control.test.ts
  tests/desktop-sidecar.test.ts`.

- [ ] Phase 2 — Frontend: `GIT_REPOSITORY_MISSING` branch in the `sidecar:response`
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

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

[Anything a build phase did differently from what the spec/plan predicted, and whether
it was accepted, and by whom.]
