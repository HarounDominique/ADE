---
topic: testing-side-effecting-code
priority: medium
---

### extract-pure-logic-from-process-spawning-commands
_derived_from: reflection/explorer-open-in-terminal-and-file-manager.md · evidence_count: 1 · last_validated: 2026-09-12_

When a Tauri command's job ends by launching a real external process (opening a file/
folder/URL with the OS default handler, starting an OS terminal, etc. — anything built on
`open_with_desktop` or similar in `desktop/src-tauri/src/lib.rs`), never write a test that
exercises that command's success path — it will actually spawn the process during
`cargo test` (already true of `open_file_in`, whose own tests cover only its rejections
for this reason). Instead, extract the pure decision logic the command makes before the
spawn (which path, which folder, which argument) into its own small function and unit-
test that directly; leave the spawn itself unexercised, same as every sibling command
already does.
