# SPEC: Tab-accepted syntax autocomplete across every Editor language

status: approved

## Objective

Add Tab-accepted autocomplete suggestions to the Editor (`desktop/src/code-editor.js`),
covering every language it currently supports on both engines — CodeMirror for the
official set, Monaco as the fallback for the rest. Scope is deliberately syntactic, not
semantic: keyword/snippet completions from each language package plus word-from-buffer
completions as a universal fallback, no type/import/cross-file awareness, no language
server. Confirmed with the operator before writing this spec.

Investigating both engines directly (not assuming) found the feature mostly already
exists, the same pattern as `editor-find-replace-shortcuts`:

- **Monaco needs no code change.** Its suggest widget is on by default
  (`quickSuggestions`, `wordBasedSuggestions` both default-on) for every one of its 19
  fallback languages, and `suggestController.js` (read directly in
  `node_modules/monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js`)
  registers `Tab` as `acceptSelectedSuggestion`'s primary keybinding by default,
  active whenever the suggest widget is visible. Nothing in
  `initializeMonacoEditor` disables any of this.
- **CodeMirror already runs `autocompletion()`.** `basicSetup` (already in use, see
  `editor-find-replace-shortcuts`'s spec for the same discovery pattern) bundles
  `@codemirror/autocomplete`'s `autocompletion()`, `closeBrackets` and
  `completionKeymap` — confirmed by reading `node_modules/codemirror/dist/index.js`
  directly. Two real gaps remain:
  1. Only 7 of the 13 `@codemirror/lang-*` packages this app uses register any
     completion source of their own (checked each package's dist file directly):
     JavaScript, Python, CSS, HTML, Markdown, SQL and XML have one; C++, Java, PHP,
     Rust, JSON and YAML have none, so those six languages currently suggest nothing
     at all while typing.
  2. `completionKeymap`'s default accept key is `Enter`, not `Tab`. The existing
     `indentWithTab` binding already owns `Tab` for indentation.

## Structure

- **`desktop/src/code-editor.js`**, `initializeCodeEditor()`:
  - A new extension, `EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }])`,
    added once alongside the other top-level extensions (not per-language, not behind
    the `codeEditorLanguage` compartment) — `autocompletion()`'s default source
    resolution walks every active `languageData` provider and merges their results, so
    this makes every one of the 13 CodeMirror languages fall back to buffer-word
    suggestions, while the 7 with a richer built-in source keep that too (both fire;
    duplicate entries between a keyword and a matching buffer word are an acceptable,
    common IDE cosmetic, not a bug).
  - One new keymap entry, `{ key: 'Tab', run: acceptCompletion }`, placed **before**
    the existing `indentWithTab` entry in the same `keymap.of([...])` array —
    `acceptCompletion` (imported from `@codemirror/autocomplete`) returns `false` when
    no completion popup is open (confirmed by reading its source), so CodeMirror's
    keymap resolution falls through to `indentWithTab` for ordinary Tab-to-indent in
    that case. `Enter` keeps accepting too, via `completionKeymap`'s own default,
    already active through `basicSetup` — unchanged.
- **`desktop/package.json`**: `@codemirror/autocomplete` added as a direct dependency —
  currently only transitively available through the `codemirror` metapackage, and this
  file now imports from it directly. Same precedent as `@codemirror/search` in
  `editor-find-replace-shortcuts`.
- No Monaco changes. No new UI — both engines' suggestion popups are native, already
  rendering inline in the editor viewport.

## Style

`desktop/src/code-editor.js`, imports:

```js
import { autocompletion, completeAnyWord, acceptCompletion } from '@codemirror/autocomplete';
```

Inside `initializeCodeEditor()`'s extension list:

```js
extensions: [
  basicSetup,
  codeEditorLanguage.of([]),
  codeEditorHighlight.of(codeHighlightExtension(document.documentElement.dataset.theme)),
  bracketMatching(),
  indentOnInput(),
  EditorView.lineWrapping,
  EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }]),
  keymap.of([
    { key: 'Tab', run: acceptCompletion },
    indentWithTab,
    { key: 'Mod-s', run: () => { void onSave(); return true; } },
    { key: 'Mod-r', run: openSearchPanel, preventDefault: true },
  ]),
  // ...
],
```

(`autocompletion` itself is not called again here — `basicSetup` already installed one
instance; calling it a second time would risk a duplicate state field. Only the
language-data source and the keymap entry are new.)

## Test strategy

- `node --check desktop/src/main.js` (existing baseline for frontend files).
- Contract-test additions in `tests/desktop-ui-contract.test.ts` reading
  `code-editor.js`: the `EditorState.languageData.of(...)` line with `completeAnyWord`
  exists, and the `Tab`/`acceptCompletion` keymap entry exists **before**
  `indentWithTab` in source order (order matters here, not just presence — a test that
  only checks both strings exist would pass even if Tab never actually reaches
  `acceptCompletion`).
- **Manual verification is mandatory before this task is called done**, on both a
  CodeMirror-backed file (e.g. `.js`, confirming a suggestion appears while typing and
  Tab both accepts it and still indents normally on a line with no popup open) and a
  Monaco-backed one (e.g. `.rb` or `.go`, confirming the pre-existing default behavior
  genuinely holds in this app's actual Tauri WebView, not just in Monaco's own source).
  Also confirm on one of the six previously-silent CodeMirror languages (e.g. `.rs` or
  `.json`) that buffer-word suggestions now appear.

## Boundaries

**Always:** keep this syntactic — buffer words plus whatever each language package
already bundles. Reuse each engine's own native suggestion widget; never build a custom
popup.

**Ask first:** if manual verification finds Tab conflicts with something else already
using it in either engine (e.g. snippet tab-stops, if CodeMirror's `snippetKeymap` is
ever added later), report back rather than silently reordering keymaps further.

**Never:** no language server, no per-language external process, no project-wide symbol
index, no type-aware or import-aware suggestions — explicitly out of scope, matches the
existing "Out of scope: Language server" boundary already declared in
`docu/specs/SPEC-file-workspace.md`. Never add a new language to either engine as part
of this task — scope is autocomplete for the languages already supported.
