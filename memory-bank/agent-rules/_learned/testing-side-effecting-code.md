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

### kill-spawned-children-in-finally
_derived_from: reflection/offer-git-init-when-no-vcs.md · evidence_count: 1 · last_validated: 2026-09-12_

Any test that `spawn()`s a real child process (the desktop sidecar, a shelled-out CLI)
and awaits its output must call `child.kill()` in a `finally` block, not only after the
last assertion. An assertion that throws before cleanup leaves the child alive with its
stdio pipes still open, which keeps the test runner's event loop from ever draining —
the whole run hangs indefinitely instead of just failing that one test, and the hang
gives no output to diagnose it by (node's test reporter buffers the failure detail until
process exit). Wrap the request/assert sequence in `try { ... } finally { child.kill();
await once(child, "close"); }` from the start, even for a test expected to pass.
