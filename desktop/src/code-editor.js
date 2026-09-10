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
import { tags } from '@lezer/highlight';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { pathBaseName, fileExtension } from './paths.js';

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

/** One editing surface bound to one element. Everything the shell used to keep
    in module globals -- the two engines, which is showing, the caret -- belongs
    to the surface, so a second window can have its own without the two treading
    on each other. */
export function createCodeEditorSurface({ parent, onChange = () => {}, onSave = () => {} }) {
  const codeEditorLanguage = new Compartment();
  const codeEditorHighlight = new Compartment();
  let codeEditorView = null;
  let monacoEditor = null;
  let engine = 'codemirror';

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
          keymap.of([
            indentWithTab,
            { key: 'Mod-s', run: () => { void onSave(); return true; } },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange();
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
      codeEditorView.dispatch({
        changes: { from: 0, to: current.length, insert: content },
        effects: codeEditorLanguage.reconfigure(language ? language() : []),
      });
      engine = 'codemirror';
      showEngine(engine);
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
  };
}
