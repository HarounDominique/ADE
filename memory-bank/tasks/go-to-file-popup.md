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

- [x] Phase 2 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (open the popup from anywhere in the app on either
  bound shortcut; confirm live filtering, arrow-key navigation, Enter/click both open
  and close, Escape closes without opening, directories never appear in results).
  No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-go-to-file-popup.md#test-strategy, #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: DONE
**Current Phase**: 2
**Current Step**: 6/6
**Step Attempts**: {2: 0, 3: 0, 4: 1}
**Last Block Rule**: none
**Can Resume**: NO — all phases complete, operator confirmed in `npm run desktop:dev`
after two verification rounds (see Deviations)

## Deviations

- Phase 1 review (step 4), caught before the operator ever saw it: `showModal()`
  throws on a `<dialog>` already open. `openQuickOpenDialog()` had no guard against
  this — reachable if the shortcut fires twice in a row, or fires while a different
  dialog (New Task, Commit, ...) is already open, which would otherwise stack two
  modals rather than replace one. Fixed with an early return when any `dialog[open]`
  already exists — silently doing nothing in that case, rather than closing the other
  dialog out from under a possibly-unsaved form.

- Phase 2 manual verification, round 1: the operator reported everything working
  except arrow-key navigation — typing, Enter, and click all worked, but
  ArrowUp/ArrowDown produced no visible change at all. Could not be reproduced or
  inspected directly (no GUI automation in this environment, per
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`). Hypothesized the
  keydown listener being attached directly to `#quick-open-input` instead of
  delegated at `document` level (the pattern every *other* keyboard interaction in
  this file already uses) and rewrote it to match — **this hypothesis was wrong**, see
  round 2.

- Phase 2 manual verification, round 2: the operator retested after the document-
  delegation change with the identical symptom — proving the JS event handling was
  never the actual problem, in either form. The real cause: `.quick-open-result.active`
  set only `background: var(--panel-raised)` (this task's own original CSS). In this
  app's light theme, `--panel: #ffffff` and `--panel-raised: #fdfeff`
  (`desktop/src/styles.css`) are visually indistinguishable — the JS was almost
  certainly updating the `.active` class correctly the whole time; the highlight was
  just never visible against a light-theme dialog. Every *other* active-row indicator
  in this codebase (`.git-pending-file.active`, `.git-commit-file.active`) already
  avoids this exact trap by mixing in `var(--blue)` via `color-mix()` plus a
  theme-independent `box-shadow: inset 3px 0 0 var(--blue)` accent stripe, rather than
  relying on two panel tokens being different enough — this task's original CSS was
  the one exception to that proven pattern too. Matched it. Two real lessons from one
  bug: (1) don't debug a "nothing happens" report by assuming the event layer without
  checking contrast/rendering first, especially once a plausible JS fix demonstrably
  doesn't change the symptom; (2) new UI in this codebase should reuse
  `color-mix(in srgb, var(--blue) N%, var(--panel))` + the inset box-shadow for any
  "active/selected row" indicator, not a bare panel-token swap.
