---
slug: fix-collapsed-sidebar-chevron-overlap
spec: SPEC-fix-collapsed-sidebar-chevron-overlap.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Offset `.sidebar-collapsed .sidebar-collapse`'s `top` further down than
  the raw `--sidebar-control-y` anchor, so the chevron clears the last nav icon instead
  of overlapping it. Expanded-state positioning untouched. Fast-path: single CSS fix,
  no creative needed.
  (satisfies: SPEC-fix-collapsed-sidebar-chevron-overlap.md#objective, #boundaries)
  Test strategy: visual confirmation by the operator in `npm run desktop:dev` (no
  automated CSS-position test exists in this repo's contract-test convention).

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

[Anything a build phase did differently from what the spec/plan predicted, and whether
it was accepted, and by whom.]
