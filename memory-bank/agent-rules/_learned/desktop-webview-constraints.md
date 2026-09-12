---
topic: desktop-webview-constraints
priority: high
---

### no-native-html5-drag-and-drop
_derived_from: reflection/explorer-selection-and-drag-drop.md · evidence_count: 1 · last_validated: 2026-09-12_

Never use native HTML5 `draggable`/`dragstart`/`dragover`/`drop` events in this codebase's
Tauri desktop shell (`desktop/src/`) — already tried once, for detaching a document tab
into its own window, and abandoned: it reported nothing usable about a drop that left the
window in this WebView. Use the established mousedown/mousemove/mouseup + ghost-element
pattern instead (see `documentTabStrip`'s `trackTabDrag`/`finishTabDrag` in `main.js`, and
the Explorer's own `trackWorkspaceDrag`/`finishWorkspaceDrag` it was mirrored from). A
standing test in `tests/desktop-ui-contract.test.ts` guards the tab-detach code path
against reintroducing `draggable="true"`.

### detached-target-breaks-later-click-listeners
_derived_from: reflection/create-branch-from-dropdown.md · evidence_count: 1 · last_validated: 2026-09-12_

If a delegated `document` click handler synchronously replaces its container's
`innerHTML` (swapping a menu's content in place, rather than closing it), every
*later*-registered `document`-level click listener that runs on the same event still
receives the same `event`, but `event.target.closest(...)` on it now returns `null` —
the original element was detached from the DOM by the earlier handler, mid-dispatch.
An outside-click-closes-the-menu listener elsewhere in `main.js` misread its own
in-menu click as an outside one this way, closing a menu the instant an earlier
handler had just repainted it. Any handler (existing or new) that needs to check
ancestry of the click target after another same-tick handler may have mutated the DOM
must use `event.composedPath()` instead of `event.target.closest(...)` —
`composedPath()` reflects the tree as it was at dispatch time, immune to later
mutation.
