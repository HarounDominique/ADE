# Memory-bank schema migrations

`memory-bank/projectConfig.md`'s `schema_version` field (top of file, before any `##`
heading) names which shape of `memory-bank/` this project was initialized against. A
project with no such field is `schema_version: 0` — every project initialized before this
field existed.

`/seed:upgrade` is the only command that bumps this field. No other command should
assume a schema shape newer than what `schema_version` declares.

## Migration table

| From | To | Change | How to apply |
|---|---|---|---|
| 0 | 1 | Added `## Detected Stack` section to `projectConfig.md` | If absent, append it with `[not detected — initialized before this field existed; run manually if useful]` rather than fabricating stack detection after the fact |
| 0 | 1 | Added `## Agent Backends` section to `projectConfig.md` | If absent, append the commented-out template block from `templates/projectConfig-template.md` — never assume a prior silent default, make the default explicit |
| 0 | 1 | `agent-rules-index.md` / `/seed:rules-index` introduced | No file migration needed — the index is generated fresh the first time any command needs it; a project with pre-existing `agent-rules/*.md` files just runs `/seed:rules-index` once after upgrading |

Each row is independent and idempotent — applying it twice is a no-op (check "is the
section already there" before appending, don't append a duplicate).

## Adding a new migration

When a future change to `templates/*.md` or `context/memory-bank-schema.md` changes what
a freshly-initialized project looks like, add a row here (`schema_version` N to N+1)
*before* shipping the change that motivated it — this file is the single place that knows
how to bring an old project's `memory-bank/` up to the new shape, and a change that
doesn't add a row here has silently broken every project that already ran `/seed:init`.
