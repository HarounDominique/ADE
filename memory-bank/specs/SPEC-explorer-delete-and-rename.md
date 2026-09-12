# SPEC: Explorer Delete and Rename

status: approved

## Objective

Complete the Explorer's file-management basics — New File / New Directory
(`SPEC-explorer-new-file-folder.md`) and drag-and-drop move
(`SPEC-explorer-selection-and-drag-drop.md`) already exist — by adding Delete and
Rename. Right-clicking an *existing* file or directory (as opposed to empty tree space)
adds Rename and Delete to the context menu, alongside the New File / New Directory
entries already there. Delete is gated by a confirmation dialog and permanently removes
the entry; any editor tab open under the deleted path closes. Rename opens a name dialog
pre-filled with the current name; renaming an open file updates its tab in place instead
of closing it, and renaming a directory closes any tabs open under it. Success: an
operator manages a Project's files entirely from the Explorer, without a terminal or an
external file manager.

## Commands

- Backend type-check: `cd desktop/src-tauri && cargo check`
- Backend unit tests: `cd desktop/src-tauri && cargo test`
- Frontend syntax check: `node --check desktop/src/main.js`
- Frontend rebuild (for manual verification): `cd desktop && node build.mjs`
- Full app, manual run: `npm run desktop:dev` — GUI behavior verified by the operator
  directly; see `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
- Contract/regression suite: `npm test` (repo root)

## Structure

- **Backend** — `desktop/src-tauri/src/lib.rs`:
  - `delete_workspace_entry` / `delete_workspace_entry_in` — resolves the path via
    `WorkspaceRoot::resolve()`, then `std::fs::remove_file` for a file or
    `std::fs::remove_dir_all` for a directory. Permanent, not OS-trash (explicitly
    decided during spec review — no new dependency, no cross-platform trash-path
    surface).
  - `rename_workspace_entry` / `rename_workspace_entry_in` — resolves the existing path,
    validates the new name with the same `validate_new_entry_name` helper
    `create_workspace_file_in`/`create_workspace_directory_in` already use, rejects a
    name collision at the destination, `std::fs::rename` within the same parent.
  - Both registered in `generate_handler![...]`, both covered in the existing
    `#[cfg(test)] mod tests` block.
- **Frontend markup** — `desktop/src/index.html`:
  - `#workspace-context-menu` gains two more items (Rename, Delete), present in the DOM
    at all times but only relevant when the menu was opened on an existing entry — see
    Frontend logic.
  - `#rename-entry-dialog` — a dedicated `task-dialog`-shaped dialog (single input,
    pre-filled with the current name), matching `#new-entry-dialog`'s shape but kept
    separate so each dialog's purpose stays unambiguous (the pattern already used for
    "New Project" vs. "Open Existing" getting their own dialogs despite visual overlap).
  - No new markup for Delete — reuses the existing `#confirm-dialog` /
    `requestConfirmation()` (`tone: 'danger'`), the same mechanism "Remove project" and
    "Discard unsaved changes" already use.
- **Frontend logic** — `desktop/src/main.js`:
  - `openWorkspaceContextMenu`/`showWorkspaceContextMenu` extended to record whether the
    menu targets an *existing* entry (its path and kind) or only a create-parent
    directory — Rename/Delete render disabled or hidden when there is no such entry
    (i.e., the menu was opened on empty tree space).
  - `deleteWorkspaceEntryFromUI(path, kind)` — `requestConfirmation({ tone: 'danger', ... })`,
    then `nativeInvoke('delete_workspace_entry', { path })`, then closes (via
    `closeDocumentTabNow`, not the dirty-prompting `closeDocumentTab` — the file is gone
    either way) every open document tab whose path equals or is nested under the deleted
    path, then refreshes the tree.
  - `openRenameEntryDialog(path, kind)` / rename form submit — `nativeInvoke('rename_workspace_entry', { path, name })`;
    on success, if the renamed path was a file with an open tab, that tab's `path`/`name`/
    `relativePath` are rewritten in place (no close/reopen); if it was a directory, any
    open tabs nested under it are closed via `closeDocumentTabNow` (rewriting every
    nested tab's path is disproportionate here — see Boundaries); `selectedFilePath`/
    `selectedDirectoryPath` follow the rename the same way they already follow a
    drag-and-drop move.
- **Tests**: Rust unit tests for both new `_in` functions; `tests/desktop-ui-contract.test.ts`
  string-match additions for the new menu items, the rename dialog, and the tab-close/
  tab-update logic — same convention as the two prior Explorer tasks.

## Style

Backend — both commands are additive, mirroring the same thin-command-over-testable-`_in`
shape and reusing existing helpers:

```rust
#[tauri::command]
fn delete_workspace_entry(workspace: tauri::State<'_, WorkspaceRoot>, path: String) -> Result<(), String> {
    delete_workspace_entry_in(&workspace, &path)
}

fn delete_workspace_entry_in(workspace: &WorkspaceRoot, path: &str) -> Result<(), String> {
    let target = workspace.resolve(path)?;
    if target.is_dir() {
        std::fs::remove_dir_all(&target).map_err(|error| error.to_string())
    } else {
        std::fs::remove_file(&target).map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn rename_workspace_entry(workspace: tauri::State<'_, WorkspaceRoot>, path: String, name: String) -> Result<String, String> {
    rename_workspace_entry_in(&workspace, &path, &name)
}

fn rename_workspace_entry_in(workspace: &WorkspaceRoot, path: &str, name: &str) -> Result<String, String> {
    let source = workspace.resolve(path)?;
    let trimmed = validate_new_entry_name(name)?; // shared with create_workspace_*_in
    let target = source.parent().ok_or_else(|| "Cannot rename the Project root".to_string())?.join(trimmed);
    if target == source { return Ok(source.to_string_lossy().into_owned()); }
    if target.exists() { return Err(format!("{} already exists.", target.display())); }
    std::fs::rename(&source, &target).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}
```

Frontend — an open file's tab follows a rename exactly the way `selectedDirectoryPath`
already follows a drag-and-drop move (`SPEC-explorer-selection-and-drag-drop.md#style`):

```js
const openTab = openDocuments.find((record) => record.path === path);
if (openTab) {
  openTab.path = renamedPath;
  openTab.name = pathBaseName(renamedPath);
  openTab.relativePath = documentRelativePath(renamedPath);
  renderDocumentTabs();
}
```

## Test strategy

- **Backend**: `cargo test`, extending the existing `fixture_root` pattern. Coverage:
  delete a file, delete a directory (with contents), delete a nonexistent path rejected,
  rename happy path (file and directory), rename rejects an empty/`.`/`..`/separator
  name, rename rejects a name collision at the destination, rename is a no-op when the
  "new" name equals the current one.
- **Frontend**: string-match additions to `tests/desktop-ui-contract.test.ts`, same
  convention as both prior Explorer tasks. No DOM/browser test harness exists in this
  repo.
- **Manual verification is mandatory before this task is called done**, driven by the
  operator — delete and rename are exactly the kind of destructive/stateful action this
  repo's own `agent-rules/_learned/gui-automation-unsafe-in-this-environment` forbids
  attempting via automated OS-level clicks.

## Boundaries

**Always:**
- `delete_workspace_entry` and `rename_workspace_entry` resolve the existing path through
  `WorkspaceRoot::resolve()` — never trust a raw path from the frontend.
- Delete requires an explicit confirmation (`tone: 'danger'`) before it runs — no
  "immediate" path for delete, unlike drag-and-drop move (delete is irreversible; move
  can be dragged back).
- Any open editor tab whose path equals or is nested under a deleted path closes via
  `closeDocumentTabNow` (not the dirty-prompting `closeDocumentTab`) — the underlying
  file is already gone, so there is nothing left to save it back to.
- An open file's tab is updated in place on rename (path/name/relativePath rewritten),
  never closed-and-reopened, so the buffer and any unsaved edits survive the rename.
- `selectedFilePath` / `selectedDirectoryPath` follow a rename to the new path, exactly
  as they already follow a drag-and-drop move — never left pointing at a path that no
  longer exists.
- Rename validates the new name with the same rules as create (empty/`.`/`..`/path
  separator all rejected) and refuses a name collision at the destination, never a
  silent overwrite.

**Ask first:**
- Before switching delete to OS-trash/recoverable instead of permanent — explicitly
  declined this round (no new dependency, no cross-platform trash-path surface); revisit
  only if the operator asks after using the feature.
- Before adding keyboard shortcuts (Delete key, F2 rename) — mouse/context-menu only for
  this task, matching how the tree already works.
- Before adding multi-select delete/rename — the tree has no multi-select concept yet.
- Before rewriting every nested tab's path when a *directory* is renamed, instead of
  closing them — closing is the simpler, safer default chosen here; revisit only if this
  proves disruptive in practice.

**Never:**
- Never delete or rename anything the operator did not explicitly invoke through the
  context menu — no automatic or implicit deletes.
- Never leave `selectedFilePath` or `selectedDirectoryPath` pointing at a path that no
  longer exists after a successful delete or rename.
- Never let a rename silently overwrite an existing entry at the destination name.
- Never skip the delete confirmation dialog, even for an empty file or directory.
