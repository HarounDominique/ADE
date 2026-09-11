---
description: Migrate this project's memory-bank/ to the current SEED schema version
---

# /seed:upgrade — memory-bank schema migration

---

## Memory Bank Integration

**Precondition:** `memory-bank/` must exist — see `${CLAUDE_PLUGIN_ROOT}/context/preconditions.md`. Absent, run `/seed:init` first, say that you did, then continue.

**Reads from:** `memory-bank/projectConfig.md`'s `schema_version` field,
`${CLAUDE_PLUGIN_ROOT}/context/schema-migrations.md`.
**Updates:** `memory-bank/projectConfig.md` and whatever else a migration row touches.
**References:** `${CLAUDE_PLUGIN_ROOT}/context/schema-migrations.md`.

---

## Step 1: Read current version

Missing `schema_version` field entirely → this project is version `0`. Present → that
number. Read `${CLAUDE_PLUGIN_ROOT}/context/schema-migrations.md`'s Migration table for
the current target version (the highest `To` value in the table).

## Step 2: Already current?

Current version equals target → report so and exit. Nothing to do — this is not an error.

## Step 3: Apply each migration row in order

For every row from the project's current version up to target, in table order:

1. Check the row's "how to apply" precondition — is the change already present (idempotent
   check), or genuinely missing.
2. If missing, apply exactly what the row specifies — nothing more. Never take the
   opportunity to also "clean up" unrelated things in `projectConfig.md` while migrating;
   that is a separate, human-requested edit, not part of an upgrade.
3. After all rows up to target are applied, set `schema_version` to the target number.

## Step 4: Report

List each row applied (or skipped because already present), and the version transition
(`0 → 1`). If any row's precondition couldn't be determined confidently, stop and ask
rather than guessing — a migration is exactly the kind of one-way door where a wrong
guess is expensive to unwind later.

## Step 5: Commit

Commit the changes on the current branch now, message `upgrade: schema <from> -> <to>` —
same reasoning as every other command that writes memory-bank state (see
`${CLAUDE_PLUGIN_ROOT}/commands/spec.md` Step 5).
