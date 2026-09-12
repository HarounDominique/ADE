---
slug: remove-detach-document-button
spec: SPEC-remove-detach-document-button.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Remove the button markup, its `detachActiveDocument()` wrapper, its
  dispatcher entry, and the `detachButton` lines in `setDocumentHeader`; update the
  existing contract test to drop only its two button-specific assertions. Fast-path:
  single phase, no creative needed.
  (satisfies: SPEC-remove-detach-document-button.md#objective, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; `npm test`.

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
