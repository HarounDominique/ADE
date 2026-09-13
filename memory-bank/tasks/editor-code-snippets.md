---
slug: editor-code-snippets
spec: SPEC-editor-code-snippets.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Mechanism + seed content (Java, Go, Python, JavaScript, TypeScript).
  Creates `desktop/src/editor-snippets.js` (`snippetCatalog`, `toMonacoSnippet`), wires
  both engines in `desktop/src/code-editor.js` (`codeMirrorSnippetExtension` +
  `codeEditorLanguage.reconfigure` change; the Monaco `registerCompletionItemProvider`
  loop, generic over `monacoLanguageDefinitions`). Seeds the catalog with the 5
  languages the spec already drafted in full. Proves the whole pipeline end-to-end on
  both engines and both tiers before the remaining 15 languages reuse the same shape.
  (satisfies: SPEC-editor-code-snippets.md#structure, #style)
  Test strategy: `node --check` on both changed files; unit tests for
  `toMonacoSnippet` (linked-field numbering, `${}` → `$0`, no-placeholder passthrough);
  contract-test additions asserting the CodeMirror wiring calls
  `codeMirrorSnippetExtension` and the Monaco wiring registers a provider per catalog
  language with a `monacoLanguage` id; catalog-shape assertions for these 5 languages
  specifically (not yet the full Scope list — that's Phase 5). Full `npm test`.

- [ ] Phase 2 — C-family + Rust (C++, C, C#, PHP, Rust). All CodeMirror-engine
  languages — reuses Phase 1's `codeMirrorSnippetExtension` mechanism unchanged, no new
  wiring. Rust's class-or-equivalent is `struct` per the spec's documented exception.
  (satisfies: SPEC-editor-code-snippets.md structural-skeleton content for these 5)
  Test strategy: catalog-shape assertions for these 5 languages; full `npm test`.

- [ ] Phase 3 — JVM/mobile Monaco languages (Kotlin, Swift, Ruby, Scala, Dart,
  Objective-C). All Monaco-engine — Phase 1's generic registration loop picks these up
  automatically once the catalog has entries; no new wiring code, content only.
  (satisfies: SPEC-editor-code-snippets.md structural-skeleton content for these 6)
  Test strategy: catalog-shape assertions for these 6 languages, plus a check that
  Monaco's provider registration loop actually iterates over them (not just that the
  catalog has the data); full `npm test`.

- [ ] Phase 4 — Remaining scripting Monaco languages (Lua, Perl, PowerShell, Shell,
  F#, Elixir, R), each with the per-language exceptions the spec names (no class for
  Lua/Perl/PowerShell/Shell/F#/R, no `while` for Elixir).
  (satisfies: SPEC-editor-code-snippets.md structural-skeleton content for these 7,
  and its documented per-language exceptions)
  Test strategy: catalog-shape assertions for these 7, including a negative assertion
  that the documented omissions (no class/while entry) are intentional absence, not an
  oversight — e.g. asserting Elixir's structural array has no `while`-labeled entry
  rather than just not checking for one either way.

- [ ] Phase 5 — Completeness + hardening. Adds the final contract-test assertion that
  every language named in the spec's Scope section (the 3 already covered by bundled
  CodeMirror snippets, plus all 20 authored across Phases 1-4) has a non-empty
  `snippetCatalog` entry or bundled-package coverage — this is the test that actually
  enforces "all languages", not a human re-count. No new snippet content.
  (satisfies: SPEC-editor-code-snippets.md#test-strategy)
  Test strategy: the completeness assertion above; full `npm test`;
  `npm --prefix desktop run build`; then the spec's **mandatory manual verification
  pass** in `npm run desktop:dev` — Java (`sout`+Tab, `psvm`+Tab, Tab walking a
  structural snippet's placeholders), Go (`iferr`+Tab), Python (`main`+Tab, confirming
  no collision with the language's own bundled snippets), and one Monaco-engine
  language (e.g. Ruby or Swift) confirming its registered provider surfaces in this
  app's real WebView.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: 1
**Current Step**: 6/6
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

Phase 1: none. Spec's assumptions about the code-editor.js call site
(`definition.label` in scope, `loadMonaco()`'s singleton promise as the one-time Monaco
registration hook) both matched the actual code exactly. All build steps green on
first attempt.
