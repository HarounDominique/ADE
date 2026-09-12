---
slug: explorer-open-in-terminal-and-file-manager
spec: SPEC-explorer-open-in-terminal-and-file-manager.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Backend: `reveal_in_file_manager`/`reveal_in_file_manager_in` in
  `desktop/src-tauri/src/lib.rs`, registered in `generate_handler![...]`, reusing the
  existing `open_with_desktop` helper. Rust unit tests: file resolves to its parent
  directory, directory resolves to itself, nonexistent path rejected. No creative
  needed — additive glue over an existing cross-platform helper, no new per-OS code.
  (satisfies: SPEC-explorer-open-in-terminal-and-file-manager.md#structure, #style, #test-strategy — backend half)
  Test strategy: `cd desktop/src-tauri && cargo check && cargo test`.

- [ ] Phase 2 — Frontend: two more `[data-workspace-entry-action]` items in
  `#workspace-context-menu` ("Open in Terminal", "Reveal in File Manager"); `createTerminalTab`
  gains an optional `cwd` option (default `workspaceRootPath`, every existing call site
  unaffected); `startTerminal` uses `tab.completionCwd` instead of the hardcoded
  `workspaceRootPath`; `openWorkspaceEntryInTerminal`/`revealWorkspaceEntryInFileManager`
  wired to the two new menu items. Markup and logic combined into one phase — both are
  small, and splitting them here would be padding for its own sake.
  (satisfies: SPEC-explorer-open-in-terminal-and-file-manager.md#objective, #structure, #style — frontend half)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions for the new
  menu items and the `cwd`/`completionCwd` wiring, in this same phase per the precedent
  set by every prior Explorer task.

- [ ] Phase 3 — Verification: full regression (`npm test`, `cargo test`), then a manual
  pass by the operator in `npm run desktop:dev` (Open in Terminal on a file — new tab at
  its parent directory; Open in Terminal on a directory — new tab at that directory;
  Reveal in File Manager on a file — native file manager opens at its parent folder;
  Reveal in File Manager on a directory — opens that folder; every existing terminal tab
  (the dock's "+", a run's console) still starts at the Project root as before) before
  reporting the task done. No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-explorer-open-in-terminal-and-file-manager.md#test-strategy, #boundaries)
  Test strategy: `npm test`, `cargo test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

[Anything a build phase did differently from what the spec/plan predicted, and whether
it was accepted, and by whom.]
