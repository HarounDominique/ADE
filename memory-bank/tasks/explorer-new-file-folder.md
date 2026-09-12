---
slug: explorer-new-file-folder
spec: SPEC-explorer-new-file-folder.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Backend: `create_workspace_file`/`create_workspace_file_in` and
  `create_workspace_directory`/`create_workspace_directory_in` in `desktop/src-tauri/src/lib.rs`,
  registered in `generate_handler![...]`, plus Rust unit tests in the existing
  `#[cfg(test)] mod tests` block (happy path, empty/`.`/`..`/separator name rejected,
  already-exists rejected). No creative needed — pattern is a direct mirror of
  `write_file_in` / `create_project_directory`.
  (satisfies: SPEC-explorer-new-file-folder.md#structure, #style, #test-strategy — backend half)
  Test strategy: `cd desktop/src-tauri && cargo check && cargo test`.

- [x] Phase 2 — Frontend markup + styling: "New" toolbar button in `.explorer-actions`
  (`desktop/src/index.html`), positioned context-menu container
  (`#workspace-context-menu`), `#new-entry-dialog` (task-dialog shape, reusing existing
  `.task-dialog`/`.dialog-actions`/input CSS), and `.workspace-context-menu` styling in
  `desktop/src/styles.css` borrowing `.picker-menu`/`.git-context-menu` visual language.
  No behavior wired yet. No creative needed — visual language and dialog shape already
  established by the New Project dialog.
  (satisfies: SPEC-explorer-new-file-folder.md#structure — frontend markup/styling half)
  Test strategy: `node --check desktop/src/main.js` (no JS touched yet, sanity only);
  visual sanity via `cd desktop && node build.mjs`.

- [ ] Phase 3 — Frontend logic: `contextmenu` delegation on `#workspace-tree`,
  `openWorkspaceContextMenu`/`closeWorkspaceContextMenu`, `openNewEntryDialog`, submit
  handler invoking `create_workspace_file`/`create_workspace_directory` via
  `nativeInvoke`, tree refresh via `loadWorkspaceTree(...)`, and auto-open of a newly
  created file in the editor. Toolbar button wired to the same dialog, targeting the
  currently relevant directory (selected/expanded, else workspace root).
  (satisfies: SPEC-explorer-new-file-folder.md#objective, #structure — frontend logic half, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; manual smoke pass deferred to Phase 4.

- [ ] Phase 4 — Verification: extend `tests/desktop-ui-contract.test.ts` with string-match
  assertions for the new `data-action`s, dialog id, and menu id; run `npm test` (full
  suite) and `cd desktop/src-tauri && cargo test`; manually drive the feature in
  `npm run desktop:dev` (right-click a folder → New File and New Directory, empty-tree
  right-click, toolbar button, new-file auto-open, duplicate-name error surface) before
  reporting the task done.
  (satisfies: SPEC-explorer-new-file-folder.md#test-strategy, #boundaries — manual verification requirement)
  Test strategy: `npm test`, `cargo test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- Phase 1, step 3: `tests::terminal_pty_accepts_input_after_the_shell_is_ready` fails
  (timeout) in this sandbox on unmodified `master` too (confirmed via `git stash`) —
  pre-existing, unrelated to this task's PTY-unrelated filesystem commands. Excluded from
  the recorded batch result via `-- --skip terminal_pty_accepts_input_after_the_shell_is_ready`;
  not fixed, out of scope. Flagging for a human/`/seed:reflect` follow-up, not silently
  ignoring it.
- Phase 2: added `tests/desktop-ui-contract.test.ts` coverage for this phase's own markup
  now (RED→GREEN within the phase) rather than batching all contract-test additions into
  Phase 4 as originally planned — keeps each phase's TDD cycle self-contained. Phase 3
  will add its own JS-wiring assertions the same way; Phase 4 stays a regression run +
  manual pass, no new assertions required there. Self-directed, no scope change.
