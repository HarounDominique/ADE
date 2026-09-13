---
slug: editor-autocomplete
spec: SPEC-editor-autocomplete.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Universal buffer-word fallback + Tab-to-accept on CodeMirror; manual
  confirmation that Monaco's pre-existing defaults genuinely hold in this app. Delivers
  the whole spec in one commit-worthy increment — no design fork, no phase boundary
  worth splitting on. (satisfies: SPEC-editor-autocomplete.md#structure, #style)

  - `desktop/package.json`: `@codemirror/autocomplete` promoted from transitive to
    direct dependency.
  - `desktop/src/code-editor.js`: import `autocompletion` is *not* re-called (already
    active via `basicSetup`); import `completeAnyWord` and `acceptCompletion`. Add
    `EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }])` to
    `initializeCodeEditor()`'s extension list. Add `{ key: 'Tab', run: acceptCompletion }`
    to the existing `keymap.of([...])`, positioned before `indentWithTab`.
  - `tests/desktop-ui-contract.test.ts`: assert the `languageData`/`completeAnyWord`
    line exists, and assert `Tab`/`acceptCompletion` appears before `indentWithTab` in
    source order (not just presence — order is the actual behavior under test).
  - Test strategy: `node --check desktop/src/main.js`; the two contract-test
    additions above; full `npm test`; **mandatory manual pass** in `npm run
    desktop:dev` per the spec's Test strategy section — a CodeMirror file (suggestion
    appears while typing, Tab accepts it, Tab still indents with no popup open), a
    previously-silent CodeMirror language (`.rs` or `.json`, buffer-word suggestions
    now appear), and a Monaco-backed file (`.rb` or `.go`, confirming the engine's own
    defaults hold inside this app's actual WebView).

## Execution State

**Build Status**: DONE
**Current Phase**: 1
**Current Step**: 6/6
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

None from the spec's substance. One unspecified detail resolved by judgment: the spec
didn't say where in `desktop/package.json`'s dependency list to insert
`@codemirror/autocomplete` (the existing `@codemirror/*` block isn't strictly
alphabetical — `@codemirror/search` is already out of order). Placed it alphabetically,
ahead of `@codemirror/lang-cpp`. Reviewed and accepted, not a blocking finding.

All build steps green on the first attempt — RED/GREEN, batch test (532/532 TypeScript
+ desktop build), and code review all passed without a retry.
