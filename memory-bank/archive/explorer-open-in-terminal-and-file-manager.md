# Archive: explorer-open-in-terminal-and-file-manager

**Spec**: `memory-bank/specs/SPEC-explorer-open-in-terminal-and-file-manager.md`
**Task**: `memory-bank/tasks/explorer-open-in-terminal-and-file-manager.md`
**Reflection**: `memory-bank/reflection/explorer-open-in-terminal-and-file-manager.md`
**Branch**: `feature/explorer-open-in-terminal-and-file-manager`

## What was built

Two more actions in the Explorer's context menu, alongside New File/New Directory/
Rename/Delete:

- **Open in Terminal**: opens a new tab in Assay's own integrated terminal dock, started
  at the right-clicked file's containing folder (or the directory itself). Required no
  new backend command — `terminal_start_in` already resolves and jails an arbitrary
  `cwd`; only the frontend's `createTerminalTab`/`startTerminal` needed to stop
  hardcoding `workspaceRootPath` and use each tab's own `completionCwd` instead.
- **Reveal in File Manager**: opens the containing folder in the OS's native file
  manager via a new `reveal_in_file_manager` command — additive glue over the existing
  `open_with_desktop` helper, resolving the path via `WorkspaceRoot::resolve()` first.

## Satisfies

`SPEC-explorer-open-in-terminal-and-file-manager.md` — Objective, Structure, Style, Test
strategy, and Boundaries, in full.

## Deviations accepted

1. `reveal_in_file_manager_in`'s resolution logic (`containing_folder_of`) is unit-tested
   directly rather than exercising the full command's success path, which would spawn a
   real OS file-manager process during `cargo test` — matching `open_file_in`'s existing
   precedent of testing only its rejections. Extracted as a new learned rule
   (`agent-rules/_learned/testing-side-effecting-code.md`).
2. An unstarted terminal tab now freezes its `cwd` at creation time instead of reading
   `workspaceRootPath` lazily at first use — a narrow edge case (idle tab + Project
   switch + first keystroke after), judged an accidental side effect of the prior
   hardcoding rather than relied-upon behavior. Flagged, not engineered around.

The operator's manual-verification pass raised zero follow-ups — the second consecutive
task in this Explorer arc where that happened.
