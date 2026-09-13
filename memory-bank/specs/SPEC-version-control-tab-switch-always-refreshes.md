# SPEC: Selecting Changes always forces a fresh pending-changes read

status: approved

## Objective

Two gaps found during `discard-pending-file-changes`'s manual verification, both
already contradicted by the codebase's own stated intent (the click handler at
`desktop/src/main.js:6235-6247` already reads "opening a tab is asking to see what is
in it... The read is forced, because a press is a question"):

1. **Keyboard tab navigation never refreshes at all.** The ARIA `←`/`→`/`Home`/`End`
   handler for `.version-control-tabs` (`main.js:6766-6780`) calls
   `renderVersionControlTabs(...)` but never calls `requestVersionControlData(...)` —
   unlike the mouse-click handler on the same tabs, which already does with
   `force: true`. Switching Changes↔History via keyboard (a fully-supported
   interaction per this app's own accessibility contract) silently shows stale data.
2. **Top-level nav re-entry into Version control is throttled, not forced.**
   `showView('changes')` (`main.js:5654`) calls `requestVersionControlData(workspaceRootPath)`
   without `force: true`, so re-entering Version control from another top-level view
   within `versionControlFreshMs` (1500ms) of the last read silently skips the refresh
   — a real but narrower gap than #1.

## Structure

- **`desktop/src/main.js`**: the `.version-control-tabs` `keydown` handler
  (`:6766-6780`) gains one call, mirroring the click handler's own comment and
  `force: true` exactly. `showView` (`:5645-5656`) passes `{ force: true }` on its
  existing `view === 'changes'` call, for the same reason.

## Style

```js
// .version-control-tabs keydown handler, after renderVersionControlTabs(...):
renderVersionControlTabs(nextTab.dataset.versionControlTab);
nextTab.focus();
requestVersionControlData(workspaceRootPath, { force: true });
```

```js
// showView(view):
if (view === 'changes') requestVersionControlData(workspaceRootPath, { force: true });
```

## Test strategy

- `node --check desktop/src/main.js`.
- Contract-test addition in `tests/desktop-ui-contract.test.ts`: the keydown handler's
  source text includes a `requestVersionControlData` call with `force: true` after
  `renderVersionControlTabs(nextTab...)`; the `showView` function's `view === 'changes'`
  branch includes `force: true`.
- Full `npm test`.
- Manual verification in `npm run desktop:dev`: with Changes and History both showing
  a repo with pending changes, use `←`/`→` to switch tabs — pending files reflect an
  external change (e.g. edit a file in the terminal) without a manual Refresh; switch
  to another top-level view (e.g. Projects) and back to Version control within ~1s —
  same result.

## Boundaries

**Always:** keep this scoped to the two call sites named above — do not change the
background poll's own cadence/guard (`window.setInterval` at `:5707-5711`), which is
intentionally throttled and unrelated to explicit tab/view selection.

**Never:** never removes or weakens `pendingGitRefreshInFlight`'s in-flight guard on
`requestPendingGitChanges` — a forced read still coalesces with one already in flight,
it just no longer skips a **new** request due to the separate freshness timestamp.
