# Reflection: explorer-new-file-folder

## Step 1 — Implementation vs. spec

All Boundaries in `SPEC-explorer-new-file-folder.md` were respected:

- Every write command resolves the **parent** via `WorkspaceRoot::resolve()` before
  touching disk (never the not-yet-existing target itself).
- No separator-containing name silently created nested directories — rejected outright.
- `write_file_in` and `create_project_directory` were left untouched, as instructed.
- No inline tree rename, delete, drag-and-drop, multi-select, or paste was added — all
  explicitly out of scope, and confirmed the right call: the very next request from the
  operator asks for drag-and-drop as its own follow-up, with its own design decisions
  (visual affordances, drop-target legality, backend move semantics). Scoping it out here
  kept this task's build cycle clean instead of bundling two capabilities into one spec.
- Manual verification happened before the task was called done, per Boundaries — though
  not by the build agent itself (see Step 2).

One assumption shipped **technically correct but functionally incomplete**: assumption 4
("toolbar button acts on the selected/expanded directory, else root") was concretized
during Phase 3 as "parent of the selected **file**, else root" — because the workspace
tree had no directory-selection concept at all at the time (confirmed by grep: clicking a
directory only toggles expand/collapse via `toggleWorkspaceDirectory`, never gains a
`.selected` class the way a file does). This was the smallest well-defined reading of an
ambiguous spec phrase, and it was documented as a deviation at the time — but it is not
what a JetBrains user expects, and the operator asked for exactly this gap (create inside
a *selected directory*, not just near a selected file) as their first follow-up. The
build behaved exactly as specified; the spec's own assumption under-covered the real
requirement. See `[[spec-assumption-verification]]`.

## Step 2 — Workflow evaluation

- **Complexity routing**: "standard" tier (spec → plan → build → reflect → archive) fit
  this task's real shape — 4-5 files, a clear existing pattern to mirror
  (`write_file_in` / `create_project_directory`), no genuinely open design decision at
  spec time. Not mis-routed.
- **Sharding**: no build step needed context its own step file didn't carry. Reading each
  `context/build-steps/*.md` cold, per step, worked fine end to end.
- **Spec correction during build**: none in the sense of "the spec was wrong and had to
  be edited" — but assumption 4's incompleteness (above) is the kind of gap a sharper
  Step-1-assumptions pass in `/seed:spec` could have caught by checking whether "selected
  directory" already existed as state in the tree, instead of silently picking the
  nearest existing concept (file selection) and moving on.
- **Tooling gap surfaced mid-build**: `scripts/commit-guard.sh`'s stock
  `TEST_NAME_PATTERNS` is purely filename-based and cannot recognize this project's Rust
  convention of inline `#[cfg(test)] mod tests`. Every Rust-touching commit in Phase 1
  would have failed the gate until this was patched once, on the spot. This should have
  been caught during `/seed:init` (which explicitly names checking the test-naming
  convention as a Step 1 task) rather than discovered by a failing guard mid-build. See
  `[[rust-inline-test-convention]]`.
- **Operational lesson**: Phase 4's attempt to automate a GUI smoke pass via macOS
  `osascript`/System Events (`click at {x,y}`) mis-clicked into the operator's own,
  unrelated Safari window instead of the target app. This environment has no isolated
  display or sandboxed GUI target — it is the operator's real physical desktop, and
  coordinate-based OS-level automation has no reliable way to confirm which window
  actually receives a click. Aborted immediately; the operator ran the manual pass
  themselves instead. See `[[gui-automation-unsafe-in-this-environment]]`.

## Step 3 — Patterns extracted

Written to `memory-bank/agent-rules/_learned/`:

- `tooling-setup.md` → `rust-inline-test-convention`
- `spec-writing.md` → `spec-assumption-verification`
- `environment-safety.md` → `gui-automation-unsafe-in-this-environment`
