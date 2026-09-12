# Reflection: explorer-delete-and-rename

## Step 1 — Implementation vs. spec

Everything in `SPEC-explorer-delete-and-rename.md` shipped and was confirmed working by
the operator on the first manual-verification pass — the first of the three Explorer
tasks where that pass found nothing left to fix. All Boundaries held: permanent delete
behind a danger-toned confirmation, both new commands jailed via `WorkspaceRoot::resolve()`,
rename reuses `validate_new_entry_name`, no silent overwrite, no automatic/implicit
delete, empty-tree-space right-click still shows only New File/New Directory.

Two deviations, both caught in review, neither shipped:

1. **Phase 1**: `rename_workspace_entry_in`'s first draft computed the destination's
   parent from a bare `source.parent()`, never re-resolving it through
   `WorkspaceRoot::resolve()`. Unreachable from today's UI (rename is never offered on
   the Project root), but the backend command must not depend on the frontend never
   sending that path. Fixed with a new test before commit.
2. **Phase 3**: the first draft cleared `selectedDirectoryPath` on an affecting delete/
   rename but forgot `selectedFilePath` — the exact stale-state shape
   `agent-rules/_learned/spec-writing.md#mutating-operation-feedback` (extracted from the
   *previous* task) warns about. This time it was caught **in review, before the
   operator ever saw it** — direct evidence that rule is doing its job now that it
   exists, not just a restatement of the same mistake. Bumped that rule's
   `evidence_count` rather than writing a new one.

## Step 2 — Workflow evaluation

- **Complexity routing**: "standard" tier fit — no open design decision (the two real
  judgment calls, permanent-vs-trash delete and the tab-follow/close behaviors, were
  resolved during spec review with the operator, not left for a creative pass). Not
  mis-routed.
- **Sharding**: no build step needed context its own step file lacked.
- **Spec correction mid-build**: none. This is the first of the three Explorer tasks
  where the operator's manual-verification pass raised zero follow-up fixes — plausible
  evidence that asking the "what feedback confirms success, what state follows the
  mutated path" question explicitly during spec-writing (per the same learned rule) is
  paying off, rather than discovering the gap after ship.
- **Effect of accumulated `agent-rules/_learned/` across this three-task arc**: each task
  caught issues one step earlier than the last — task 1 shipped a gap the operator found
  after using it; task 2 caught one gap in review and one still reached the operator;
  task 3 caught both of its gaps in review, and the operator found nothing. Worth
  watching whether this trend holds on a fourth task, or whether it's just this
  particular class of bug (stale references after a mutation) now being over-fitted to.

## Step 3 — Patterns extracted

No new topic file. Updated existing entry:

- `spec-writing.md#mutating-operation-feedback` — `evidence_count` 1 → 2,
  `last_validated` bumped to 2026-09-12, noting the second occurrence was self-caught in
  review rather than operator-caught.
