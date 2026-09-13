# Archive: version-control-tab-switch-always-refreshes

## Summary

Selecting the Changes tab now always forces a fresh pending-changes read: the
keyboard tab-navigation handler (`←`/`→`/`Home`/`End` on `.version-control-tabs`)
gained the `requestVersionControlData(workspaceRootPath, { force: true })` call the
mouse-click handler already had, and `showView`'s `view === 'changes'` branch now
also passes `{ force: true }` instead of relying on the 1500ms freshness throttle.

Satisfies: `memory-bank/specs/SPEC-version-control-tab-switch-always-refreshes.md`.
Operator confirmed keyboard tab-switching now refreshes correctly.

## Deviations accepted

One residual case accepted as-is by the operator, not fully root-caused: switching
from Editor into Version control can still show a stale list until a file is clicked.
A debugging instrumentation pass was prepared but the operator chose to close the
task without running it — documented in the reflection, not silently dropped.

## Reflection

`memory-bank/reflection/version-control-tab-switch-always-refreshes.md` — inline,
fast-path. No new rule extracted.
