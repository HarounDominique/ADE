# SPEC: Remove the "New window" detach button

status: approved

## Objective

Remove the "New window" button (`data-action="detach-document"`, id `detach-document`)
from the document editor toolbar, along with its click wrapper `detachActiveDocument()`,
its dispatcher entry, and the `detachButton` enable/disable logic in `setDocumentHeader`.
Dragging a document tab off the tab strip already detaches it into its own window via
the same underlying `detachDocument(documentId)` function — that function, and the whole
detach-to-window subsystem it powers (`openDocumentWindow`, `detachedDocuments`,
`reattachDocument`, the `editor-window.*` files), stays exactly as it is; only the
redundant explicit-button entry point goes.

## Boundaries

**Always:** keep `detachDocument(documentId)` and everything it depends on untouched —
drag-to-detach (`finishTabDrag`/`droppedOffTheStrip`) is the only remaining caller and
must keep working exactly as it does today. Update the existing contract test ("a file
can be moved to a window of its own, and moved is not copied") to drop only its two
button-specific assertions (`data-action="detach-document"...` and `async function
detachActiveDocument`), keeping every other assertion in that test intact.

**Never:** remove or alter `openDocumentWindow`, `detachedDocuments`, `reattachDocument`,
or anything under `desktop/src/editor-window.*` — none of that is the button, all of it
is still load-bearing for drag-to-detach.
