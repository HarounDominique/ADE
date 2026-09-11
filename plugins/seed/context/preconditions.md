# Preconditions — the memory bank has to exist before anything writes to it

Every command except `/seed:init` reads or writes under `memory-bank/`. None of them can
assume it is there: a project is uninitialized until `/seed:init` has run, and that is the
normal state of every project the first time it meets this workflow.

## The check

Before doing anything else, look for `memory-bank/` in the project root.

- **Present** → proceed.
- **Absent** → this project has never been initialized. Say so, run `/seed:init`, and then
  continue with what was asked. Do not ask the human whether to initialize: they asked for
  work that requires a memory bank, and initializing is what that requires. Report that
  you did it, do not do it silently.
- **Present but missing a directory this command needs** (`specs/`, `tasks/`, `roadmap/`,
  `creative/`, `reflection/`, `archive/`, `agent-rules/_learned/`) → create the directory
  and carry on. A partially-shaped tree is not a reason to stop; `/seed:doctor` check 1
  exists to report it, not to block work on it.

## Why this is not left to judgement

Without the check, `/seed:spec` writes `memory-bank/specs/SPEC-<slug>.md` into a tree that
does not exist. Depending on the tool that performs the write, that either fails with a
path error the human has to interpret, or silently creates a lone `specs/` directory with
no `projectConfig.md`, no hot cache, no commit guard and no gitignore entry — a project
that looks initialized and is not. Both outcomes cost more than the check.

The human should never be the one who remembers this. A workflow whose first phase
depends on the operator knowing to run a setup command first has simply moved its own
precondition into their head.

## Where it applies

Every command whose **Memory Bank Integration** block names a path under `memory-bank/`.
`/seed:init` is the only exception — it is what creates the tree, and running it on an
already-initialized project is a no-op by design, not an error.
