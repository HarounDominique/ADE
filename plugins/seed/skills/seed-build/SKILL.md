---
name: seed-build
description: Execute an approved SEED build phase with TDD, verification and review gates.
---

# SEED build

Execute only the current approved phase. Read the relevant task and spec,
write the failing test first, implement the smallest change, run the affected
tests, inspect the diff, update documentation, and stop at the next human
gate. Preserve the task's attempt counter. Never bypass the commit guard or
claim success from an absent test run.
