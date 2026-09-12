# Archive: explorer-new-file-folder

**Spec**: `memory-bank/specs/SPEC-explorer-new-file-folder.md`
**Task**: `memory-bank/tasks/explorer-new-file-folder.md`
**Reflection**: `memory-bank/reflection/explorer-new-file-folder.md`
**Branch**: `feature/explorer-new-file-folder`

## What was built

JetBrains-style "New File" / "New Directory" creation for Assay's desktop Explorer:

- **Backend** (`desktop/src-tauri/src/lib.rs`): `create_workspace_file` and
  `create_workspace_directory` Tauri commands, each a thin wrapper over a testable `_in`
  function that resolves the **parent** directory through `WorkspaceRoot::resolve()` (the
  jail every other workspace-write command uses) before creating the new entry. Name
  validation rejects empty/`.`/`..`/path-separator names and already-existing entries.
- **Frontend markup** (`desktop/src/index.html`, `desktop/src/styles.css`): a "New"
  toolbar button in the Explorer, a positioned (cursor- or button-anchored) context menu
  with "New File" / "New Directory", and a single reusable name dialog — all following
  the existing `.task-dialog` / picker-menu visual language.
- **Frontend logic** (`desktop/src/main.js`, `desktop/src/paths.js`): right-click on the
  tree resolves its own create target (clicked directory, parent of a clicked file, or
  Project root for empty space); the toolbar button targets the selected file's directory
  or root. Either path opens the shared dialog; on success the tree refreshes and a new
  file opens immediately in the editor.
- **Tests**: 5 new Rust unit tests (happy path × 2, name-validation rejections, already-
  exists rejection) plus 2 new `tests/desktop-ui-contract.test.ts` string-match tests
  covering the new markup and JS wiring.

## Satisfies

`SPEC-explorer-new-file-folder.md` — Objective, Structure, Style, Test strategy, and
Boundaries, in full. See the spec and reflection documents for the six-section detail.

## Deviations accepted

1. Pre-existing, sandbox-specific `terminal_pty_accepts_input_after_the_shell_is_ready`
   test failure (confirmed identical on unmodified `master`) — excluded from the recorded
   batch result, not fixed; unrelated to this task.
2. `scripts/commit-guard.sh` patched to recognize this project's inline
   `#[cfg(test)] mod tests` Rust convention (it previously only recognized separately
   named test files) — a genuine tooling gap, fixed once at the point it was found.
   Documented in `memory-bank/projectConfig.md` and as a learned rule
   (`agent-rules/_learned/tooling-setup.md`) for future `/seed:init` runs.
3. Contract-test coverage was added incrementally per phase (Phase 2, then Phase 3)
   rather than batched into Phase 4 as originally planned — kept each phase's RED→GREEN
   cycle self-contained.
4. Error surface for the two new commands uses `notify()` (toast), matching
   `create_project_directory`'s precedent, rather than `operation-error-dialog` (reserved
   for sidecar round-trip failures elsewhere in the codebase) — the spec's Boundaries
   line named both as acceptable.
5. "Currently relevant directory" for the toolbar button was concretized as "parent of
   the selected file, else root", since no directory-selection concept existed in the
   tree at the time. **This shipped functionally incomplete**: the operator's first
   follow-up request asks for exactly the missing case (create inside a *selected
   directory*). Captured as a learned rule (`agent-rules/_learned/spec-writing.md`) and
   as the seed of the next task.
6. An attempted automated GUI smoke pass (macOS `osascript`/System Events) mis-clicked
   into the operator's own, unrelated Safari window and was aborted; the operator ran the
   manual verification pass themselves and confirmed the feature works end to end.
   Captured as a learned rule (`agent-rules/_learned/environment-safety.md`).

## Follow-up

The operator's next request — directory selection state plus drag-and-drop move within
the Explorer tree — is tracked as a new task, seeded directly by deviation 5 above.
