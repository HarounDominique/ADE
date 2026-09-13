---
slug: go-to-file-popup
spec: SPEC-go-to-file-popup.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Frontend: `quick-open-dialog` markup in `index.html`; global keydown
  trigger (`Ctrl+Shift+N`/`Cmd+Shift+O`); `scheduleQuickOpenSearch`/
  `runQuickOpenSearch` mirroring the Explorer's existing search shape; keyboard nav
  (arrows/Enter/Escape); row selection calling `openFileInADE`; CSS for the results
  list. No backend change — `search_directory` already exists and is already tested.
  No creative needed — mirrors this session's established dialog and debounced-search
  patterns.
  (satisfies: SPEC-go-to-file-popup.md#objective, #structure, #style)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions in
  `tests/desktop-ui-contract.test.ts`, same phase per this session's convention.

- [ ] Phase 2 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (open the popup from anywhere in the app on either
  bound shortcut; confirm live filtering, arrow-key navigation, Enter/click both open
  and close, Escape closes without opening, directories never appear in results).
  No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-go-to-file-popup.md#test-strategy, #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

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
