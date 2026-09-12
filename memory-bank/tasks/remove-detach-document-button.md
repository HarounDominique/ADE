---
slug: remove-detach-document-button
spec: SPEC-remove-detach-document-button.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Remove the button markup, its `detachActiveDocument()` wrapper, its
  dispatcher entry, and the `detachButton` lines in `setDocumentHeader`; update the
  existing contract test to drop only its two button-specific assertions. Fast-path:
  single phase, no creative needed.
  (satisfies: SPEC-remove-detach-document-button.md#objective, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; `npm test`.

## Execution State

**Build Status**: DONE
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

None — matched the spec exactly. Removing the button left the underlying
`detachDocument`/drag-to-detach subsystem completely untouched, confirmed by the full
regression suite staying green.

## Reflection (fast-path, inline)

Clean, single-phase removal — no design ambiguity, no gap surfaced. The one thing worth
carrying forward: this codebase's tab-drag-to-detach (`finishTabDrag`) and this button
both called the same `detachDocument(documentId)`, so removing a redundant UI entry
point was safe precisely because the underlying action was already factored out from
its triggers. General pattern, not novel enough here to warrant its own
`agent-rules/_learned/` entry on a single instance.
