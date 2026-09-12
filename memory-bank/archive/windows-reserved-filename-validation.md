# Archive: windows-reserved-filename-validation

## Summary

`validate_new_entry_name` (`desktop/src-tauri/src/lib.rs`, shared by New File, New
Directory, and Rename) now rejects Windows-reserved device names (`CON`, `PRN`, `AUX`,
`NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`, case-insensitive, reserved even with an
extension), the characters Windows forbids in a filename (`< > : " | ? *` and control
characters), and a trailing period — on every platform, not just Windows, since the
goal is a repo Assay creates or edits never contains a name that only breaks once
opened on Windows. Found by a Windows-parity audit requested by the operator, not a
bug report.

Satisfies: `memory-bank/specs/SPEC-windows-reserved-filename-validation.md`.

## Deviations accepted

Dropped the originally-planned trailing-space rejection (the function's existing
`.trim()` already makes it unreachable); fixed a Rust import-list oversight caught
immediately by the RED test's compile error. Full detail in the task file.

## Reflection

Fast-path task; inline reflection in the task file. `cargo test` (51/51) and `npm
test` (524/524) both green.
