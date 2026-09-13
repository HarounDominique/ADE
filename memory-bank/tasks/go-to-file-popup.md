---
slug: go-to-file-popup
spec: SPEC-go-to-file-popup.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Frontend: `quick-open-dialog` markup in `index.html`; global keydown
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

**Build Status**: RUNNING
**Current Phase**: 2
**Current Step**: 2/6
**Step Attempts**: {2: 0, 3: 0, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- Phase 1 review (step 4), caught before the operator ever saw it: `showModal()`
  throws on a `<dialog>` already open. `openQuickOpenDialog()` had no guard against
  this — reachable if the shortcut fires twice in a row, or fires while a different
  dialog (New Task, Commit, ...) is already open, which would otherwise stack two
  modals rather than replace one. Fixed with an early return when any `dialog[open]`
  already exists — silently doing nothing in that case, rather than closing the other
  dialog out from under a possibly-unsaved form.

- Phase 2 manual verification: the operator reported everything working except
  arrow-key navigation — typing, Enter, and click all worked, but ArrowUp/ArrowDown
  produced no visible change at all. Root cause not fully isolated (could not be
  reproduced or inspected directly — no GUI automation in this environment, per
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`), but the keydown
  listener was attached directly to `#quick-open-input`, the one keyboard handler in
  this task that did *not* follow this file's own established convention: every other
  keyboard interaction already in this codebase (Escape-closes-menu handlers, the
  pending-file row's Enter/Space handler from `changes-tab-status-glyphs-and-
  selective-commit`) is delegated at `document` level, scoped by a condition, rather
  than attached to the specific element expected to have focus. Rewritten to match
  that same pattern — a `document`-level `keydown` listener scoped to
  `document.getElementById('quick-open-dialog')?.open` — which the operator confirmed
  fixed it. Worth treating as a real, if not fully explained, WebView-specific
  reliability difference between an element-local and a document-delegated listener
  for arrow keys specifically, not just a style preference.
