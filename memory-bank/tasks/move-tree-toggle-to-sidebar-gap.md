---
slug: move-tree-toggle-to-sidebar-gap
spec: SPEC-move-tree-toggle-to-sidebar-gap.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Move the `toggle-explorer` button's markup from `.explorer-actions` to
  the `.brand` row (same positioning context as `.sidebar-collapse`), give it a new CSS
  class positioned via the existing `--sidebar-control-y` variable, centered
  horizontally, hidden under `.sidebar-collapsed`. No JS changes needed — the click
  handler is already delegated by `data-action`. Fast-path: single phase, no creative
  needed, purely visual/positional.
  (satisfies: SPEC-move-tree-toggle-to-sidebar-gap.md#objective, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; `npm test`; manual visual check in
  `npm run desktop:dev`.

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
