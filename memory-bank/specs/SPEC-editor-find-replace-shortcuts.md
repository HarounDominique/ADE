# SPEC: In-file find, next/previous match, and replace shortcuts

status: approved

## Objective

The requested shortcuts (find in file, next match, previous match, replace in file)
turn out to already exist almost entirely, on both editing engines this app uses
(`desktop/src/code-editor.js` runs CodeMirror for common languages and Monaco as the
fallback for the rest — confirmed by reading the file directly, not assumed):

- **Find** (`Mod-f`): already default in both — CodeMirror's `basicSetup` (already in
  use, `initializeCodeEditor()`) bundles `@codemirror/search`'s `searchKeymap`
  transitively via the `codemirror` metapackage (confirmed in
  `node_modules/codemirror/dist/index.js`, which imports `searchKeymap` from
  `@codemirror/search` and spreads it into its own keymap — no new dependency needed
  despite `@codemirror/search` not being a *direct* dependency). Monaco's own
  `actions.find` is `Mod-f` by default too (confirmed in
  `node_modules/monaco-editor/.../findController.js`).
- **Next match** (`F3` / `Mod-g` on Mac) and **previous match** (`Shift-F3` /
  `Mod-Shift-g` on Mac): already default in both engines, and already exactly the key
  combinations requested — CodeMirror's `searchKeymap` binds `F3`/`Mod-g` (`findNext`)
  and `Shift-F3`/`Mod-Shift-g` (`findPrevious`) directly; Monaco's find controller
  registers the identical primary/mac-override pair for its own next/previous actions.
- **Replace** (`Mod-r` requested): the one real gap. CodeMirror's search panel (opened
  by `Mod-f`) already renders a "replace"/"replace all" UI inline once open, so no new
  panel is needed — but nothing currently maps `Mod-r` to open it in replace-ready form.
  Monaco defaults its own replace action (`editor.action.startFindReplaceAction`) to
  `Mod-h` (Mac: `Cmd-Alt-f`), not `Mod-r` — needs a remap.

This spec is deliberately narrow: add exactly the one missing binding to each engine,
verify the rest genuinely already works (it should, per the engines' own source, but
this codebase has not yet exercised it), and flag one real unknown that only manual
testing in the actual Tauri WebView can resolve.

## Structure

- **`desktop/src/code-editor.js`**: `createCodeEditorSurface`'s CodeMirror
  `keymap.of([...])` (inside `initializeCodeEditor`) gains one entry mapping `Mod-r` to
  `openSearchPanel` (imported from `@codemirror/search`, now a direct dependency —
  see Boundaries). `initializeMonacoEditor` gains one
  `monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => { ... })`
  call triggering Monaco's own `editor.action.startFindReplaceAction`.
- **`desktop/package.json`**: `@codemirror/search` added as a direct dependency — it
  was only ever transitively available through `codemirror`'s own bundling before this
  task, and this file now imports from it directly, which should not rely on an
  un-declared transitive dependency.
- No new UI: both engines' find/replace panels are native, in-editor widgets that
  already exist and render inline in the editor viewport — nothing to build here.

## Style

`desktop/src/code-editor.js`, CodeMirror side (inside `initializeCodeEditor`'s
`keymap.of([...])`, alongside the existing `indentWithTab`/`Mod-s` entries):

```js
import { openSearchPanel } from '@codemirror/search';
// ...
keymap.of([
  indentWithTab,
  { key: 'Mod-s', run: () => { void onSave(); return true; } },
  { key: 'Mod-r', run: openSearchPanel, preventDefault: true },
]),
```

Monaco side (inside `initializeMonacoEditor`, alongside the existing `Mod-s` command):

```js
monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => {
  monacoEditor.getAction('editor.action.startFindReplaceAction')?.run();
});
```

## Test strategy

- `node --check desktop/src/main.js` (the shell still imports `code-editor.js`
  transitively; a syntax check is this repo's existing baseline for frontend files).
- Contract-test additions in `tests/desktop-ui-contract.test.ts` (reading
  `code-editor.js` this time, not `main.js`) asserting: the new `@codemirror/search`
  import exists, the `Mod-r` CodeMirror keymap entry exists, and the Monaco
  `KeyMod.CtrlCmd | KeyCode.KeyR` command registration exists.
- **Manual verification is mandatory before this task is called done**, and is the
  *primary* verification here, not a formality — three things a string-match test
  cannot confirm: (1) `Mod-f`/`F3`/`Shift-F3`/`Mod-g`/`Shift-Mod-g` genuinely already
  work in the running app on both a CodeMirror-backed file (e.g. a `.js` file) and a
  Monaco-backed one (e.g. a `.go` or `.rb` file) — they should, per the engines' own
  source, but this has never actually been exercised in this app; (2) the new `Mod-r`
  binding opens a usable replace UI on both engines; (3) **`Mod-r`/`Ctrl-r` does not
  trigger a native WebView reload** — this codebase has no existing devtools/reload
  guard (checked: no `preventDefault` on a reload-shaped key anywhere in `main.js` or
  `lib.rs`, no relevant Tauri config), so whether the WebView intercepts the key before
  JS ever sees it is a genuine unknown this spec cannot resolve by reading code alone.
  If it does reload, this task's Boundaries below apply.

## Boundaries

**Always:** reuse each engine's own native find/replace UI — never build a custom
search panel when one already ships with the editor in use.

**Ask first:** if manual verification finds that `Mod-r`/`Ctrl-r` triggers a native
WebView reload instead of reaching the editor's keydown handler, this spec's chosen
shortcut cannot ship as specified — report back for a different key combination or a
`preventDefault`-based guard, rather than silently picking a workaround.

**Never:** never build project-wide search/replace as part of this task — this spec is
scoped to the current open file only (items #5-6 from the original request are
separate, larger tasks).
