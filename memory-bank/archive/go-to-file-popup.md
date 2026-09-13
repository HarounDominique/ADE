# Archive: go-to-file-popup

## Summary

Added a "Go to file" quick-open popup (`Ctrl+Shift+N` on Windows/Linux, `Cmd+Shift+O`
on macOS, either accepted on any platform) that filters files live as the operator
types, with arrow-key navigation, Enter/click to open, and Escape to close. Reuses
the existing `search_directory` backend and `openFileInADE` — no new Rust command, no
second file-open path.

Satisfies: `memory-bank/specs/SPEC-go-to-file-popup.md`.

## What was built

- **`desktop/src/index.html`**: `quick-open-dialog` — a search input and a results
  `<ul>`, mirroring the existing `.task-dialog` convention.
- **`desktop/src/main.js`**: global shortcut trigger (guarded against stacking over
  an already-open dialog); debounced search mirroring the Explorer's own search
  shape, filtered to files only; document-delegated arrow-key/Enter navigation.
- **`desktop/src/styles.css`**: results-list layout, with an active-row indicator
  matching this codebase's proven `color-mix(var(--blue)) + inset box-shadow`
  pattern (not a bare panel-token background swap).

## Deviations accepted

Two Phase 2 rounds, full detail in the task file: round 1 mis-diagnosed the
arrow-key bug as an event-delegation problem (a real bug class seen twice earlier
this session) and fixed the wrong layer; round 2 found the actual cause —
`--panel`/`--panel-raised` are indistinguishable in light theme, so the `.active`
class was working correctly and invisibly the whole time. Confirmed working by the
operator after the CSS fix.

## Reflection

See `memory-bank/reflection/go-to-file-popup.md`. One rule added to
`agent-rules/_learned/desktop-webview-constraints.md`
(`diagnose-invisible-changes-by-layer-not-by-recency`): a fix that doesn't change a
reported symptom at all is itself evidence to redirect the search to a different
layer, not retry within the same one.

## Remaining scope from the original request

Still open: #18 (recent files, low-effort tier) plus the medium/large tiers this
session already triaged (#5-6, #7, #11, #16, #17). #8/#10/#12-15 (semantic code
navigation) remain not recommended without a language server.
