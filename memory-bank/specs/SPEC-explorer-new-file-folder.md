# SPEC: Explorer New File / New Folder

status: approved

## Objective

Add familiar desktop-IDE-style "New File" / "New Directory" creation to Assay's desktop Explorer.
An operator can right-click a folder (or the empty tree background) to get a positioned
context menu with "New File" / "New Directory", or use a "New" toolbar button with the
same two entries. Either opens a small name-entry dialog; on confirm, Assay creates the
entry on disk through a new jailed Tauri command, refreshes the tree, and — for a new
file — opens it in the editor. Success: an operator never needs a terminal or an external
file manager to add a file or folder to the active Project.

## Commands

- Backend type-check: `cd desktop/src-tauri && cargo check`
- Backend unit tests: `cd desktop/src-tauri && cargo test`
- Frontend syntax check: `node --check desktop/src/main.js`
- Frontend rebuild (for manual verification): `cd desktop && node build.mjs`
- Full app, manual run: `npm run desktop:dev` (repo root)
- Contract/regression suite: `npm test` (repo root; runs `tests/desktop-ui-contract.test.ts`
  among others via `node --import tsx --test`)

## Structure

- **Backend** — `desktop/src-tauri/src/lib.rs`:
  - `create_workspace_file` / `create_workspace_file_in`
  - `create_workspace_directory` / `create_workspace_directory_in`
  - Both registered in the `generate_handler![...]` list.
  - New cases in the existing `#[cfg(test)] mod tests` block, reusing the `fixture_root(name)`
    helper already used by `list_directory_in` / `write_file_in` tests.
- **Frontend markup** — `desktop/src/index.html`:
  - "New" toolbar button in `.explorer-actions`, next to the existing `refresh-tree` button.
  - One positioned context-menu container, e.g. `<div id="workspace-context-menu" class="workspace-context-menu" hidden>`, populated dynamically (not one menu per tree node).
  - One `<dialog class="task-dialog" id="new-entry-dialog">` — single name input, reused for
    both File and Directory (eyebrow/title text swapped per kind), following the
    `new-project-dialog` shape added for the New Project feature.
- **Frontend logic** — `desktop/src/main.js`:
  - `contextmenu` listener on `#workspace-tree` (event delegation) → `openWorkspaceContextMenu(event, targetPath, kind)`.
  - `closeWorkspaceContextMenu()`, outside-click + Escape handling (menu is cursor-positioned,
    not the click-toggled anchored pattern used by the existing git context menus).
  - `openNewEntryDialog(kind, parentPath)` + a single submit handler that calls
    `nativeInvoke('create_workspace_file' | 'create_workspace_directory', { parentPath, name })`.
  - On success: `loadWorkspaceTree(workspaceRootPath, nativeInvoke, { animate: true })` to
    refresh, exactly as already done after other tree-mutating actions; for a file, feed the
    returned path into whatever function already opens a clicked tree file in the editor.
- **Styling** — `desktop/src/styles.css`:
  - `.workspace-context-menu` (new): `position: fixed`, visual language borrowed from
    `.picker-menu` / `.git-context-menu` (border, panel background, shadow), but positioned
    at the click coordinates instead of anchored under a button.
  - The dialog reuses `.task-dialog`, `.dialog-actions`, `.task-dialog input[type="text"]`
    (already added for New Project) — no new dialog-specific CSS.
- **Tests** — `tests/desktop-ui-contract.test.ts`: extend with string-match assertions for
  the new `data-action`s and dialog/menu ids, matching that file's existing convention.

## Style

The codebase's established backend idiom — a thin `#[tauri::command]` wrapper delegating to
a plain, unit-testable `_in` function that takes `&WorkspaceRoot` — is what the two new
commands must follow (mirrors `write_file` / `write_file_in`):

```rust
#[tauri::command]
fn create_workspace_directory(
    workspace: tauri::State<'_, WorkspaceRoot>,
    parent_path: String,
    name: String,
) -> Result<String, String> {
    create_workspace_directory_in(&workspace, &parent_path, &name)
}

fn create_workspace_directory_in(
    workspace: &WorkspaceRoot,
    parent_path: &str,
    name: &str,
) -> Result<String, String> {
    // The requested entry does not exist yet, so only the PARENT can be
    // resolved/jailed via WorkspaceRoot::resolve() (it calls canonicalize(),
    // which requires the path to already exist on disk).
    let parent = workspace.resolve(parent_path)?;
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed == "." || trimmed == ".."
        || trimmed.contains('/') || trimmed.contains('\\')
    {
        return Err("Name cannot be empty or contain a path separator.".to_string());
    }
    let target = parent.join(trimmed);
    if target.exists() {
        return Err(format!("{} already exists.", target.display()));
    }
    std::fs::create_dir(&target).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}
```

`create_workspace_file_in` is the same shape, using `std::fs::File::create(&target)` in
place of `create_dir`. Both are additive — `write_file_in`'s existing "must already exist"
contract is untouched.

## Test strategy

- **Backend**: Rust's built-in `#[test]` via `cargo test`, using the existing
  `fixture_root(name)` fixture helper. Coverage: happy path (correct path returned, entry
  exists after the call), name rejected when empty / `.` / `..` / contains `/` or `\`,
  already-exists rejected, parent-outside-workspace rejected (inherited for free from
  `WorkspaceRoot::resolve`, no new test needed there).
- **Frontend**: this repo has no DOM/browser test harness. New markup and wiring are
  verified by (a) string-match assertions added to `tests/desktop-ui-contract.test.ts`
  (same convention the file already uses for other actions/dialogs), and (b) a manual pass
  in the running dev app (`npm run desktop:dev`) driving the actual context menu, toolbar
  button, and dialog before the task is considered done — per this repo's `run` skill
  convention, since typechecking is not proof the feature works.
- No attempt is made to automate the context menu's on-screen position or the "New File"
  auto-open-in-editor step; both are covered only by the manual pass above.

## Boundaries

**Always:**
- Every new write command resolves the **parent** directory through
  `WorkspaceRoot::resolve()` before touching disk — never trust a raw path from the frontend.
- Reuse the existing `.task-dialog` family and the existing `notify()` /
  `operation-error-dialog` error surface — no new visual language for errors.
- Refresh the tree via the existing `loadWorkspaceTree(...)` call after any successful
  create, exactly as already done after other tree-mutating actions.
- Manually drive the feature in the running dev app before calling the task done — no
  browser test harness exists that would catch a visually broken menu or dialog.

**Ask first:**
- Before touching `write_file_in`'s existing "must already exist" contract — this task is
  additive only.
- Before adding inline tree rename/contenteditable naming — the dialog-based naming here is
  a deliberate simplification versus true inline-rename in a tree view; expanding to inline
  editing is a separate decision.
- Before reusing or modifying `create_project_directory` (the New Project command) — it
  looks similar but is intentionally unjailed (creates outside the workspace) with its own
  validation; do not merge the two code paths.

**Never:**
- Never accept a name containing `/` or `\` and silently create intermediate nested
  directories — reject the whole operation instead.
- Never bypass `WorkspaceRoot::resolve()` for the parent path, including from the toolbar
  "fast path".
- Never implement delete, rename, drag-and-drop, multi-select, or paste as part of this
  task — out of scope.
- Never leave stale target-path state on the context menu or dialog between opens — reset
  on every open/close.
