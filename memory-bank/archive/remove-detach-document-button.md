# Archive: remove-detach-document-button

**Spec**: `memory-bank/specs/SPEC-remove-detach-document-button.md`
**Task**: `memory-bank/tasks/remove-detach-document-button.md` (fast-path, inline reflection)
**Branch**: `task/remove-detach-document-button`

## What was built

Removed the redundant "New window" button from the document editor toolbar
(`data-action="detach-document"`), its `detachActiveDocument()` wrapper, its dispatcher
entry, and the `detachButton` enable/disable lines in `setDocumentHeader`. The
underlying `detachDocument(documentId)` function and the whole detach-to-window
subsystem (`openDocumentWindow`, `detachedDocuments`, `reattachDocument`,
`editor-window.*`) are untouched — dragging a tab off the strip already called the same
function and remains the sole, sufficient entry point.

## Satisfies

`SPEC-remove-detach-document-button.md` — Objective and Boundaries, in full.

## Deviations accepted

None — matched the spec exactly, confirmed by the full regression suite staying green.
