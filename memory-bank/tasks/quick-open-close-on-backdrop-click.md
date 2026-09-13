---
slug: quick-open-close-on-backdrop-click
spec: SPEC-quick-open-close-on-backdrop-click.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — `closeDialogOnBackdropClick`, attached to both `quick-open-dialog` and
  `recent-files-dialog`. Fast-path: single small shared handler, no creative needed.
  (satisfies: SPEC-quick-open-close-on-backdrop-click.md#objective, #structure, #style)
  Test strategy: `node --check desktop/src/main.js`; contract-test addition; full
  `npm test`; manual pass in `npm run desktop:dev`.

## Execution State

**Build Status**: DONE
**Current Phase**: 1
**Current Step**: 6/6
**Step Attempts**: {2: 1, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: NO — complete, awaiting operator confirmation in `npm run desktop:dev`

## Deviations

None.

## Reflection (inline, fast-path)

Standard `<dialog>` backdrop-click pattern (`event.target === event.currentTarget`),
scoped to exactly the two popups asked about. No new rule — a well-known pattern, not
a recurring failure mode.
