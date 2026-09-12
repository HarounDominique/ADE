# SPEC: Reject Windows-reserved names and forbidden characters on create/rename

status: approved

## Objective

`validate_new_entry_name` (`desktop/src-tauri/src/lib.rs`, shared by New File, New
Directory, and Rename) only rejects empty/`.`/`..`/path separators. It accepts
Windows-reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`,
`LPT1`-`LPT9`, case-insensitive, reserved even with an extension like `CON.txt`), the
characters forbidden in a Windows filename (`< > : " | ? *`, and ASCII control
characters), and a trailing space or period (Windows silently strips these, so the
name that gets created differs from the name that was typed). A repo built or edited
on macOS/Linux can silently accumulate any of these; the moment that repo is opened,
cloned, or synced on Windows, creating, reading, or even `git checkout`-ing that entry
fails. Reject all of these universally, on every platform Assay runs on — the point is
a repo Assay creates or edits never contains a file that only Windows can't handle,
not that this specific machine can't handle it.

## Structure

- **`desktop/src-tauri/src/lib.rs`**: `validate_new_entry_name` gains three more
  rejection rules, layered onto the existing ones (does not replace them). A new
  `const WINDOWS_RESERVED_NAMES` list. The function's error message stays specific per
  rule (empty/dot vs separator vs forbidden character vs reserved name), matching this
  function's existing style of one clear message per failure reason rather than one
  generic "invalid name."
- No frontend change — `create-workspace-file`/`create-workspace-directory`/
  `rename-workspace-entry` already surface whatever error string this function
  returns via the existing error-toast path used for every other Tauri command
  rejection; a new rejection reason is automatically visible the same way the
  existing ones already are.
- **Tests**: direct unit tests on `validate_new_entry_name` itself (it's a pure
  function, already private-but-testable via `mod tests { use super::*; }`) for each
  new rule, rather than the heavier fixture-based `create_workspace_directory_in`
  ceremony the existing separator/empty-name tests use — cheaper and more direct for
  logic with no I/O.

## Style

```rust
const WINDOWS_RESERVED_NAMES: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

fn validate_new_entry_name(name: &str) -> Result<&str, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed == "." || trimmed == ".." || trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Name cannot be empty, \".\", \"..\", or contain a path separator.".to_string());
    }
    if trimmed.ends_with('.') || trimmed.ends_with(' ') {
        return Err("Name cannot end with a space or a period -- Windows will not create it as typed.".to_string());
    }
    if trimmed.chars().any(|c| matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*') || (c as u32) < 32) {
        return Err("Name cannot contain < > : \" | ? * or a control character -- reserved on Windows.".to_string());
    }
    let base = trimmed.split('.').next().unwrap_or(trimmed);
    if WINDOWS_RESERVED_NAMES.iter().any(|reserved| reserved.eq_ignore_ascii_case(base)) {
        return Err(format!("\"{base}\" is a reserved device name on Windows and cannot be used, even with an extension."));
    }
    Ok(trimmed)
}
```

## Test strategy

- `cargo test` (`desktop/src-tauri`) — new cases directly on `validate_new_entry_name`:
  rejects `CON`, `con.txt`, `COM1`, `LPT9` (case-insensitive, with and without
  extension); rejects a name ending in `.` or a trailing space; rejects each forbidden
  character (`<>:"|?*`) individually and a control character; still accepts an
  ordinary name and one that merely *contains* a reserved word as a substring (e.g.
  `reconsider.txt`, `disconnect`) — the check is on the base name exactly, not a
  substring match.
- Manual verification: possible on macOS for the create/rename dialogs actually
  refusing these names (the validation itself runs identically on every platform,
  only the historical *reason* Windows needs it is platform-specific) — worth a quick
  operator check that typing `CON` into New File is refused with a clear message.

## Boundaries

**Always:** validation applies identically on every platform (never `#[cfg(windows)]`
-gated) — the objective is that a repo built on macOS never contains a Windows-hostile
name, which requires rejecting it at creation time regardless of which OS created it.

**Never:** never silently renames or sanitizes a rejected name (e.g. auto-appending a
suffix to `CON`) — refuses with a clear reason, same as every other rejection this
function already produces, leaving the operator to pick a different name themselves.
