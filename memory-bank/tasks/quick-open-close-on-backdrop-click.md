---
slug: quick-open-close-on-backdrop-click
spec: SPEC-quick-open-close-on-backdrop-click.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — `closeDialogOnBackdropClick`, attached to both `quick-open-dialog` and
  `recent-files-dialog`. Fast-path: single small shared handler, no creative needed.
  (satisfies: SPEC-quick-open-close-on-backdrop-click.md#objective, #structure, #style)
  Test strategy: `node --check desktop/src/main.js`; contract-test addition; full
  `npm test`; manual pass in `npm run desktop:dev`.

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
