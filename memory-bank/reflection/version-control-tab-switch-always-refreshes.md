# Reflection: version-control-tab-switch-always-refreshes

Fast-path task, inline reflection per this project's convention.

## Implementation vs. spec

Both fixes shipped exactly as specced: keyboard tab navigation and top-level nav
re-entry into Version control both now force a fresh pending-changes read. Operator
confirmed keyboard tab-switching now refreshes correctly.

One residual case the operator surfaced but explicitly chose not to chase further:
switching from Editor into Version control still sometimes shows a stale list until a
file is clicked. A live debugging pass (temporary `console.error` instrumentation at
`showView`, `requestVersionControlData`, `requestPendingGitChanges`) was set up to
isolate it, but the operator declined to run the repro and asked to close the task
with current behavior accepted as good enough — their call to make, not a silent
downgrade of severity on my part. Recorded here so it isn't mistaken for "fully
verified" if it resurfaces.

## Workflow evaluation

Single fast-path phase was correct sizing — two one-line additions plus a contract
test. No spec correction needed.

## Extracted patterns

None new. The debug-instrumentation-then-ask-user-to-read-devtools technique already
worked once this session (`editor-code-snippets`'s webview-cache false alarm); here it
was set up correctly but the operator opted out of running it, which is a normal,
acceptable outcome of that technique, not a failure of it.
