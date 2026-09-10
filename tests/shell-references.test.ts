import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

/** Every function this shell calls has to exist. That sounds like something a
    compiler would say, but these are plain modules with no compile step and the
    rest of the suite compares strings, so a call left behind by a refactor is
    invisible to all of it — until the webview throws a ReferenceError while
    loading and every listener registered after that line silently never exists.

    That is what happened when the editing surface moved to its own module:
    `initializeCodeEditor()` stayed behind one line above the file filter's
    listener, so the filter, the History refresh and everything after them were
    never wired, with no error anywhere an operator or a test could see.

    The file is parsed rather than pattern-matched, because prose in a comment,
    a word inside a template literal and `\r` inside a regular expression all
    read as calls to something otherwise. */
const shellModules = ["main.js", "code-editor.js", "editor-window.js", "paths.js", "project-context.js", "project-snapshot.js"];

/** What the platform provides, and nothing else. Anything called that is not
    here, not declared and not imported is a call into nothing. */
const platform = new Set([
  "Array", "Boolean", "Date", "Error", "JSON", "Map", "Math", "Number", "Object", "Promise", "RegExp", "Set", "String", "Symbol", "BigInt", "Proxy", "Reflect", "WeakMap", "WeakSet",
  "URL", "URLSearchParams", "Intl", "AbortController", "AbortSignal", "Blob", "File", "FileReader", "FormData", "Headers", "Request", "Response",
  "TextEncoder", "TextDecoder", "CSS", "Image", "Audio", "AudioContext", "webkitAudioContext", "Event", "CustomEvent", "ErrorEvent", "MutationObserver", "ResizeObserver", "IntersectionObserver", "Worker",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "queueMicrotask", "reportError",
  "fetch", "atob", "btoa", "structuredClone", "isNaN", "isFinite", "parseInt", "parseFloat", "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
  "console", "window", "document", "navigator", "localStorage", "sessionStorage", "performance", "crypto", "alert", "confirm", "prompt", "getComputedStyle", "matchMedia",
]);

/** Names this file binds, wherever it binds them: declarations, parameters,
    imports, catch clauses, and every shape of destructuring in between. */
function boundNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const bind = (name: ts.BindingName | ts.PropertyName | undefined): void => {
    if (!name) return;
    if (ts.isIdentifier(name)) { names.add(name.text); return; }
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) if (ts.isBindingElement(element)) bind(element.name);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) bind(node.name);
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) bind(node.name);
    if (ts.isImportSpecifier(node) || ts.isImportClause(node) || ts.isNamespaceImport(node)) bind(node.name);
    if (ts.isCatchClause(node) && node.variableDeclaration) bind(node.variableDeclaration.name);
    if (ts.isFunctionExpression(node) && node.name) bind(node.name);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

/** Only a bare name being called: `thing.method()` is somebody else's promise. */
function calledNames(source: ts.SourceFile): Set<string> {
  const called = new Set<string>();
  const visit = (node: ts.Node): void => {
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && ts.isIdentifier(node.expression)) {
      called.add(node.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return called;
}

test("every function the shell calls is one that exists", () => {
  for (const file of shellModules) {
    const path = new URL(`../desktop/src/${file}`, import.meta.url);
    const source = ts.createSourceFile(file, readFileSync(path, "utf8"), ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
    const bound = boundNames(source);
    const missing = [...calledNames(source)].filter((name) => !bound.has(name) && !platform.has(name)).sort();
    assert.deepEqual(missing, [], `${file} calls names it never declares or imports`);
  }
});
