---
slug: fix-collapsed-sidebar-chevron-overlap
spec: SPEC-fix-collapsed-sidebar-chevron-overlap.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Offset `.sidebar-collapsed .sidebar-collapse`'s `top` further down than
  the raw `--sidebar-control-y` anchor, so the chevron clears the last nav icon instead
  of overlapping it. Expanded-state positioning untouched. Fast-path: single CSS fix,
  no creative needed.
  (satisfies: SPEC-fix-collapsed-sidebar-chevron-overlap.md#objective, #boundaries)
  Test strategy: visual confirmation by the operator in `npm run desktop:dev` (no
  automated CSS-position test exists in this repo's contract-test convention).

## Execution State

**Build Status**: DONE
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 1, 3: 1, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

None — matched the spec exactly.

## Reflection (fast-path, inline)

Diagnosed by reading `syncSidebarControlAnchor()`'s calculation rather than guessing: it
degrades to sitting exactly at the nav's bottom edge once the Explorer is hidden and the
nav's own bottom margin/border are zeroed in collapsed mode, so a translate(-50%,-50%)
button centered there necessarily overlaps upward. A pure CSS offset on top of the
existing JS-computed anchor was enough — no JS change needed. Not novel enough for its
own learned rule.
