---
slug: create-branch-from-dropdown
spec: SPEC-create-branch-from-dropdown.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Frontend: `renderBranchMenu()` prepends the "+ New branch" trigger;
  `renderCreateBranchForm()` swaps the popover to the inline name form; two new
  delegated-click entries (trigger, cancel); `createBranchFromDropdown(name)` mirroring
  `switchBranchFromContext`; the `'create-branch-from-dropdown'` response branch
  mirroring `switch-branch`'s. No sidecar changes — `git.branch.create` already exists,
  already tested. No creative needed — every piece mirrors an already-proven pattern in
  this same file, verified correct (not just similar-looking) per the
  mirror-pattern-verification rule this spec cites.
  (satisfies: SPEC-create-branch-from-dropdown.md#objective, #structure, #style)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions in
  `tests/desktop-ui-contract.test.ts` for the trigger/cancel/form/dispatch wiring, same
  phase, per this session's convention.

- [ ] Phase 2 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (open a Project with Git, open the branch dropdown,
  click "+ New branch", type a name, confirm; verify the current-branch label, the
  dropdown's list, and the version-control view all reflect the new branch without a
  manual reload; verify Cancel returns to the branch list without dispatching anything;
  verify an empty/whitespace-only name does not open the confirmation dialog) before
  reporting the task done. No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-create-branch-from-dropdown.md#test-strategy, #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: RUNNING
**Current Phase**: 2
**Current Step**: 3/6
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- Phase 1: none. Implemented from the spec's Style snippets essentially verbatim — a
  genuine "verified mirror" this time, unlike `offer-git-init-when-no-vcs`'s spec, whose
  own Style snippet was the bug. Review (step 4) additionally confirmed
  `requestConfirmation`/`notify` render via `.textContent`, not `innerHTML`, so the
  user-typed branch name reaching both carries no injection risk.
