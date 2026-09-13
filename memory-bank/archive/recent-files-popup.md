# Archive: recent-files-popup

## Summary

Added a "Recent files" popup (`Ctrl+E`/`Cmd+E`) listing the most recently opened
files, most-recent-first, session-scoped and capped at 20. Reuses `go-to-file-popup`'s
row markup, CSS, and dialog-stacking guard wholesale; the shared arrow-key/Enter
listener was generalized to serve both popups rather than duplicated.

Satisfies: `memory-bank/specs/SPEC-recent-files-popup.md`.

## What was built

- **`desktop/src/main.js`**: `recentFiles`/`recordRecentFile` MRU tracking inside
  `openFileInADE`; `openRecentFilesDialog()`; `Ctrl/Cmd+E` trigger; the shared
  delegated keyboard listener generalized to pick whichever of the two dialogs is
  open.
- **`desktop/src/index.html`**: `recent-files-dialog`, mirroring `quick-open-dialog`.

## Deviations accepted

The shared listener needed real generalization, not just reuse; one pre-existing
regression test's exact-string assertion updated to match. Full detail in the task
file.

## Reflection

See `memory-bank/reflection/recent-files-popup.md`. No new rule — this task is
evidence for two already-extracted rules, not a source of a new one. First clean
build in this "low-effort tier" mini-arc (three tasks:
`editor-find-replace-shortcuts`, `go-to-file-popup`, `recent-files-popup`) with no
new bugs, having inherited fixes from the previous task's real ones.

## Remaining scope from the original request

The "low-effort" tier from the original 18-item request is now fully built. A direct
follow-up (click-outside-to-close for these two popups) was requested immediately
after and is tracked as its own task rather than reopening this one. Still open at
the medium/large tiers: #5-6 (project-wide search/replace), #7 (Search Everywhere),
#11 (find action), #16 (highlight usages), #17 (file structure). #8/#10/#12-15
(semantic code navigation) remain not recommended without a language server.
