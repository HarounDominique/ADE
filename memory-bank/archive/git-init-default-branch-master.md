# Archive: git-init-default-branch-master

## Summary

Assay's "Initialize Git repository" action now always creates a `master` branch,
regardless of the operator's global `init.defaultBranch` config — pinned via
`--initial-branch=master` on the underlying `git init` call
(`initializeRepository`, `src/application/git/git-mutations.ts`).

Satisfies: `memory-bank/specs/SPEC-git-init-default-branch-master.md` (fast-path).

## Deviations accepted

None.

## Reflection

Inline, in `memory-bank/tasks/git-init-default-branch-master.md` — fast-path task, no
separate reflection document per this project's SEED convention.
