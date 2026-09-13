---
slug: editor-find-replace-shortcuts
spec: SPEC-editor-find-replace-shortcuts.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — `@codemirror/search` added as a direct dependency; `Mod-r` keymap entry
  on the CodeMirror side (`openSearchPanel`); `Ctrl/Cmd+R` command on the Monaco side
  (`editor.action.startFindReplaceAction`). No creative needed — both engines' own
  existing extension points, one line each.
  (satisfies: SPEC-editor-find-replace-shortcuts.md#objective, #structure, #style)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions in
  `tests/desktop-ui-contract.test.ts` reading `code-editor.js`.

- [ ] Phase 2 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` — this phase is the real substance of this task,
  not a formality: confirm find/next/previous already work unmodified on a
  CodeMirror-backed file (e.g. `.js`) and a Monaco-backed one (e.g. `.go`/`.rb`);
  confirm the new replace binding opens a usable replace UI on both; confirm
  `Ctrl/Cmd+R` does not trigger a native WebView reload (no existing guard against
  this in the codebase — genuine unknown). No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-editor-find-replace-shortcuts.md#test-strategy, #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: RUNNING
**Current Phase**: 1
**Current Step**: 5/6
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

[Anything a build phase did differently from what the spec/plan predicted, and whether
it was accepted, and by whom.]
