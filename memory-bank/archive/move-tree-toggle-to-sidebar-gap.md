# Archive: move-tree-toggle-to-sidebar-gap

**Spec**: `memory-bank/specs/SPEC-move-tree-toggle-to-sidebar-gap.md`
**Task**: `memory-bank/tasks/move-tree-toggle-to-sidebar-gap.md` (fast-path, inline reflection)
**Branch**: `task/move-tree-toggle-to-sidebar-gap`

## What was built

Moved the workspace-tree expand/collapse arrow (`data-action="toggle-explorer"`) out of
`.explorer-actions` (the row with New/Reveal/Refresh) into the thin floating strip
between the navigation tabs and the Explorer section — the same gap `.sidebar-collapse`
already occupies via the existing `--sidebar-control-y` CSS variable, centered
horizontally instead of pinned to the right edge. Hidden under `.sidebar-collapsed`,
matching the Explorer section it controls. No JS changes: the click handler already
looks the button up by `data-action`, not position or DOM parent.

## Satisfies

`SPEC-move-tree-toggle-to-sidebar-gap.md` — Objective and Boundaries, in full. Confirmed
visually correct by the operator in the running dev app.

## Deviations accepted

The first RED test's regex was too loose (matched trivially before any change) — caught
and rewritten to genuinely fail for the right reason before proceeding. No functional
deviations; matched the spec exactly.
