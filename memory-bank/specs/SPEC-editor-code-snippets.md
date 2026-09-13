# SPEC: Abbreviation-triggered code snippets (live templates)

status: approved

## Objective

Add abbreviation-triggered snippet expansion to the Editor (`desktop/src/code-editor.js`),
on top of `editor-autocomplete`'s suggestion popup — typing a short label and pressing
Tab inserts a syntax skeleton (`if`, `for`, `while`, a function/method, a class-or-
equivalent) or, for a handful of languages, a well-known idiom (Java `sout` →
`System.out.println(...)`, `psvm` → a `main` method; Go `iferr` → the `if err != nil`
check; Python a `__main__` guard; JavaScript/TypeScript `clg` → `console.log(...)`).
After expansion, `Tab`/`Shift-Tab` move between the snippet's placeholder fields instead
of triggering another suggestion, until the last one is reached.

Confirmed with the operator as a genuinely bigger, content-heavy follow-up to
`editor-autocomplete`, not a bug in it — that task's suggestion popup and its Tab-accept
binding are unchanged prerequisites this one builds on.

## Scope (approved by the operator)

**Tier A — structural skeletons** (`if`, `for`, `while`, function/method, and a
class-or-equivalent where the language has one): authored for the 20 languages below
that don't already have one from their CodeMirror package. JavaScript, TypeScript and
Python are excluded from Tier A authoring — `@codemirror/lang-javascript` and
`@codemirror/lang-python` already ship real `if`/`for`/`while`/`class`/`function`-or-
`def` snippets (confirmed by reading both packages' dist files directly), so nothing
new is needed there for structural skeletons.

Authored (CodeMirror-engine languages): Java, C++, PHP, Rust. Corrected 2026-09-13,
found in Phase 2 review: C and C# are actually Monaco-engine in this app
(`desktop/src/code-editor.js`'s `monacoLanguageDefinitions`, not `codeLanguageDefinitions`)
— an error in this spec's original draft, not in the shipped code. The catalog itself
is engine-neutral by design (one neutral template, translated per engine at wiring
time), so this misclassification had no effect on the content authored.

Authored (Monaco-engine languages): C, C#, Go, Kotlin, Swift, Ruby, Scala, Dart,
Objective-C, Lua, Perl, PowerShell, Shell, F#, Elixir, R.

Class-or-equivalent is a `struct` for C, Rust and Go, a `defmodule` for Elixir, and is
omitted (documented, not silently missing) for Lua, Perl, PowerShell, Shell, F# and R —
none of these has a class concept commonly reached for in ordinary code, and inventing
one would be exactly the "recognizable to nobody" risk this spec means to avoid.
Elixir also omits `while` (the language has none; recursion is idiomatic instead).

**Tier B — iconic idioms**, deliberately small (1-2 per language), only where one is
genuinely well-known, not invented for coverage: Java (`sout`, `psvm`), Go (`iferr`,
plus a `main` skeleton), Python (`main` → the `__name__ == "__main__"` guard),
JavaScript/TypeScript (`clg` → `console.log`). Updated 2026-09-13 per Phase 2 review:
C++, C, C# and Rust each also fold in a `main` skeleton — the same iconic-entry-point
idiom as Go and Java's `psvm`, accepted as in-scope rather than a drift from this list
(a compiled language's `main` function is exactly the kind of "genuinely well-known,
not invented" idiom this tier is for). This remains a starter set, not a claim of
parity with a mature IDE's built-up idiom library — stated explicitly in Boundaries.

**Excluded entirely** (config/markup/data formats, not "code" in the sense these
constructs apply to): CSS, HTML, JSON, Markdown, SQL, XML, GraphQL, Protocol Buffers,
Dockerfile.

## Structure

- **`desktop/src/editor-snippets.js`** (new file): the single source of truth for
  every snippet, in one neutral template syntax shared by both engines —
  `${name}` for a placeholder field (repeats of the same name are linked/mirrored
  fields), `${}` for the final cursor stop after Tab-ing through the rest. This is
  CodeMirror's own native snippet syntax already, so the CodeMirror side needs no
  translation; only Monaco's side does (see Style).

  ```js
  export const snippetCatalog = {
    Java: {
      structural: [
        { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
        { label: 'for', detail: 'indexed for loop', template: 'for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}' },
        { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
        { label: 'fun', detail: 'method', template: '${returnType} ${name}(${params}) {\n\t${}\n}' },
        { label: 'class', detail: 'class', template: 'class ${Name} {\n\t${}\n}' },
      ],
      idioms: [
        { label: 'sout', detail: 'System.out.println', template: 'System.out.println(${});' },
        { label: 'psvm', detail: 'public static void main', template: 'public static void main(String[] args) {\n\t${}\n}' },
      ],
    },
    Go: {
      structural: [
        { label: 'if', detail: 'if statement', template: 'if ${condition} {\n\t${}\n}' },
        { label: 'for', detail: 'indexed for loop', template: 'for ${i} := 0; ${i} < ${limit}; ${i}++ {\n\t${}\n}' },
        { label: 'while', detail: 'for as while', template: 'for ${condition} {\n\t${}\n}' },
        { label: 'fun', detail: 'function', template: 'func ${name}(${params}) {\n\t${}\n}' },
        { label: 'struct', detail: 'struct', template: 'type ${Name} struct {\n\t${}\n}' },
      ],
      idioms: [
        { label: 'main', detail: 'main function', template: 'func main() {\n\t${}\n}' },
        { label: 'iferr', detail: 'error check', template: 'if err != nil {\n\treturn ${err}\n}' },
      ],
    },
    Python: {
      structural: [],
      idioms: [
        { label: 'main', detail: '__main__ guard', template: 'if __name__ == "__main__":\n\t${}' },
      ],
    },
    JavaScript: {
      structural: [],
      idioms: [{ label: 'clg', detail: 'console.log', template: 'console.log(${});' }],
    },
    TypeScript: {
      structural: [],
      idioms: [{ label: 'clg', detail: 'console.log', template: 'console.log(${});' }],
    },
    // ... the remaining 18 languages (C++, C, C#, PHP, Rust, Kotlin, Swift, Ruby,
    // Scala, Dart, Objective-C, Lua, Perl, PowerShell, Shell, F#, Elixir, R), each
    // with a `structural` array in the same shape, authored during the build phase
    // that covers it, following this exact format and the per-language exceptions
    // (no class, no while, etc.) named in Scope above.
  };
  ```

- **`desktop/src/code-editor.js`**:
  - CodeMirror side: `codeLanguageDefinitions` entries gain the catalog lookup.
    `initializeCodeEditor`'s `codeEditorLanguage.reconfigure(...)` call (currently
    `language ? language() : []`) becomes
    `language ? [language(), codeMirrorSnippetExtension(definition.label)] : []` —
    `codeMirrorSnippetExtension` (new function) wraps that language's catalog entries
    (`structural` + `idioms`) as `EditorState.languageData.of(() => [{ autocomplete:
    completeFromList(entries.map(({label, detail, template}) =>
    snippetCompletion(template, { label, detail, type: 'keyword' })) }])`, scoped to
    that one file's active language via the same compartment swap already used for
    per-file language switching — not global, unlike `completeAnyWord`.
  - Monaco side: `initializeMonacoEditor` gains one
    `monaco.languages.registerCompletionItemProvider(monacoLanguage, { provideCompletionItems })`
    call per Monaco-engine language present in the catalog, registered once at module
    load (Monaco's provider registration is global per language id, not per editor
    instance — confirmed by how the rest of this file's Monaco setup already treats
    language registration as one-time). Each provider's `provideCompletionItems`
    returns the language's catalog entries translated to Monaco's own snippet syntax
    (see Style) with `insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet`
    and `range` computed from `model.getWordUntilPosition(position)`, the documented
    Monaco pattern for replacing the typed abbreviation with the expansion.

## Style

The one translation this needs — neutral `${name}`/`${}` to Monaco's numbered
`${n:name}`/`$0` — is a single small function, not duplicated content:

```js
// desktop/src/editor-snippets.js
export function toMonacoSnippet(template) {
  const seen = new Map();
  let next = 1;
  return template.replace(/\$\{([^}]*)\}/g, (_, name) => {
    if (name === '') return '$0';
    if (!seen.has(name)) seen.set(name, next++);
    return `\${${seen.get(name)}:${name}}`;
  });
}
```

CodeMirror wiring (`desktop/src/code-editor.js`, replacing the plain
`language ? language() : []` reconfigure):

```js
import { completeFromList, snippetCompletion } from '@codemirror/autocomplete';
import { snippetCatalog } from './editor-snippets.js';

function codeMirrorSnippetExtension(label) {
  const entries = snippetCatalog[label];
  if (!entries) return [];
  const all = [...entries.structural, ...entries.idioms];
  if (!all.length) return [];
  return EditorState.languageData.of(() => [{
    autocomplete: completeFromList(all.map(({ label, detail, template }) =>
      snippetCompletion(template, { label, detail, type: 'keyword' }))),
  }]);
}
// ...
effects: codeEditorLanguage.reconfigure(language ? [language(), codeMirrorSnippetExtension(definitionLabel)] : []),
```

Monaco wiring (`initializeMonacoEditor`, once per catalog language with a
`monacoLanguage` id):

```js
import { snippetCatalog, toMonacoSnippet } from './editor-snippets.js';

for (const definition of monacoLanguageDefinitions) {
  const entries = snippetCatalog[definition.label];
  if (!entries) continue;
  const all = [...entries.structural, ...entries.idioms];
  if (!all.length) continue;
  monaco.languages.registerCompletionItemProvider(definition.monacoLanguage, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      return { suggestions: all.map(({ label, detail, template }) => ({
        label, detail, kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: toMonacoSnippet(template),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      })) };
    },
  });
}
```

## Test strategy

- `node --check` on `desktop/src/code-editor.js` and `desktop/src/editor-snippets.js`.
- Unit tests for `toMonacoSnippet` (the one piece of real logic, not just data):
  linked fields get the same number, `${}` becomes `$0`, an empty template round-trips,
  a template with no placeholders is returned unchanged aside from no `$0` needed.
- Contract-test additions in `tests/desktop-ui-contract.test.ts`: every `label` named
  in Scope above has a non-empty `snippetCatalog` entry (catches a language silently
  missing its promised content — this is the test that actually enforces "all 20
  languages", not a human re-counting a list); the CodeMirror wiring calls
  `codeMirrorSnippetExtension`; the Monaco wiring registers a provider per catalog
  language with a `monacoLanguage` id.
- **Manual verification is mandatory before this task is called done**, on at least:
  Java (`sout`+Tab, `psvm`+Tab, confirm Tab then walks the `params`/body placeholder(s)
  of a structural snippet like `fun`), Go (`iferr`+Tab), Python (`main`+Tab — confirm
  this doesn't collide with the language's own already-bundled snippets), and one
  Monaco-engine language (e.g. Ruby or Swift, confirming the registered provider
  actually surfaces in this app's real WebView, not just in isolated Monaco docs).

## Boundaries

**Always:** keep the neutral template as the single source of truth — never hand-write
the Monaco-syntax version of a snippet directly; always go through `toMonacoSnippet`.
Every new language added to the catalog must land with its Tier A entry in the same
build phase that claims it, not a stub.

**Ask first:** if a language's genuinely idiomatic structural shape doesn't fit the
`if`/`for`/`while`/function/class-or-equivalent mold assumed here (discovered while
authoring it), report back with the proposed adaptation rather than forcing a
mismatched template into the catalog just to fill the row.

**Never:** this is a fixed, hand-authored catalog — never becomes user-editable,
project-configurable, or dynamically generated from a model in this task; that is a
plausible future request, explicitly out of scope here. Never claim exhaustive parity
with a mature IDE's live-template library — Tier B is named a starter set everywhere
it's described (README, docu, this spec) for exactly that reason. Never touches
`completeAnyWord`/`acceptCompletion` from `editor-autocomplete` — this task adds a
second, additional completion source per language, it doesn't modify the first.
