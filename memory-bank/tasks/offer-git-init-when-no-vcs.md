---
slug: offer-git-init-when-no-vcs
spec: SPEC-offer-git-init-when-no-vcs.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Sidecar: `initializeRepository` in `src/application/git/git-mutations.ts`
  (mirrors `fetchOrigin`'s shape exactly), `"git.init"` added to the existing confirmed-
  mutation method array in `src/desktop-sidecar.ts`. Rust/backend unaffected — this is
  entirely in the Node sidecar, same as every other Git mutation. No creative needed —
  direct mirror of an established pattern.
  (satisfies: SPEC-offer-git-init-when-no-vcs.md#structure, #style, #test-strategy — sidecar half)
  Test strategy: `npm run build` (tsc); `node --import tsx --test tests/git-mutations.test.ts`.

- [x] Phase 2 — Frontend: `renderSnapshot`'s branch-button `branchable`/`title` logic
  drops the `hasGit` requirement; `toggleGitContextMenu` drops its no-git early return
  and renders an "Initialize Git repository" option instead of the branch list in that
  state; new `init-git-repository` dispatcher entry (confirm → `sidecar_request` →
  `refreshProjectContext`). No creative needed — mirrors the existing
  create-branch/push-origin dispatcher shape exactly.
  (satisfies: SPEC-offer-git-init-when-no-vcs.md#objective, #structure, #style — frontend half)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions for the
  changed `branchable` condition, the dropped guard, and the new dispatcher entry, in
  this same phase per the convention every prior task in this session has used.

- [ ] Phase 3 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (open/create a Project with no `.git`, confirm the
  branch button is enabled with only "Initialize Git repository" in its dropdown,
  confirm the dialog, confirm the branch name/commit/push buttons and version-control
  view all update to the git-aware state without a manual reload) before reporting the
  task done. No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-offer-git-init-when-no-vcs.md#test-strategy, #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

[Anything a build phase did differently from what the spec/plan predicted, and whether
it was accepted, and by whom.]
