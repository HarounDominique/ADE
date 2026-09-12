# Archive: explorer-delete-and-rename

**Spec**: `memory-bank/specs/SPEC-explorer-delete-and-rename.md`
**Task**: `memory-bank/tasks/explorer-delete-and-rename.md`
**Reflection**: `memory-bank/reflection/explorer-delete-and-rename.md`
**Branch**: `feature/explorer-delete-and-rename`

## What was built

The last of the Explorer's core file-management basics — Delete and Rename, alongside
New File/New Directory and drag-and-drop move built in the two prior tasks:

- **Backend**: `delete_workspace_entry` (permanent — `remove_file` or `remove_dir_all`
  by entry kind) and `rename_workspace_entry` (reuses `validate_new_entry_name`, resolves
  the destination's parent through the jail rather than trusting a bare `.parent()`),
  both resolving the existing path via `WorkspaceRoot::resolve()`.
- **Frontend**: the context menu now distinguishes an existing-entry target (file or
  directory right-clicked) from a create-only target (empty tree space, or the toolbar's
  "New" button) — Rename/Delete only appear for the former. Delete confirms (danger
  tone) then force-closes any editor tab nested under the deleted path. Rename updates an
  open file's tab in place; renaming a directory closes tabs nested under it instead of
  rewriting every path. `selectedFilePath`/`selectedDirectoryPath` are cleared or follow
  the change on both operations.

## Satisfies

`SPEC-explorer-delete-and-rename.md` — Objective, Structure, Style, Test strategy, and
Boundaries, in full.

## Deviations accepted

1. Phase 1 review: `rename_workspace_entry_in`'s destination parent is re-resolved
   through `WorkspaceRoot::resolve()` rather than trusted from a bare `.parent()` —
   unreachable from today's UI, but the backend must not depend on that. Fixed before
   commit, with a new test covering it.
2. Phase 3 review: `selectedFilePath` (not just `selectedDirectoryPath`) is now cleared
   or followed on both delete and rename — the second occurrence of the
   mutating-operation-feedback gap-shape from the prior task, this time caught in review
   before the operator saw it. The operator's Phase 4 manual pass raised zero follow-ups
   — the first task in this three-task Explorer arc where that happened.

## Follow-up

None outstanding for the Explorer's file-management basics. Explicitly out of scope, per
the spec's Boundaries: OS-trash/recoverable delete, keyboard shortcuts (Delete/F2),
multi-select delete/rename, and rewriting nested tab paths on directory rename.
