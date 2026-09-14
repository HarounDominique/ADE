# Reflection: terminal-attachments

## Implementation review

The approved scope is implemented: native Tauri drag events identify the terminal
PTY or Agents composer, Rust validates regular files from any local path without
reading bytes, and the frontend keeps canonical paths as references. Terminal drops
are shell-quoted and written through the existing `terminal_input` path; they never
execute. Agents shows removable references and includes them only when the operator
presses Send. The same provider-neutral prompt contract therefore serves Claude Code,
Codex and OpenCode.

Acceptance evidence:

- POSIX and Windows quoting, deduplication and empty-path handling: 3 focused tests.
- Native validation outside the Project and directory rejection: Rust unit test.
- Desktop contract and existing regression suite: 158 focused tests pass.
- Full repository suite: 691/691 tests pass with local integration permissions.
- TypeScript build and macOS native bundle: pass; `Assay.app` produced under the
  release bundle directory.

No scope deviation was accepted. Folders remain out of scope, content is never read
or uploaded, and no provider-specific adapter or dependency was introduced.

## Workflow review

The task was correctly routed as a multi-phase feature because it crossed the native
shell, PTY input, Agents composer and provider-neutral contracts. The implementation
needed no spec correction beyond resolving the operator's three open decisions. The
only verification discrepancy was environmental: sandboxed full tests could not bind
127.0.0.1, while the same suite passed outside the sandbox.

## Reusable learning

For desktop file drops, use the host's native drag event bridge and validate paths in
Rust before handing them to UI or PTY code; treat dropped paths as references and keep
content access an explicit later action.
