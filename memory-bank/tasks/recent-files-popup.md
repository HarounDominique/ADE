---
slug: recent-files-popup
spec: SPEC-recent-files-popup.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Frontend: `recentFiles`/`recordRecentFile` MRU tracking hooked into
  `openFileInADE`; `recent-files-dialog` markup; `openRecentFilesDialog()` reusing
  `quickOpenRowMarkup`; `Ctrl/Cmd+E` trigger and document-delegated keyboard nav,
  both mirroring `go-to-file-popup`'s corrected patterns exactly. No backend change.
  No creative needed — this task exists specifically to reuse proven patterns, not
  invent new ones.
  (satisfies: SPEC-recent-files-popup.md#objective, #structure, #style)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions in
  `tests/desktop-ui-contract.test.ts`, same phase per this session's convention.

- [ ] Phase 2 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (open a few files, confirm most-recent-first
  order, confirm re-opening moves an entry to the top instead of duplicating it,
  confirm arrow-key navigation AND its active-row highlight are visible on this
  fresh dialog too — retest, don't assume CSS reuse alone proves it, confirm
  Enter/click/Escape, confirm the empty-list case). No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-recent-files-popup.md#test-strategy, #boundaries)
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
