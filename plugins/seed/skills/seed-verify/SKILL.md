---
name: seed-verify
description: Verify a SEED task or specification corpus and report evidence without guessing green status.
---

# SEED verify

Run the repository's declared build, test and lint commands and report their
actual exit status. Check the staged diff against the task acceptance criteria,
the TDD commit guard and documentation impact. A missing or unrun check is
unverified, not passed. Use the same rule for specification-corpus hygiene.
