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

- [x] Phase 2 — C-family + Rust (C++, C, C#, PHP, Rust). All CodeMirror-engine
  languages — reuses Phase 1's `codeMirrorSnippetExtension` mechanism unchanged, no new
  wiring. Rust's class-or-equivalent is `struct` per the spec's documented exception.
  (satisfies: SPEC-editor-code-snippets.md structural-skeleton content for these 5)
  Test strategy: catalog-shape assertions for these 5 languages; full `npm test`.

- [x] Phase 3 — JVM/mobile Monaco languages (Kotlin, Swift, Ruby, Scala, Dart,
  Objective-C). All Monaco-engine — Phase 1's generic registration loop picks these up
  automatically once the catalog has entries; no new wiring code, content only.
  (satisfies: SPEC-editor-code-snippets.md structural-skeleton content for these 6)
  Test strategy: catalog-shape assertions for these 6 languages, plus a check that
  Monaco's provider registration loop actually iterates over them (not just that the
  catalog has the data); full `npm test`.

- [x] Phase 4 — Remaining scripting Monaco languages (Lua, Perl, PowerShell, Shell,
  F#, Elixir, R), each with the per-language exceptions the spec names (no class for
  Lua/Perl/PowerShell/Shell/F#/R, no `while` for Elixir).
  (satisfies: SPEC-editor-code-snippets.md structural-skeleton content for these 7,
  and its documented per-language exceptions)
  Test strategy: catalog-shape assertions for these 7, including a negative assertion
  that the documented omissions (no class/while entry) are intentional absence, not an
  oversight — e.g. asserting Elixir's structural array has no `while`-labeled entry
  rather than just not checking for one either way.

- [x] Phase 5 — Completeness + hardening. Adds the final contract-test assertion that
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

**Build Status**: DONE
**Current Phase**: 5
**Current Step**: 6/6
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

Phase 1: none. Spec's assumptions about the code-editor.js call site
(`definition.label` in scope, `loadMonaco()`'s singleton promise as the one-time Monaco
registration hook) both matched the actual code exactly. All build steps green on
first attempt.

Phase 2: review-blocked once, accepted fix. The orchestrator-dictated content for `C`
omitted a `struct` class-or-equivalent entry, contradicting the spec's own Scope text
(C explicitly grouped with Rust/Go as needing one) — a real bug in this session's
content, not the TDD agent's error. Fixed (`struct ${Name} {\n\t${}\n};`) and the test
that had wrongly codified the omission as correct was corrected to require it. Re-review
passed and additionally caught, non-blocking: a test gap (C's `main` idiom went
unasserted — fixed), and two spec-text errors — C and C# are actually Monaco-engine in
this app, not CodeMirror as originally drafted, and Tier B's idiom list hadn't been
updated to include the `main` skeleton this phase gave C++/C/C#/Rust. Both corrected in
the spec directly (dated addenda, not silently rewritten history). All content fixes
verified against `desktop/src/code-editor.js`'s actual `codeLanguageDefinitions`/
`monacoLanguageDefinitions` rather than assumed.

Phase 3: none. Both TDD and review explicitly re-verified the engine assignment
(Monaco, not CodeMirror) for all 6 languages against `code-editor.js` directly before
proceeding, per Phase 2's lesson. Clean pass, no rework.

Phase 4: review-blocked once, accepted fix. PowerShell's `for` template was missing
`$` sigils on every variable reference (`for (${i} = 0; ${i} -lt ${limit}; ${i}++)` is
not valid PowerShell — bare `i`/`limit` parse as commands, not variables) — my own
dictated content again, same bug class as Phase 2's `struct` omission but a different
kind of error (syntax correctness, not scope omission). Fixed
(`$${i}`/`$${limit}` throughout), and in the same pass fixed an identical pre-existing
gap the review flagged as context: Phase 2's already-committed PHP `for` template had
the same missing sigil on `${limit}` specifically (its `${i}` occurrences were already
correct). The scheduled opus-tier re-review hit a session-wide API rate limit
mid-dispatch (both an opus attempt and a sonnet fallback attempt failed on the same
limit) — the re-review was completed directly by the orchestrating session instead of a
subagent: read every catalog entry across all 22 languages by hand, traced
`toMonacoSnippet`'s regex against every `$`/`@`-sigil-bearing template (not just the two
already fixed) to confirm no third occurrence of the same bug class, and re-confirmed
the exception splits, engine assignments, and boundary (no code-editor.js changes).
No further defects found. Documented here as a deviation from the normal dispatch
pipeline, not a shortcut on rigor — the same checks were performed, just not by a
separate subagent process.

Phase 5: TDD/batch-test steps also done directly by the orchestrating session (same
rate-limit condition as Phase 4's re-review, still active at the start of this phase);
review re-attempted via normal subagent dispatch and succeeded, confirming the limit had
cleared. The completeness test (all 23 Scope-listed languages present, exact count,
correct shape on every entry) passed green on first write — no gap found, meaning every
phase's content actually landed as claimed. All 5 phases complete.
