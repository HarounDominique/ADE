---
description: Feature and version tracking across many tasks — optional, never a gate on a single task's flow
argument-hint: [feature create <name> | feature link <feature> <task> | version create <v> | version release <v>]
---

# /seed:roadmap — feature and version tracking

Optional layer above individual tasks, for when work is grouped into features/versions.
A task never needs a roadmap entry to run through spec→plan→build→reflect→archive; this
exists for visibility across many tasks, not as a gate.

---

## Memory Bank Integration

**Precondition:** `memory-bank/` must exist — see `${CLAUDE_PLUGIN_ROOT}/context/preconditions.md`. Absent, run `/seed:init` first, say that you did, then continue.

**Reads from:** `memory-bank/roadmap/*.md`, `memory-bank/tasks/*.md` (for linked-task
status).
**Updates:** `memory-bank/roadmap/<feature>.md`.
**References:** —

---

## Usage

- `/seed:roadmap` — list features, each with its linked tasks and their phase.
- `/seed:roadmap feature create <name>` — creates `memory-bank/roadmap/<feature-slug>.md`.
- `/seed:roadmap feature link <feature-slug> <task-slug>` — records that a task belongs
  to a feature.
- `/seed:roadmap version create <version>` / `version release <version>` — groups
  features under a version; `release` only when every linked feature's tasks are archived.

## Feature file shape

```markdown
---
slug: <feature-slug>
version: <version or unassigned>
status: planned
---

## Linked Tasks
- <task-slug> — <phase from its task file>

## Notes
[Anything spanning multiple tasks under this feature that a single task file
shouldn't own — cross-task dependencies, shared risk.]
```

## Version file shape

`version create <version>` **must** write `memory-bank/roadmap/versions/<version>.md` —
a version is a real file, not merely a string a feature's frontmatter points at. Without
this file existing, `version release` has nothing to mark as released and nothing to
refuse against; do not treat "version create" as a no-op that only validates the name.

```markdown
---
version: <version>
status: planned
---

## Linked Features
- <feature-slug> — <status from its feature file>

## Notes
```

`version release <version>` sets this file's `status: released` — only after the Step 2
gate passes for every linked feature.

## Step 1: No mutable global index

Same rule as tasks: there is no registry file. `/seed:roadmap` with no argument lists
`memory-bank/roadmap/*.md` directly and cross-reads each linked task's current phase from
its own file — it never maintains a second copy of task status that could drift.

## Step 2: Version release gate

`version release <version>` refuses if any linked feature has a task not yet archived.
Report which task, not just that the gate failed.

## Step 3: Commit

Every subcommand that writes a file (`feature create`, `feature link`, `version create`,
`version release`) commits that write on the current branch immediately — same reasoning
as `${CLAUDE_PLUGIN_ROOT}/commands/spec.md` Step 5. `/seed:roadmap` with no argument
(list) writes nothing and has nothing to commit.
