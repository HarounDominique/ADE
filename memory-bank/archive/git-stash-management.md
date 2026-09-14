# Archive: git-stash-management

## Summary

Two related capabilities in `Version control > Changes`, both confirmed working end
to end by the operator: a **Stash** button beside `Commit` that stashes exactly the
checked files (`createStash`, always an explicit non-empty pathspec, never
"everything" — `--include-untracked` verified to correctly scope to only the given
files, not sweep up unrelated untracked ones), and a minimal **stash list** inside
`Repository actions` with per-entry **Apply** and **Drop** (`listStashes`,
`applyStash`, `dropStash`).

Satisfies: `memory-bank/specs/SPEC-git-stash-management.md` (both capabilities, all
sections).

## Deviations accepted

Phase 1 was review-blocked twice in the same phase — a rare double-block, past what
this workflow normally treats as its own stop-and-ask trigger; the operator was asked
explicitly and chose to let the fix proceed given both findings were distinct, real,
and already understood:
1. The confirmation copy referenced "Repository actions" before that surface
   existed — reverted to a terminal-command instruction for Phase 1, then correctly
   re-reverted back to referencing Repository actions once Phase 2 shipped it.
2. The success-response branch for `git-stash-create` was missing entirely — every
   sibling mutation (commit, push, fetch) had one, stash didn't, so a successful
   stash gave no feedback. Fixed, and explicitly re-scrutinized (and not repeated) for
   Phase 2's `apply`/`drop` mutations, which both passed review clean on the first
   attempt.

Both root-caused to gaps in the spec's own Style section, not either build phase's
execution of it — see the reflection for the extracted rule.

## Reflection

`memory-bank/reflection/git-stash-management.md` — bumped `mutating-operation-feedback`
(`agent-rules/_learned/spec-writing.md`) to evidence_count 3, with a concrete
refinement: a spec's Style section for any mutation must show both the dispatch and
its success-response branch, never just the dispatch.
