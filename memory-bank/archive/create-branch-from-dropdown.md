# Archive: create-branch-from-dropdown

## Summary

Added a "+ New branch" entry to the top of the topbar's branch dropdown. Choosing it
swaps the popover in place for an inline name form (no new dialog); submitting opens
the standard "GIT OPERATION" confirmation, then runs the sidecar's existing
`git.branch.create` (`git switch -c <name>`) and refreshes the branch label, dropdown
list, and version-control view once the mutation has genuinely completed.

Satisfies: `memory-bank/specs/SPEC-create-branch-from-dropdown.md` (all sections).

## What was built

- **`desktop/src/main.js`**: `renderBranchMenu()` prepends the trigger;
  `renderCreateBranchForm()` swaps the menu to the inline form; delegated click entries
  for the trigger and Cancel; `createBranchFromDropdown(name)` mirroring
  `switchBranchFromContext`; a `'create-branch-from-dropdown'` response branch mirroring
  `switch-branch`'s. No sidecar changes — `git.branch.create` already existed.
- **`desktop/src/styles.css`**: inline-form and trigger styling reusing existing tokens.
- Two bugs found and fixed during manual verification (full detail in
  `memory-bank/tasks/create-branch-from-dropdown.md`'s `## Deviations`):
  1. A pre-existing outside-click-closes-the-menu listener misread its own in-menu
     click as an outside click once this task's handler started replacing the menu's
     content in place — fixed by switching that listener to `event.composedPath()`.
  2. `inspectGitWorkspace`'s `for-each-ref` call couldn't see a just-created branch on
     a zero-commit repository — the third independent git read path this session found
     broken by that same invariant — fixed by falling back to the current branch when
     `for-each-ref` omits it.
- A related, separately-shipped fix (`git-init-default-branch-master`, already merged)
  pinned Assay's own `git init` to create `master` rather than inheriting the
  operator's global `init.defaultBranch` — reported by the operator during this task's
  manual verification, tracked and closed as its own task since it was unrelated to
  branch creation itself.

## Deviations accepted

Two, both root-caused and fixed within this task; see the task file for full detail.
Confirmed working by the operator after both fixes.

## Reflection

See `memory-bank/reflection/create-branch-from-dropdown.md`. Both bugs were genuinely
undiscoverable before manual verification — one a DOM-timing interaction between two
listeners this repo's string-match test strategy cannot see, the other requiring a live
zero-commit repository that only exists once an operator walks through git-init and
branch-create back to back. `mirror-pattern-verification`
(`agent-rules/_learned/spec-writing.md`) bumped to evidence_count 2; a new entry added
to `desktop-webview-constraints.md` for the detached-target click hazard.
