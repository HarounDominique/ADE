---
slug: explorer-delete-and-rename
spec: SPEC-explorer-delete-and-rename.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Backend: `delete_workspace_entry`/`delete_workspace_entry_in` and
  `rename_workspace_entry`/`rename_workspace_entry_in` in `desktop/src-tauri/src/lib.rs`,
  registered in `generate_handler![...]`, reusing the existing `validate_new_entry_name`
  helper for rename's new name. Rust unit tests: delete file, delete directory with
  contents, delete nonexistent rejected, rename happy path (file + directory), rename
  rejects empty/`.`/`..`/separator name, rename rejects a destination collision, rename
  is a no-op when the new name equals the current one. No creative needed — mirrors
  `create_workspace_*_in` / `move_workspace_entry_in`.
  (satisfies: SPEC-explorer-delete-and-rename.md#structure, #style, #test-strategy — backend half)
  Test strategy: `cd desktop/src-tauri && cargo check && cargo test`.

- [ ] Phase 2 — Frontend markup: two more items (Rename, Delete) in
  `#workspace-context-menu`, `#rename-entry-dialog` (task-dialog shape, pre-filled name
  input). No new markup for Delete — reuses `#confirm-dialog`. No behavior wired yet.
  (satisfies: SPEC-explorer-delete-and-rename.md#structure — markup half)
  Test strategy: `node --check desktop/src/main.js` (sanity only); contract-test
  additions for the new markup in this same phase, per the precedent set in both prior
  Explorer tasks.

- [ ] Phase 3 — Frontend logic: context menu becomes target-aware (existing entry's path
  + kind, not just a create-parent), `deleteWorkspaceEntryFromUI` (confirm → invoke →
  force-close affected tabs via `closeDocumentTabNow` → refresh), rename dialog open/
  submit (invoke → update an open file's tab in place, or close tabs nested under a
  renamed directory → `selectedFilePath`/`selectedDirectoryPath` follow the rename →
  refresh + `expandWorkspaceTreeTo`, reusing the reveal-on-mutation fix from the prior
  task).
  (satisfies: SPEC-explorer-delete-and-rename.md#objective, #structure — logic half, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions for the
  tab-close/tab-update logic in this same phase.

- [ ] Phase 4 — Verification: full regression (`npm test`, `cargo test`), then a manual
  pass by the operator in `npm run desktop:dev` (delete a file with its tab open — tab
  closes; delete a directory containing open tabs — all close; rename an open file — tab
  updates in place, buffer survives; rename a directory containing open tabs — those
  close; rename/delete reject a name collision or a nonexistent path with an error
  surface; right-click on empty tree space still shows only New File/New Directory, no
  Rename/Delete) before reporting the task done. No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-explorer-delete-and-rename.md#test-strategy, #boundaries)
  Test strategy: `npm test`, `cargo test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- Phase 1 review: `rename_workspace_entry_in`'s original draft computed the destination's
  parent from `source.parent()` directly, never re-resolving it through
  `WorkspaceRoot::resolve()`. Unreachable from the UI today (the tree never offers rename
  on the Project root itself), but the backend command must not depend on the frontend
  never sending that path — fixed before commit, with a new test
  (`rename_workspace_entry_rejects_renaming_the_project_root_itself`) covering it.
