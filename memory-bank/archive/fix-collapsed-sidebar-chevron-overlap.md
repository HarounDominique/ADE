# Archive: fix-collapsed-sidebar-chevron-overlap

**Spec**: `memory-bank/specs/SPEC-fix-collapsed-sidebar-chevron-overlap.md`
**Task**: `memory-bank/tasks/fix-collapsed-sidebar-chevron-overlap.md` (fast-path, inline reflection)
**Branch**: `task/fix-collapsed-sidebar-chevron-overlap`

## What was built

Fixed the sidebar-collapse chevron overlapping the last nav icon when the sidebar itself
is collapsed. `syncSidebarControlAnchor()`'s gap-center calculation degrades to sitting
exactly at the nav's bottom edge once the Explorer is `display:none` and the nav's own
bottom margin/border are zeroed in collapsed mode — a CSS-only offset pushes the
collapsed-state chevron further down than that raw anchor point, clearing the nav icon.
The expanded state, where a real gap exists and the anchor computation is already
correct, is untouched.

## Satisfies

`SPEC-fix-collapsed-sidebar-chevron-overlap.md` — Objective and Boundaries, in full.
Confirmed visually correct by the operator in the running dev app.

## Deviations accepted

None — matched the spec exactly.
