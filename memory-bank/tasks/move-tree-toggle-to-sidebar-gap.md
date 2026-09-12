---
slug: move-tree-toggle-to-sidebar-gap
spec: SPEC-move-tree-toggle-to-sidebar-gap.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Move the `toggle-explorer` button's markup from `.explorer-actions` to
  the `.brand` row (same positioning context as `.sidebar-collapse`), give it a new CSS
  class positioned via the existing `--sidebar-control-y` variable, centered
  horizontally, hidden under `.sidebar-collapsed`. No JS changes needed — the click
  handler is already delegated by `data-action`. Fast-path: single phase, no creative
  needed, purely visual/positional.
  (satisfies: SPEC-move-tree-toggle-to-sidebar-gap.md#objective, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; `npm test`; manual visual check in
  `npm run desktop:dev`.

## Execution State

**Build Status**: DONE
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- Step 2's initial test assertion for the new button's location was too loose
  (`<div class="brand">[\s\S]*data-action="toggle-explorer"[\s\S]*</div>` matched
  trivially against the whole rest of the document, passing before any change was made)
  — not a real RED. Rewritten to match the button's exact new attribute string before
  proceeding; confirmed genuinely RED, then GREEN after the move.

## Reflection (fast-path, inline)

Pure visual/positional move — no behavior change (`data-action` selector-based lookup in
`main.js` meant nothing needed updating there), reusing an existing CSS variable
mechanism end to end. The one real lesson: a regex RED test needs to actually fail for
the right reason, same discipline as any other TDD step — a loose regex here would have
let a no-op "test" through undetected. Not novel enough for its own learned rule.
