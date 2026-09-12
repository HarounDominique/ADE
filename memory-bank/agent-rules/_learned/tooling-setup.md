---
topic: tooling-setup
priority: low
---

### rust-inline-test-convention
_derived_from: reflection/explorer-new-file-folder.md · evidence_count: 1 · last_validated: 2026-09-12_

`/seed:init`'s Step 1 test-naming detection must check whether Rust code in this project
keeps tests inline (`#[cfg(test)] mod tests` in the same file) rather than in a separate
`*_test.rs` file — if so, patch `scripts/commit-guard.sh`'s `TEST_NAME_PATTERNS`/add a
content-based check (e.g. a staged `.rs` file's diff adding a new `#[test]`) at init time,
not after a Rust commit fails the gate mid-build.
