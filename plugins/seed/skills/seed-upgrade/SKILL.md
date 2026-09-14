---
name: seed-upgrade
description: Migrate a project's SEED memory bank through the declared schema migrations.
---

# SEED upgrade

Read the project's schema version and apply each declared migration in order.
Use idempotent checks, change only what the migration specifies, and report the
version transition. If a precondition is ambiguous, stop rather than guessing
or combining unrelated cleanup.
