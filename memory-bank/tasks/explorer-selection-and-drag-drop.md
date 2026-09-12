---
slug: explorer-selection-and-drag-drop
spec: SPEC-explorer-selection-and-drag-drop.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Directory selection: `selectedDirectoryPath` state in `desktop/src/main.js`,
  set on directory click (alongside the existing expand/collapse toggle), cleared when a
  file is opened. `renderWorkspaceEntry`'s directory branch gains the same
  `entry.path === selectedDirectoryPath` → `selected` treatment the file branch already
  has. `relevantWorkspaceDirectory()` precedence updated: selected directory → parent of
  selected file → root. No creative needed — mechanical, mirrors an existing pattern.
  (satisfies: SPEC-explorer-selection-and-drag-drop.md#objective, #structure, #style — selection half)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions in this same
  phase (per the precedent set in the prior task) for the new state/render logic.

- [x] Phase 2 — `/seed:creative`: drag-and-drop visual design. Approved:
  `memory-bank/creative/explorer-selection-and-drag-drop-ui-ux.md` — background tint
  (reusing `--blue`) on a legal drop target, native "not-allowed" cursor for an illegal
  one (no new red/error state), `.dragging { opacity: .55 }` on the source row, same
  tint (softer) on `#workspace-tree` itself for root-drop.
  (satisfies: SPEC-explorer-selection-and-drag-drop.md#structure — "finalized in the /seed:creative pass")

- [ ] Phase 3 — Backend: `move_workspace_entry`/`move_workspace_entry_in` in
  `desktop/src-tauri/src/lib.rs`, registered in `generate_handler![...]`, plus Rust unit
  tests (happy path for file and directory, reject into-self, reject into-own-descendant,
  reject onto-existing-name, no-op when dropped back into current parent). No creative
  needed — pattern mirrors `create_workspace_directory_in`.
  (satisfies: SPEC-explorer-selection-and-drag-drop.md#structure, #style, #test-strategy — backend half)
  Test strategy: `cd desktop/src-tauri && cargo check && cargo test`.

- [ ] Phase 4 — Frontend drag-and-drop wiring: `dragstart`/`dragover`/`dragleave`/`drop`/
  `dragend` delegated on `#workspace-tree` (plus root-drop on empty tree space),
  `draggable="true"` on workspace-entry buttons, CSS from Phase 2's creative decisions,
  `nativeInvoke('move_workspace_entry', ...)` call, tree refresh on success, `notify()`
  on error. Depends on Phase 2's decisions and Phase 3's backend command.
  (satisfies: SPEC-explorer-selection-and-drag-drop.md#objective, #structure — drag-drop half, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions for the new
  markup/function names in this same phase.

- [ ] Phase 5 — Verification: full regression (`npm test`, `cargo test`), then a manual
  pass by the operator in `npm run desktop:dev` (click a directory → New targets it;
  click a file → New reverts to its parent; drag a file into a directory; drag a
  directory onto empty space to move it to root; attempt to drag a directory into its own
  child, expect rejection; attempt to drop onto an existing name, expect an error toast)
  before reporting the task done. No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-explorer-selection-and-drag-drop.md#test-strategy, #boundaries)
  Test strategy: `npm test`, `cargo test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

[Anything a build phase did differently from what the spec/plan predicted, and whether
it was accepted, and by whom.]
