# SPEC: Explorer "Open in Terminal" and "Reveal in File Manager"

status: approved

## Objective

Add two more actions to the Explorer's context menu, alongside New File / New Directory
/ Rename / Delete: "Open in Terminal" opens a new tab in Assay's own integrated terminal
dock, started at the right-clicked file's containing folder (or the directory itself, if
a directory was clicked). "Reveal in File Manager" opens that same containing folder in
the operating system's native file manager. Success: an operator jumps from a file in
the tree straight to a shell or a native file browser rooted there, without typing a
`cd` or hunting through the OS's own file manager for the path.

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
  - `reveal_in_file_manager` / `reveal_in_file_manager_in` — resolves the path via
    `WorkspaceRoot::resolve()`, takes its containing folder (the path itself if it is
    already a directory, its parent if a file), and calls the existing
    `open_with_desktop(&folder, "folder")` helper `open_file_in` already uses for a
    single file. No per-OS code of its own — it is additive glue over what
    `open_with_desktop` already handles for every platform this app ships on.
  - No new command for the terminal — `terminal_start_in` already resolves and jails an
    arbitrary `cwd` inside the Project (used today only with `workspaceRootPath`); this
    task only changes what the frontend passes it.
- **Frontend markup** — `desktop/src/index.html`: two more `[data-workspace-entry-action]`
  items in `#workspace-context-menu` ("Open in Terminal", "Reveal in File Manager"),
  hidden exactly when Rename/Delete already are (no existing entry targeted).
- **Frontend logic** — `desktop/src/main.js`:
  - `createTerminalTab({ ..., cwd = workspaceRootPath })` — new optional option, stored
    as the tab's existing `completionCwd` field (already present, previously always set
    to `workspaceRootPath` and used only for its status-bar label). Every existing call
    site is unaffected since none currently pass `cwd`.
  - `startTerminal` changes its `nativeInvoke('terminal_start', { sessionId, cwd })` call
    from the hardcoded `workspaceRootPath` to `tab.completionCwd` — the one place that
    field becomes authoritative rather than cosmetic.
  - `openWorkspaceEntryInTerminal(path, kind)` — computes the target directory (`path`
    itself for a directory, `pathDirname(path)` for a file), calls `createTerminalTab`
    with that `cwd`, scrolls the terminal dock into view (mirrors the existing
    `open-terminal` action's own scroll-into-view).
  - `revealWorkspaceEntryInFileManager(path)` — `nativeInvoke('reveal_in_file_manager', { path })`,
    `notify()` on failure.
- **Tests**: Rust unit tests for `reveal_in_file_manager_in` (file → its parent opened,
  directory → itself opened, nonexistent path rejected). `tests/desktop-ui-contract.test.ts`
  string-match additions for the new menu items and the `cwd`-aware terminal wiring, same
  convention as every prior Explorer task.

## Style

Backend — additive glue over an existing cross-platform helper, not a new per-OS branch:

```rust
#[tauri::command]
fn reveal_in_file_manager(workspace: tauri::State<'_, WorkspaceRoot>, path: String) -> Result<(), String> {
    reveal_in_file_manager_in(&workspace, &path)
}

fn reveal_in_file_manager_in(workspace: &WorkspaceRoot, path: &str) -> Result<(), String> {
    let target = workspace.resolve(path)?;
    let folder = if target.is_dir() {
        target
    } else {
        target.parent().ok_or_else(|| "Cannot determine a containing folder".to_string())?.to_path_buf()
    };
    open_with_desktop(&folder, "folder")
}
```

Frontend — the terminal tab's cwd stops being cosmetic-only:

```js
// before: always workspaceRootPath, regardless of the tab
await nativeInvoke('terminal_start', { sessionId: tab.id, cwd: workspaceRootPath });
// after: the tab's own recorded cwd, defaulting the same way it already did
await nativeInvoke('terminal_start', { sessionId: tab.id, cwd: tab.completionCwd });
```

## Test strategy

- **Backend**: `cargo test`, extending the existing `fixture_root` pattern. Coverage:
  revealing a file resolves to its parent directory, revealing a directory resolves to
  itself, a nonexistent path is rejected. `open_with_desktop`'s actual process spawn is
  not itself asserted (already unexercised by existing tests for `open_file_in`, which
  has the same shape) — only the path-resolution logic this task adds is new surface.
- **Frontend**: string-match additions to `tests/desktop-ui-contract.test.ts` for the new
  menu items, `createTerminalTab`'s new `cwd` option, and `startTerminal`'s use of
  `tab.completionCwd`. No DOM/browser test harness exists in this repo.
- **Manual verification is mandatory before this task is called done**, driven by the
  operator — launching a real terminal tab and a real OS file manager are both outside
  what a string-match test can confirm, and this repo's own
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment` forbids attempting
  either via automated OS-level clicks.

## Boundaries

**Always:**
- `reveal_in_file_manager` resolves the path through `WorkspaceRoot::resolve()` before
  computing a containing folder — never trust a raw path from the frontend.
- A new "Open in Terminal" tab always starts at a path inside the active Project — the
  same jail `terminal_start_in` already enforces for every terminal, unchanged by this
  task.
- Every existing `createTerminalTab()` call site keeps behaving exactly as it does today
  (cwd defaults to `workspaceRootPath` when not given) — this task is additive to that
  function's options, never a change to its default behavior.
- "Reveal in File Manager" opens the *containing folder*, not the file itself and not a
  file-manager-specific "select this item" view — decided during spec review to avoid
  per-OS/per-desktop-environment special-casing with no universal Linux equivalent.

**Ask first:**
- Before attempting a true "reveal and select the exact file" experience (OS-specific
  flags, no universal Linux equivalent) — explicitly declined this round in favor of
  opening the containing folder.
- Before letting the operator choose a different terminal emulator, shell, or file
  manager than the OS default — out of scope; this task adds one fixed action of each
  kind.
- Before adding "Open in Terminal" / "Reveal in File Manager" anywhere outside the
  Explorer's existing context menu (e.g. a toolbar button, a keyboard shortcut).

**Never:**
- Never open a terminal or a file-manager folder outside the active Project's resolved
  workspace root — both paths go through the same jail every other workspace command
  already uses.
- Never change what an *existing* terminal tab's cwd is after creation — this task only
  affects the value a *new* tab starts with.
