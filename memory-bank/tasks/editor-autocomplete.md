---
slug: editor-autocomplete
spec: SPEC-editor-autocomplete.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Universal buffer-word fallback + Tab-to-accept on CodeMirror; manual
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

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

None yet.
