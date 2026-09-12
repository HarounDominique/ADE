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

- [x] Phase 2 — Verification: full regression (`npm test`), then a manual pass by the
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

**Build Status**: DONE
**Current Phase**: 2
**Current Step**: 6/6
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: NO — all phases complete, operator confirmed the fix in `npm run
desktop:dev` after two verification rounds (see Deviations)

## Deviations

- Phase 1: none. Implemented from the spec's Style snippets essentially verbatim — a
  genuine "verified mirror" this time, unlike `offer-git-init-when-no-vcs`'s spec, whose
  own Style snippet was the bug. Review (step 4) additionally confirmed
  `requestConfirmation`/`notify` render via `.textContent`, not `innerHTML`, so the
  user-typed branch name reaching both carries no injection risk.

- Phase 2 manual verification: the operator reported clicking "+ New branch" did
  nothing. Root cause was in a pre-existing listener, not new code from this task:
  `desktop/src/main.js`'s outside-click-closes-the-menu handler checked
  `event.target.closest('.git-context-control')` — but `renderCreateBranchForm()`
  (an *earlier*-registered listener on the same click, same tick) replaces
  `branch-context-menu`'s `innerHTML` synchronously, which detaches the clicked button
  from the DOM. `closest()` on a detached node returns `null`, so the outside-click
  listener misread its own in-menu click as an outside one and closed the menu the
  instant it repainted with the form — invisible to the operator as "the click did
  nothing." Fixed by switching that check to `event.composedPath()`, which reflects the
  DOM tree as it was at dispatch time and is unaffected by a same-tick handler mutating
  it afterward. This fix is general (not scoped to the new branch-create buttons) — it
  also protects `data-cancel-create-branch`, and any future delegated handler that
  replaces a `.git-context-menu`'s content in place, from the identical failure.

- Phase 2 manual verification, round 2: branch creation worked, but reopening the
  dropdown afterward showed "No local branches found." Root cause: `for-each-ref
  --format=%(refname:short) refs/heads` (`inspectGitWorkspace`,
  `src/application/git/workspace-status.ts`) only lists refs that point at a real
  commit — a branch just `git switch -c`-ed on a repository with zero commits has no
  commit to point at yet, so it never appears there, even though `git branch
  --show-current` correctly reports it as current. Confirmed directly against real
  `git` before writing any fix (`git init && git switch -c x && git for-each-ref
  refs/heads` prints nothing). This is the same "zero-commit repository" bug class as
  `offer-git-init-when-no-vcs`'s rounds 3-4 (`git diff HEAD`, `git log`), a third
  independent git read path broken by the identical invariant, on a Project the
  operator had *just* run `git init` on in an earlier round of that same task's own
  manual verification — the exact scenario the reflection for that task named as
  "a state this codebase had never had before" is still surfacing new breakage a full
  task later. Fixed by having `inspectGitWorkspace` append the current branch to its
  returned list whenever `for-each-ref` omits it, so the dropdown shows the branch the
  operator is actually on instead of claiming none exist.
