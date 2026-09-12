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
