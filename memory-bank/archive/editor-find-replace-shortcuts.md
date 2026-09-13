# Archive: editor-find-replace-shortcuts

## Summary

Investigated the 4 requested in-file search shortcuts (find, next match, previous
match, replace) against both editing engines Assay uses (CodeMirror and Monaco,
`desktop/src/code-editor.js`). Find, next, and previous already worked, unmodified, on
both — exact same key combinations requested (`Mod-f`; `F3`/`Mod-g`;
`Shift-F3`/`Shift-Mod-g`). Only Replace was missing a `Mod-r` binding on either engine;
added one line per engine. Operator confirmed all four working correctly in
`npm run desktop:dev`, including that `Mod-r` does not trigger a native WebView reload
(the one real unknown this task carried).

Satisfies: `memory-bank/specs/SPEC-editor-find-replace-shortcuts.md`.

## Deviations accepted

None.

## Reflection

See `memory-bank/reflection/editor-find-replace-shortcuts.md`. No new rule extracted —
reconfirms the existing `mirror-pattern-verification` rule
(`agent-rules/_learned/spec-writing.md`) from its positive side: verifying against the
real engine source before writing the spec produced zero deviations in either build
phase.

## Remaining scope from the original request

This task covered only items #1-4 (find/replace in the current file) of the original
18-item shortcut table. Still open, by tier: #9 (go to file) and #18 (recent files)
are next (low-effort tier); #5-6 (project-wide search/replace) and #11/#16 (find
action, highlight usages) are medium-effort; #7/#17 (Search Everywhere, file
structure) are large; #8/#10/#12-15 (class/symbol/declaration/implementation/usages
navigation) are not feasible without a language server and were recommended against.
