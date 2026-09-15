/** The editing surface itself, apart from any window that hosts one. It was
    written inside the main shell, where a single hidden set of module globals
    held the CodeMirror view, the Monaco editor and which of the two was on
    screen. A file opened in its own window needs exactly this and none of the
    rest of the shell, so the surface becomes something a window asks for
    rather than something the shell is. */
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { EditorView, hoverTooltip, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import { completeAnyWord, acceptCompletion, completeFromList, hasNextSnippetField, nextSnippetField, snippet, snippetCompletion } from '@codemirror/autocomplete';
import { pathBaseName, fileExtension } from './paths.js';
import { snippetCatalog, toMonacoSnippet } from './editor-snippets.js';

/** Monaco is a singleton for the page: loading it twice would define its themes
    twice and cost the download again. */
let monaco = null;
let monacoLoader = null;


/** Editor syntax palettes.  CodeMirror's defaultHighlightStyle is written for a
    white page -- it paints names in pure blue and comments in near-black -- so
    in dark mode a Java class or field sank into the background and could not be
    read. The dark style is built from the product's tokens and nothing in it
    falls below 5:1. The light one is Everest's own scheme, taken from the
    theme's colour file rather than derived, and measured against the editor
    background it is a code palette rather than a body-text one: keyword,
    number, type, name, property and operator clear 4.5:1, while string
    (2.16:1), meta (2.64:1), callee (3.22:1), comment (3.96:1), invalid (4.33:1)
    and definition (4.25:1) do not. That is the trade the theme makes, and it is
    written down rather than implied to have been checked.

    The two palettes assign the same hue to the same role, so a file keeps its
    shape across a theme switch: purple for keywords, green for types, blue for
    the name being defined, red for strings, amber for numbers and annotations. */
const codeHighlightPalettes = {
  dark: {
    keyword: '#c9b0ff', string: '#f3a3aa', number: '#f2cc85', comment: '#8ba2b6',
    type: '#7cd9a5', name: '#cfdae4', definition: '#8fb9ff', callee: '#6fdccf',
    property: '#95e9de', meta: '#f2cc85', operator: '#a6b8c8', invalid: '#ff9aa2',
  },
  light: {
    keyword: '#2e674f', string: '#ec9c81', number: '#1a6687', comment: '#6e828f',
    type: '#246a89', name: '#131b25', definition: '#397fb7', callee: '#30a25e',
    property: '#567b8a', meta: '#c8963e', operator: '#567b8a', invalid: '#c8534e',
  },
};

function codeHighlightStyle(theme) {
  const palette = codeHighlightPalettes[theme === 'light' ? 'light' : 'dark'];
  return HighlightStyle.define([
    { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.operatorKeyword, tags.self, tags.null, tags.atom, tags.bool], color: palette.keyword },
    { tag: [tags.string, tags.special(tags.string), tags.regexp], color: palette.string },
    { tag: [tags.escape, tags.character], color: palette.number },
    { tag: [tags.number, tags.integer, tags.float, tags.unit], color: palette.number },
    { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: palette.comment, fontStyle: 'italic' },
    { tag: [tags.typeName, tags.className, tags.namespace, tags.standard(tags.typeName)], color: palette.type },
    { tag: [tags.variableName, tags.labelName], color: palette.name },
    { tag: [tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: palette.definition },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName], color: palette.callee },
    { tag: [tags.propertyName, tags.attributeName], color: palette.property },
    { tag: [tags.meta, tags.annotation, tags.processingInstruction, tags.definitionKeyword, tags.moduleKeyword], color: palette.meta },
    { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket, tags.derefOperator], color: palette.operator },
    { tag: [tags.tagName], color: palette.type },
    { tag: [tags.heading], color: palette.definition, fontWeight: '600' },
    { tag: [tags.link, tags.url], color: palette.callee, textDecoration: 'underline' },
    { tag: [tags.emphasis], fontStyle: 'italic' },
    { tag: [tags.strong], fontWeight: '600' },
    { tag: [tags.strikethrough], textDecoration: 'line-through' },
    { tag: [tags.invalid], color: palette.invalid },
  ]);
}

/** basicSetup already installs defaultHighlightStyle, and the first extension
    in the list wins, so simply adding ours after it changed nothing on screen.
    Prec.highest puts the theme's style in front of the bundled one. */
export function codeHighlightExtension(theme) {
  return Prec.highest(syntaxHighlighting(codeHighlightStyle(theme), { fallback: true }));
}

function configureMonacoThemes() {
  if (!monaco) return;
  monaco.editor.defineTheme('ade-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#142333',
    'editor.foreground': '#edf4f7',
    'editorLineNumber.foreground': '#64798d',
    'editorLineNumber.activeForeground': '#c4d2dc',
    'editor.lineHighlightBackground': '#203348',
    'editor.selectionBackground': '#315a82',
    'editorCursor.foreground': '#69d5c8',
    'editorIndentGuide.background': '#2f4357',
  },
  });
  monaco.editor.defineTheme('ade-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#fdfeff',
    'editor.foreground': '#131b25',
    'editorLineNumber.foreground': '#7d9aa6',
    'editorLineNumber.activeForeground': '#1a6687',
    'editor.lineHighlightBackground': '#e6edf5',
    'editor.selectionBackground': '#d5ece2',
    'editorCursor.foreground': '#467196',
    'editorIndentGuide.background': '#dde7f6',
  },
  });
}

/** One registerCompletionItemProvider call per catalog language that has a
    Monaco language id, generic over monacoLanguageDefinitions so a later
    phase's languages are picked up with no new wiring -- content only.
    Monaco's provider registration is global per language id, not per editor
    instance, so this runs once, from inside loadMonaco's own singleton-
    cached promise, the same place configureMonacoThemes already treats
    Monaco setup as one-time regardless of how many editor surfaces (windows)
    end up sharing this module. */
function registerMonacoSnippetProviders() {
  if (!monaco) return;
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
}

export async function loadMonaco() {
  if (monaco) return monaco;
  if (!monacoLoader) {
    monacoLoader = Promise.all([
      import('monaco-editor/esm/vs/editor/editor.api.js'),
      import('monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/dart/dart.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/elixir/elixir.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/fsharp/fsharp.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/go/go.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/graphql/graphql.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/java/java.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/lua/lua.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/objective-c/objective-c.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/perl/perl.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/php/php.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/protobuf/protobuf.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/python/python.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/r/r.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/scala/scala.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js'),
      import('monaco-editor/esm/vs/basic-languages/swift/swift.contribution.js'),
    ]).then(([editor]) => {
      monaco = editor;
      configureMonacoThemes();
      registerMonacoSnippetProviders();
      // Monaco arrives after the theme was chosen, so it is told which one it
      // is joining. The shell used to be asked, from a module that cannot see
      // it: the first file that needed Monaco threw instead of opening.
      monaco.editor.setTheme(document.documentElement.dataset.theme === 'light' ? 'ade-light' : 'ade-dark');
      return monaco;
    });
  }
  return monacoLoader;
}

export const codeLanguageDefinitions = [
  { label: 'JavaScript', extensions: ['js', 'mjs', 'cjs', 'jsx'], language: () => javascript({ jsx: true }) },
  { label: 'TypeScript', extensions: ['ts', 'mts', 'cts', 'tsx'], language: () => javascript({ jsx: true, typescript: true }) },
  { label: 'C++', extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'], language: () => cpp() },
  { label: 'Java', extensions: ['java'], language: () => java() },
  { label: 'PHP', extensions: ['php'], language: () => php() },
  { label: 'Python', extensions: ['py', 'pyw'], language: () => python() },
  { label: 'Rust', extensions: ['rs'], language: () => rust() },
  { label: 'CSS', extensions: ['css', 'scss'], language: () => css() },
  { label: 'HTML', extensions: ['html', 'htm'], language: () => html() },
  { label: 'JSON', extensions: ['json', 'jsonc'], language: () => json() },
  { label: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'], language: () => markdown() },
  { label: 'SQL', extensions: ['sql'], language: () => sql() },
  { label: 'XML', extensions: ['xml', 'svg', 'xsl', 'xsd'], language: () => xml() },
  { label: 'YAML', extensions: ['yml', 'yaml'], language: () => yaml() },
];

export const monacoLanguageDefinitions = [
  { label: 'C', extensions: ['c', 'h'], monacoLanguage: 'c' },
  { label: 'C#', extensions: ['cs', 'csx', 'cake'], monacoLanguage: 'csharp' },
  { label: 'Dart', extensions: ['dart'], monacoLanguage: 'dart' },
  { label: 'Dockerfile', fileNames: ['dockerfile', 'containerfile'], monacoLanguage: 'dockerfile' },
  { label: 'Elixir', extensions: ['ex', 'exs'], monacoLanguage: 'elixir' },
  { label: 'F#', extensions: ['fs', 'fsi', 'fsx', 'fsscript'], monacoLanguage: 'fsharp' },
  { label: 'Go', extensions: ['go'], monacoLanguage: 'go' },
  { label: 'GraphQL', extensions: ['graphql', 'gql'], monacoLanguage: 'graphql' },
  { label: 'Kotlin', extensions: ['kt', 'kts'], monacoLanguage: 'kotlin' },
  { label: 'Lua', extensions: ['lua'], monacoLanguage: 'lua' },
  { label: 'Objective-C', extensions: ['m', 'mm'], monacoLanguage: 'objective-c' },
  { label: 'Perl', extensions: ['pl', 'pm', 'pod'], monacoLanguage: 'perl' },
  { label: 'PowerShell', extensions: ['ps1', 'psm1', 'psd1'], monacoLanguage: 'powershell' },
  { label: 'Protocol Buffers', extensions: ['proto'], monacoLanguage: 'proto' },
  { label: 'R', extensions: ['r', 'R'], monacoLanguage: 'r' },
  { label: 'Ruby', extensions: ['rb', 'rake', 'gemspec'], monacoLanguage: 'ruby' },
  { label: 'Scala', extensions: ['scala', 'sc'], monacoLanguage: 'scala' },
  { label: 'Shell', extensions: ['sh', 'bash', 'zsh', 'fish'], monacoLanguage: 'shell' },
  { label: 'Swift', extensions: ['swift'], monacoLanguage: 'swift' },
];

export const formatterParsers = {
  js: 'babel', mjs: 'babel', cjs: 'babel', jsx: 'babel',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
  json: 'json-stringify', jsonc: 'json', css: 'css', scss: 'scss',
  html: 'html', htm: 'html', md: 'markdown', markdown: 'markdown', mdown: 'markdown', mkd: 'markdown', yaml: 'yaml', yml: 'yaml',
};

function definitionMatchesPath(definition, filePath) {
  const extension = fileExtension(filePath);
  const fileName = pathBaseName(filePath).toLowerCase();
  return definition.extensions?.includes(extension) || definition.fileNames?.some((name) => name.toLowerCase() === fileName);
}

export function editorDefinitionForPath(filePath) {
  return codeLanguageDefinitions.find((definition) => definitionMatchesPath(definition, filePath))
    ?? monacoLanguageDefinitions.find((definition) => definitionMatchesPath(definition, filePath));
}

export function languageLabelForPath(filePath) {
  return editorDefinitionForPath(filePath)?.label ?? 'Plain text';
}

export function formatterParserForPath(filePath) {
  return formatterParsers[fileExtension(filePath)] ?? null;
}

/** Wraps one language's catalog entries -- its structural skeletons plus the
    handful of well-known idioms -- as a second, per-language completion
    source alongside completeAnyWord's buffer-word fallback below. Threaded
    through the same codeEditorLanguage compartment swap that already
    reconfigures the language on file open, so it is scoped to that one
    file's active language -- unlike completeAnyWord, which stays global.
    Never touches completeAnyWord/acceptCompletion itself. */
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

/** One editing surface bound to one element. Everything the shell used to keep
    in module globals -- the two engines, which is showing, the caret -- belongs
    to the surface, so a second window can have its own without the two treading
    on each other. */
export function createCodeEditorSurface({ parent, onChange = () => {}, onSave = () => {}, lsp = null }) {
  const codeEditorLanguage = new Compartment();
  const codeEditorHighlight = new Compartment();
  let codeEditorView = null;
  let monacoEditor = null;
  let engine = 'codemirror';
  let activeFilePath = '';
  let lspVersion = 0;
  let suppressLspChange = false;

  function initializeCodeEditor() {
    if (!parent || codeEditorView) return;
    codeEditorView = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          basicSetup,
          codeEditorLanguage.of([]),
          codeEditorHighlight.of(codeHighlightExtension(document.documentElement.dataset.theme)),
          bracketMatching(),
          indentOnInput(),
          EditorView.lineWrapping,
          lintGutter(),
          hoverTooltip((view, pos) => lspHover(view, pos)),
          EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }]),
          Prec.highest(keymap.of([
            { key: 'Tab', run: (view) => expandJavaAbbreviation(view) || acceptCompletion(view) },
            indentWithTab,
            { key: 'Mod-s', run: () => { void onSave(); return true; } },
            { key: 'Mod-Alt-Enter', run: () => { void goToDefinition(); return true; } },
            // Find (Mod-f), next/previous match (F3/Mod-g, Shift-F3/Shift-Mod-g)
            // are already bound by basicSetup's own bundled searchKeymap
            // (@codemirror/search, pulled in transitively through the
            // codemirror metapackage). Only Replace had no binding -- the
            // search panel this opens already renders a replace UI inline
            // once open, so no separate replace-panel exists to target.
            { key: 'Mod-r', run: openSearchPanel, preventDefault: true },
          ])),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            onChange();
            if (!suppressLspChange && activeFilePath.toLowerCase().endsWith('.java')) {
              lspVersion += 1;
              void lsp?.change?.(activeFilePath, codeEditorView.state.doc.toString(), lspVersion);
            }
          }),
        ],
      }),
      parent,
    });
  }

  async function initializeMonacoEditor() {
    if (!parent) return null;
    await loadMonaco();
    if (monacoEditor) return monacoEditor;
    monacoEditor = monaco.editor.create(parent, {
      value: '',
      language: 'plaintext',
      theme: document.documentElement.dataset.theme === 'light' ? 'ade-light' : 'ade-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true,
      fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 19,
      padding: { top: 14, bottom: 24 },
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
    });
    monacoEditor.onDidChangeModelContent(() => onChange());
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { void onSave(); });
    // Find (Mod-f) and next/previous match (F3/Mod-g, Shift-F3/Shift-Mod-g)
    // are already Monaco's own defaults. Its own Replace action defaults to
    // Mod-h (Mac: Cmd-Alt-f), not Mod-r -- remapped here to match.
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => {
      monacoEditor.getAction('editor.action.startFindReplaceAction')?.run();
    });
    return monacoEditor;
  }

  function showEngine(next) {
    if (!parent) return;
    parent.querySelector('.cm-editor')?.classList.toggle('editor-engine-hidden', next !== 'codemirror');
    parent.querySelector('.monaco-editor')?.classList.toggle('editor-engine-hidden', next !== 'monaco');
  }

  return {
    engine: () => engine,

    async setContent(content = '', filePath = '', focus = false) {
      const definition = editorDefinitionForPath(filePath);
      if (definition?.monacoLanguage) {
        await initializeMonacoEditor();
        if (!monacoEditor) return;
        monacoEditor.setValue(content);
        const model = monacoEditor.getModel();
        if (model) monaco.editor.setModelLanguage(model, definition.monacoLanguage);
        engine = 'monaco';
        showEngine(engine);
        if (focus) monacoEditor.focus();
        return;
      }
      initializeCodeEditor();
      if (!codeEditorView) return;
      const current = codeEditorView.state.doc.toString();
      const language = definition?.language;
      if (activeFilePath && activeFilePath !== filePath && activeFilePath.toLowerCase().endsWith('.java')) void lsp?.close?.(activeFilePath);
      activeFilePath = filePath;
      lspVersion = 1;
      suppressLspChange = true;
      codeEditorView.dispatch({
        changes: { from: 0, to: current.length, insert: content },
        effects: codeEditorLanguage.reconfigure(language ? [language(), codeMirrorSnippetExtension(definition.label), ...(definition.label === 'Java' && lsp?.completion ? [EditorState.languageData.of(() => [{ autocomplete: (context) => lspCompletion(context) }])] : [])] : []),
      });
      suppressLspChange = false;
      engine = 'codemirror';
      showEngine(engine);
      if (definition.label === 'Java') void lsp?.open?.(filePath, content, lspVersion);
      if (focus) codeEditorView.focus();
    },

    value() {
      return engine === 'monaco'
        ? monacoEditor?.getValue() ?? ''
        : codeEditorView?.state.doc.toString() ?? '';
    },

    /** Where the reader was. Monaco counts in line and column, CodeMirror in
        characters, so the shape of a caret depends on the engine that took it. */
    captureViewState() {
      if (engine === 'monaco') {
        return { caret: monacoEditor?.getPosition() ?? null, scrollTop: monacoEditor?.getScrollTop() ?? 0 };
      }
      if (!codeEditorView) return { caret: null, scrollTop: 0 };
      return { caret: codeEditorView.state.selection.main.head, scrollTop: codeEditorView.scrollDOM.scrollTop };
    },

    restoreViewState(state) {
      if (!state) return;
      if (engine === 'monaco' && monacoEditor) {
        if (typeof state.caret === 'object' && state.caret) monacoEditor.setPosition(state.caret);
        monacoEditor.setScrollTop(state.scrollTop ?? 0);
        return;
      }
      if (!codeEditorView || typeof state.caret !== 'number') return;
      const anchor = Math.min(state.caret, codeEditorView.state.doc.length);
      codeEditorView.dispatch({ selection: { anchor } });
      codeEditorView.scrollDOM.scrollTop = state.scrollTop ?? 0;
    },

    applyTheme(theme) {
      if (monaco) monaco.editor.setTheme(theme === 'light' ? 'ade-light' : 'ade-dark');
      if (!codeEditorView) return;
      codeEditorView.dispatch({ effects: codeEditorHighlight.reconfigure(codeHighlightExtension(theme)) });
    },

    focus() {
      (engine === 'monaco' ? monacoEditor : codeEditorView)?.focus();
    },

    applyLspNotification(notification) {
      const message = notification?.message;
      if (!message || message.method !== 'textDocument/publishDiagnostics' || !codeEditorView) return;
      const uri = message.params?.uri;
      if (!uri || !activeFilePath || !uri.endsWith(activeFilePath.replaceAll('\\', '/'))) return;
      const diagnostics = (message.params?.diagnostics ?? []).map((diagnostic) => ({
        from: positionToOffset(codeEditorView.state, diagnostic.range?.start),
        to: positionToOffset(codeEditorView.state, diagnostic.range?.end ?? diagnostic.range?.start),
        severity: diagnostic.severity === 1 ? 'error' : diagnostic.severity === 2 ? 'warning' : 'info',
        message: diagnostic.message ?? 'Java diagnostic',
      }));
      codeEditorView.dispatch(setDiagnostics(codeEditorView.state, diagnostics));
    },
  };

  function lspCompletion(context) {
    if (!activeFilePath || !lsp?.completion) return null;
    const line = context.state.doc.lineAt(context.pos);
    const lineStart = line.from;
    const character = context.pos - lineStart;
    const word = context.matchBefore(/[\w$]*/);
    if (!context.explicit && !word?.text) return null;
    return lsp.completion(activeFilePath, { line: line.number - 1, character }).then((result) => {
      const items = Array.isArray(result) ? result : result?.items ?? [];
      return { from: word?.from ?? context.pos, options: items.map((item) => ({ label: item.label, detail: item.detail, type: completionKind(item.kind), apply: item.insertText ?? item.label })) };
    }).catch(() => null);
  }

  function expandJavaAbbreviation(view) {
    if (hasNextSnippetField(view.state)) return nextSnippetField(view);
    if (!activeFilePath.toLowerCase().endsWith('.java')) return false;
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    const match = /[A-Za-z][A-Za-z0-9]*$/.exec(line.text.slice(0, pos - line.from));
    if (!match) return false;
    const entries = [...(snippetCatalog.Java?.structural ?? []), ...(snippetCatalog.Java?.idioms ?? [])];
    const entry = entries.find((candidate) => candidate.label === match[0]);
    if (!entry) return false;
    snippet(entry.template)(view, { label: entry.label }, pos - match[0].length, pos);
    return true;
  }

  async function goToDefinition() {
    if (!activeFilePath || !lsp?.definition || !codeEditorView) return;
    const pos = codeEditorView.state.selection.main.head;
    const line = codeEditorView.state.doc.lineAt(pos);
    try {
      const result = await lsp.definition(activeFilePath, { line: line.number - 1, character: pos - line.from });
      const location = Array.isArray(result) ? result[0] : result;
      const uri = location?.uri;
      if (!uri) return;
      const target = decodeURIComponent(uri.replace(/^file:\/\//, ''));
      await lsp.onDefinition?.(target, location.range);
    } catch { /* definition is an enhancement; editing must remain unaffected */ }
  }

  function lspHover(view, pos) {
    if (!activeFilePath.toLowerCase().endsWith('.java') || !lsp?.hover) return null;
    const line = view.state.doc.lineAt(pos);
    return lsp.hover(activeFilePath, { line: line.number - 1, character: pos - line.from }).then((result) => {
      const contents = result?.contents;
      if (!contents) return null;
      const text = Array.isArray(contents) ? contents.map((item) => typeof item === 'string' ? item : item.value ?? '').join('\n') : typeof contents === 'string' ? contents : contents.value ?? '';
      if (!text) return null;
      return {
        pos,
        end: pos,
        above: true,
        create() {
          const dom = document.createElement('pre');
          dom.className = 'ade-lsp-hover';
          dom.textContent = text;
          return { dom };
        },
      };
    }).catch(() => null);
  }
}

function completionKind(kind) {
  return { 2: 'method', 3: 'function', 4: 'constructor', 5: 'field', 6: 'variable', 7: 'class', 8: 'interface', 9: 'module', 10: 'property', 14: 'keyword' }[kind] ?? 'text';
}

function positionToOffset(state, position) {
  if (!position) return 0;
  const line = state.doc.line(Math.max(1, Math.min(state.doc.lines, position.line + 1)));
  return Math.max(line.from, Math.min(line.to, line.from + position.character));
}
