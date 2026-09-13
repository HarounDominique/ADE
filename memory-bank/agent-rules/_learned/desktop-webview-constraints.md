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

### interactivity-conversion-has-a-fixed-cost
_derived_from: reflection/changes-tab-status-glyphs-and-selective-commit.md · evidence_count: 1 · last_validated: 2026-09-12_

Converting a native interactive element (`<button>`) to a non-native one
(`<div role="button" tabindex="0">`) — typically forced because the native element
cannot legally nest a second interactive control, like a checkbox — always costs two
things that must be re-added explicitly, never inherited for free: keyboard
activation (Enter/Space do nothing on a bare `role="button"` div until a `keydown`
handler synthesizes a `.click()`), and correctness around any nested control's own
`<label>` (clicking a label's padding, not exactly its `<input>`, fires a click on the
label *and* a browser-forwarded synthesized click on the input — two events for one
action — so a delegated handler keyed off the outer container must explicitly guard
against acting twice). Both were missing from `changes-tab-status-glyphs-and-
selective-commit`'s own spec and its first implementation pass, caught only in
review. Treat this pair as a checklist item any time a spec or build phase proposes
this exact conversion, not something to discover by testing.

### diagnose-invisible-changes-by-layer-not-by-recency
_derived_from: reflection/go-to-file-popup.md · evidence_count: 1 · last_validated: 2026-09-13_

A report of "nothing visibly happens" is a rendering claim, not an event-handling
claim — diagnose it by checking what should be *visible* (CSS contrast, a class
actually being applied, layout) before re-reaching for the most recently-seen bug
class in this codebase (event delegation, keyboard activation, ...), even when that
class fits the symptom's shape superficially. `go-to-file-popup`'s arrow-key
navigation looked identical to two earlier, real delegation bugs in this same
session, so delegation was fixed first — but the operator's retest showed the
identical symptom, meaning the JS was never broken; the `.active` class was toggling
correctly the whole time, invisible only because `--panel`/`--panel-raised` are
indistinguishable in this app's light theme. **A fix that demonstrably does not
change the reported symptom is itself evidence the hypothesis was wrong** — that
result should redirect the search to a different layer (JS vs. CSS vs. state)
immediately, not prompt a second fix attempt within the same layer.
