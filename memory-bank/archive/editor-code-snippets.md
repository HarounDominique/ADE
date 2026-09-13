# Archive: editor-code-snippets

## Summary

Abbreviation-triggered snippet expansion added to the Editor across all 23 supported
languages, building on `editor-autocomplete`'s suggestion popup and Tab-accept keymap.
One neutral template format (`${name}`/`${}`) is the single source of truth
(`desktop/src/editor-snippets.js`'s `snippetCatalog`); CodeMirror uses it natively,
Monaco gets a small translator (`toMonacoSnippet`). Structural skeletons
(`if`/`for`/`while`/function/class-or-equivalent) for 20 languages that didn't already
have them from their own CodeMirror package (JS/TS/Python were already covered);
iconic idioms (Java `sout`/`psvm`, Go `iferr`, Python `__main__` guard, JS/TS `clg`,
and a `main` entry-point skeleton for C++/C/C#/Rust/Kotlin/Dart) as a deliberately
small starter set, not a claim of IDE-parity breadth.

Satisfies: `memory-bank/specs/SPEC-editor-code-snippets.md` (all sections, including
its documented per-language exceptions). Operator manually confirmed the full set in
`npm run desktop:dev`: Java (`sout`, `psvm`, Tab walking a structural snippet's
placeholders), Go (`iferr`), Python (`main`, no collision with the language's own
bundled snippets), and a Monaco-engine language.

## Deviations accepted

Two review-caught content bugs, both fixed same-phase, never shipped: `C`'s missing
`struct` class-or-equivalent (Phase 2), and missing `$` sigils in PowerShell's `for`
template plus an identical pre-existing gap in PHP's (Phase 4). Two spec-text
corrections from the same reviews: C/C# were mis-classified as CodeMirror-engine
(they're Monaco); Tier B's idiom list hadn't been updated for the `main` entries added
to C++/C/C#/Rust. A session-wide API rate limit forced two review passes (Phase 4's
re-review, Phase 5's TDD/batch-test) to be done directly by the orchestrating session
instead of a dispatched subagent — documented in the task file, same rigor applied.

A costly false alarm during manual verification: the operator's first report ("sout+Tab
does nothing") triggered extensive debugging before concluding the mechanism was
correct all along — a stale cached WebView bundle, not a code bug. New rule captured
for this.

## Reflection

`memory-bank/reflection/editor-code-snippets.md` — extracted one new rule,
`suspect-webview-cache-before-the-mechanism`, in
`agent-rules/_learned/desktop-webview-constraints.md`.
