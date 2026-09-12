# SPEC: Explorer directory selection and drag-and-drop move

status: approved

## Objective

Two related follow-ups to the Explorer's New File / New Directory feature
(`SPEC-explorer-new-file-folder.md`), both about how the tree tracks and acts on what the
operator has clicked:

1. **Directory selection**: clicking a directory in the tree marks it "selected" (the
   same visual treatment a file already gets when it's the active editor tab), in
   addition to its existing expand/collapse toggle. "New File" / "New Directory" then
   creates inside the selected directory when one exists, instead of falling back past it
   to the open file's parent or the Project root.
2. **Drag-and-drop move**: a file or directory can be dragged and dropped onto another
   directory (or onto empty tree space, to move it to the Project root) to move it there
   on disk, immediately, with a toast on success or failure — no confirmation dialog,
   matching a familiar desktop IDE convention.

Success: an operator can direct "New" at the folder they just clicked, and reorganize
files by dragging them, without a terminal or an external file manager.

## Commands

- Backend type-check: `cd desktop/src-tauri && cargo check`
- Backend unit tests: `cd desktop/src-tauri && cargo test`
- Frontend syntax check: `node --check desktop/src/main.js`
- Frontend rebuild (for manual verification): `cd desktop && node build.mjs`
- Full app, manual run: `npm run desktop:dev` (repo root) — GUI behavior in this
  environment is verified by the operator directly; see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
- Contract/regression suite: `npm test` (repo root)

## Structure

- **Backend** — `desktop/src-tauri/src/lib.rs`:
  - `move_workspace_entry` / `move_workspace_entry_in`, registered in
    `generate_handler![...]`, plus new cases in the existing `#[cfg(test)] mod tests`
    block. No backend change is needed for directory selection — that is frontend-only
    state.
- **Frontend markup** — `desktop/src/index.html`, `desktop/src/styles.css`:
  - No new dialog. `draggable="true"` added to workspace-entry buttons (both kinds) in
    `renderWorkspaceEntry`.
  - New CSS for a drop-target highlight (finalized in the `/seed:creative` pass this
    roadmap requires before that phase is built) — reusing existing tokens
    (`--blue`/`--cyan`/`--panel-raised`) rather than introducing new colors.
- **Frontend logic** — `desktop/src/main.js`:
  - `selectedDirectoryPath` (new module state, alongside the existing `selectedFilePath`).
    Set when a directory entry is clicked; cleared when a file is opened
    (`updateWorkspaceFileSelection`). `renderWorkspaceEntry`'s directory branch gains the
    same `entry.path === selectedDirectoryPath` → `selected` treatment the file branch
    already has, so the highlight survives a tree re-render exactly like file selection
    does today.
  - `relevantWorkspaceDirectory()` (from `SPEC-explorer-new-file-folder.md`) changes
    precedence to: `selectedDirectoryPath` → parent of `selectedFilePath` → Project root.
  - `dragstart` / `dragover` / `dragleave` / `drop` / `dragend` delegated on
    `#workspace-tree` (plus a drop handler on the tree's own empty space for "move to
    root"). `drop` calls `nativeInvoke('move_workspace_entry', { sourcePath,
    destinationDirectoryPath })`, then refreshes the tree via the existing
    `loadWorkspaceTree(...)` call.
- **Tests**: Rust unit tests for `move_workspace_entry_in`; `tests/desktop-ui-contract.test.ts`
  string-match additions for `draggable="true"`, the new drag/drop function names, the
  `move_workspace_entry` invoke call, and the directory `selected` render logic.

## Style

Backend — `move_workspace_entry_in` mirrors the same thin-command-over-testable-`_in`-fn
shape as `create_workspace_directory_in` / `write_file_in`, resolving **both** paths
(source and destination directory, which — unlike a not-yet-existing create target —
already exist, so `WorkspaceRoot::resolve()` applies to both directly):

```rust
fn move_workspace_entry_in(
    workspace: &WorkspaceRoot,
    source_path: &str,
    destination_directory_path: &str,
) -> Result<String, String> {
    let source = workspace.resolve(source_path)?;
    let destination_dir = workspace.resolve(destination_directory_path)?;
    if !destination_dir.is_dir() {
        return Err(format!("{} is not a directory.", destination_dir.display()));
    }
    // Covers both "into itself" and "into one of its own descendants" in one check.
    if destination_dir.starts_with(&source) {
        return Err("Cannot move a folder into itself or one of its own subfolders.".to_string());
    }
    let name = source.file_name().ok_or_else(|| "Source has no file name".to_string())?;
    let target = destination_dir.join(name);
    if target == source {
        return Ok(source.to_string_lossy().into_owned()); // dropped back where it already was
    }
    if target.exists() {
        return Err(format!("{} already exists.", target.display()));
    }
    std::fs::rename(&source, &target).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}
```

Frontend — directory selection mirrors the file branch's existing pattern exactly
(`desktop/src/main.js`, `renderWorkspaceEntry`):

```js
// existing file branch:
const selected = entry.path === selectedFilePath;
// new directory branch gains the same line:
const selected = entry.path === selectedDirectoryPath;
```

## Test strategy

- **Backend**: `cargo test`, extending the existing `fixture_root` pattern. Coverage:
  happy path (file and directory both), reject moving a directory into itself, reject
  moving a directory into its own descendant, reject moving onto an already-existing
  name, no-op success when dropped back into its current parent.
- **Frontend**: string-match additions to `tests/desktop-ui-contract.test.ts` (same
  convention as the New File / New Directory task) for the new markup and function names.
  No DOM/browser test harness exists in this repo (unchanged from
  `SPEC-explorer-new-file-folder.md`).
- **Manual verification is mandatory before this task is called done**, driven by the
  operator, not by automated GUI clicks —
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment` forbids attempting
  coordinate-based OS automation in this environment: drag-and-drop in particular has no
  reliable programmatic equivalent to a real drag gesture here.

## Boundaries

**Always:**
- `move_workspace_entry` resolves **both** the source and the destination directory
  through `WorkspaceRoot::resolve()` — never trust either path from the frontend as-is.
- Reject a move that would place a directory inside itself or inside one of its own
  descendants — checked via `destination_dir.starts_with(&source)`, not by depth-limited
  guessing.
- Selection state (`selectedDirectoryPath`) is reset on every relevant transition (a file
  opened, a different directory clicked) — no stale target surviving into an unrelated
  "New" or drag-drop action.
- Manually verify both features in the running dev app before calling the task done — the
  operator drives this directly (see `agent-rules/_learned/gui-automation-unsafe-in-this-environment`).

**Ask first:**
- Before adding multi-select or reordering within a directory (alphabetical order is a
  rendering detail today, not a stored order) — both out of scope here.
- Before changing `create_workspace_file_in` / `create_workspace_directory_in` in a way
  that changes their existing signature — this task only changes what `main.js` passes
  as `parentPath` (via `relevantWorkspaceDirectory()`), not the commands themselves.
- Before adding a confirmation dialog to the move flow — explicitly decided against
  (immediate move + toast, matching the reference desktop-IDE convention) during spec review; revisit only if the
  operator asks for it after using the feature.

**Never:**
- Never allow a drop that silently overwrites an existing file/directory at the
  destination — reject with an error surfaced via `notify()`, matching the New File /
  New Directory precedent, never a silent overwrite.
- Never implement moving an entry to a *different* Project (cross-repository move) — this
  is scoped to moves within the single active Project's workspace tree.
- Never simulate or attempt to script the actual drag gesture as part of "testing" this
  feature — verify manually, per Boundaries above and the learned rule it cites.
