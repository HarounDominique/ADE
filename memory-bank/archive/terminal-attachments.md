# Archive: terminal-attachments

## Delivered

Implemented native local-file drag and drop for the terminal PTY and Agents composer.
Terminal drops inject canonical shell-quoted paths without executing them. Agents keeps
visible removable local references and sends them only with explicit `Send prompt`.
Folders are rejected, files may live anywhere on the machine, and no content is read,
copied or uploaded.

## Contract

- Provider-neutral behavior shared by Claude Code, Codex and OpenCode.
- POSIX and Windows quoting covered by pure tests.
- Native Rust validation returns canonical regular-file paths.
- `run` output consoles remain non-interactive and unchanged.

## Evidence

- Focused desktop and feature tests: 158 passed.
- Full repository tests: 691 passed.
- Rust tests: 55 passed.
- TypeScript build: passed.
- macOS native bundle: produced at
  `desktop/src-tauri/target/release/bundle/macos/Assay.app`.

Reflection: [terminal-attachments](../reflection/terminal-attachments.md).
Specification: [SPEC-terminal-attachments](../../docu/specs/SPEC-terminal-attachments.md).
