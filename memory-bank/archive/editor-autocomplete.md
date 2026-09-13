# Archive: editor-autocomplete

## Summary

The Editor now offers Tab-accepted autocomplete suggestions on the CodeMirror engine
across every language it supports. A new global word-from-buffer completion source
(`EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }])`) gives all 13
CodeMirror languages suggestions — 6 of them (C++, Java, PHP, Rust, JSON, YAML)
previously had none from their language packages. A new `Tab` keymap entry
(`acceptCompletion`, placed before `indentWithTab`) accepts the highlighted suggestion,
falling through to normal Tab-indent when no completion popup is open.

Monaco was not touched: investigating its source directly (`suggestController.js`)
found its suggest widget and Tab-accept binding are already on by default for all 19 of
its fallback languages.

Satisfies: `memory-bank/specs/SPEC-editor-autocomplete.md` (all sections). Operator
manually confirmed the core mechanism works in `npm run desktop:dev`.

## Deviations accepted

One unspecified detail resolved by judgment, not a spec gap: `@codemirror/autocomplete`'s
position in `desktop/package.json`'s dependency list (placed alphabetically). Reviewed
and accepted.

## Reflection

`memory-bank/reflection/editor-autocomplete.md` — extracted one new rule,
`overloaded-feature-term-disambiguation`, in `agent-rules/_learned/spec-writing.md`.

## Follow-up

The operator's next request, immediately after confirming this feature works,
was abbreviation-triggered snippet/live-template expansion (`sout` + Tab → boilerplate,
a for-loop skeleton, etc.) — explicitly out of this spec's scope. Tracked as a
separate task.
