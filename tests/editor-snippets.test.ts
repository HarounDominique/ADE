import test from "node:test";
import assert from "node:assert/strict";
// The static desktop module is intentionally outside tsconfig's TypeScript include.
// @ts-expect-error The browser-loaded helper has no declaration file by design.
import { toMonacoSnippet } from "../desktop/src/editor-snippets.js";

test("toMonacoSnippet gives linked fields (same name repeated) the same field number", () => {
  assert.equal(
    toMonacoSnippet('for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}'),
    'for (int ${1:i} = 0; ${1:i} < ${2:limit}; ${1:i}++) {\n\t$0\n}',
  );
});

test("toMonacoSnippet turns the empty ${} placeholder into the final stop $0", () => {
  assert.equal(toMonacoSnippet('System.out.println(${});'), 'System.out.println($0);');
});

test("toMonacoSnippet passes a template with no placeholders through unchanged", () => {
  assert.equal(toMonacoSnippet('break;'), 'break;');
});

test("toMonacoSnippet leaves a single numbered field with no trailing $0 when the template has no final stop", () => {
  assert.equal(toMonacoSnippet('${condition}'), '${1:condition}');
});
