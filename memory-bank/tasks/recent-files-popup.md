---
slug: recent-files-popup
spec: SPEC-recent-files-popup.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Frontend: `recentFiles`/`recordRecentFile` MRU tracking hooked into
  `openFileInADE`; `recent-files-dialog` markup; `openRecentFilesDialog()` reusing
  `quickOpenRowMarkup`; `Ctrl/Cmd+E` trigger and document-delegated keyboard nav,
  both mirroring `go-to-file-popup`'s corrected patterns exactly. No backend change.
  No creative needed — this task exists specifically to reuse proven patterns, not
  invent new ones.
  (satisfies: SPEC-recent-files-popup.md#objective, #structure, #style)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions in
  `tests/desktop-ui-contract.test.ts`, same phase per this session's convention.

- [x] Phase 2 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (open a few files, confirm most-recent-first
  order, confirm re-opening moves an entry to the top instead of duplicating it,
  confirm arrow-key navigation AND its active-row highlight are visible on this
  fresh dialog too — retest, don't assume CSS reuse alone proves it, confirm
  Enter/click/Escape, confirm the empty-list case). No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-recent-files-popup.md#test-strategy, #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: DONE
**Current Phase**: 2
**Current Step**: 6/6
**Step Attempts**: {2: 0, 3: 0, 4: 1}
**Last Block Rule**: none
**Can Resume**: NO — all phases complete, operator confirmed in `npm run
desktop:dev`; follow-up request (click-outside-to-close) tracked as a new task

## Deviations

- Phase 1: the shared arrow-key/Enter delegated listener (from `go-to-file-popup`)
  had to be genuinely generalized, not just reused as-is, since it was originally
  scoped to `quick-open-dialog`'s own `.open` state specifically. Generalized it to
  pick whichever of the two dialogs is currently open; updated `chooseQuickOpenResult`
  to close `document.querySelector('dialog[open]')` generically rather than a
  hardcoded id, since it is now shared by both popups. One pre-existing regression
  test's exact-string assertion (for the old, dialog-specific form) was updated to
  match the generalized code rather than duplicating the whole listener to keep that
  literal string unchanged — the invariant it protects (arrow keys work when
  delegated, not attached to an input) is unaffected and still asserted.
- Minor accepted simplification, not treated as a blocking finding in review:
  `recordRecentFile` runs before the file's actual load completes, so a file that
  fails to open (e.g. deleted mid-flight) still gets recorded as "recently opened."
  Matches this task's deliberately small scope; not worth the restructuring needed to
  gate on success.
