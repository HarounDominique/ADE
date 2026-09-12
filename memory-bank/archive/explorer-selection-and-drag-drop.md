# Archive: explorer-selection-and-drag-drop

**Spec**: `memory-bank/specs/SPEC-explorer-selection-and-drag-drop.md`
**Task**: `memory-bank/tasks/explorer-selection-and-drag-drop.md`
**Creative**: `memory-bank/creative/explorer-selection-and-drag-drop-ui-ux.md`
**Reflection**: `memory-bank/reflection/explorer-selection-and-drag-drop.md`
**Branch**: `feature/explorer-selection-and-drag-drop`

## What was built

Two follow-ups to the Explorer's New File / New Directory feature:

1. **Directory selection**: clicking a directory now marks it "selected" (same visual
   treatment as the open-file highlight) in addition to its existing expand/collapse
   toggle. `relevantWorkspaceDirectory()` targets it ahead of the open file's parent.
   Cleared when a file is opened or a different directory is clicked.
2. **Drag-and-drop move**: a file or directory can be dragged onto another directory (or
   onto empty tree space, to move it to the Project root) to move it there immediately,
   with a toast on success or failure — no confirmation dialog. Built with the same
   mousedown/mousemove/mouseup + ghost-element mechanism already used for detaching a
   document tab into its own window, not native HTML5 drag events (see Deviations).
3. **Visual feedback fix** (added during Phase 5 manual verification, at the operator's
   request): creating or moving an entry into a directory now expands that directory in
   the tree, so the result is visible immediately instead of landing invisibly nested
   under a re-collapsed folder.

Backend: `move_workspace_entry` resolves both the source and destination directory
independently through `WorkspaceRoot::resolve()`, rejects moving a directory into itself
or a descendant, rejects a name collision at the destination, and is a no-op when dropped
back into its current parent.

## Satisfies

`SPEC-explorer-selection-and-drag-drop.md` — Objective, Structure, Style, Test strategy,
and Boundaries, in full.

## Deviations accepted

1. The approved creative doc originally specified native HTML5 `draggable`/`dragover`/
   `drop` events. The full contract-test batch caught that this codebase had already
   tried exactly that for tab-detaching and abandoned it (unreliable in this Tauri
   WebView), with a standing test guarding against reintroducing it. Rebuilt on the
   proven mousedown/mousemove/mouseup + ghost pattern; the approved visual design was
   unchanged. Creative doc amended in place with a correction note.
2. A dragged, currently-selected directory now has `selectedDirectoryPath` follow it to
   its new path on a successful move (caught and fixed during Phase 4 review).
3. Creating or moving an entry into a directory now expands that directory in the tree
   (caught by the operator during Phase 5 manual verification, fixed the same phase).
4. Every "JetBrains"-style wording introduced by this task and the prior one was scrubbed
   from specs, tests, and docs after the operator asked that no brand/licensed-product
   name ever land in repo content — replaced with generic descriptions of the actual
   convention. See commit `docs: describe Explorer create/drag-drop conventions
   generically`. A few pre-existing, unrelated mentions (a real CSS font-family value,
   and an older theme-integration doc, neither introduced by this task) were flagged to
   the operator rather than changed unilaterally.
