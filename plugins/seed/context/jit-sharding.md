# Just-in-time phase loading

The single biggest driver of cost growth in a long-lived project is a command that loads
its entire multi-step procedure into context before executing step one. A `build` that
reads steps 1 through 6 to run step 1 pays for steps 2-6 on every turn, forever, whether
or not they run yet.

## Rule

Long commands (`plan`, `build`) are sharded into one file per step:

```
commands/build.md              # metadata + step index + dispatch logic only, IS /seed:build
context/build-steps/
├── step-1-git-setup.md        # not a command — read only by build.md's dispatch logic
├── step-2-tdd.md
├── step-3-batch-test.md
├── step-4-review.md
├── step-5-document.md
└── step-6-commit.md
```

Step files live outside `${CLAUDE_PLUGIN_ROOT}/commands/` on purpose — anything under `${CLAUDE_PLUGIN_ROOT}/commands/` registers as
a slash command, and a step file is a dispatch target, never something invoked directly.

`${CLAUDE_PLUGIN_ROOT}/commands/build.md` never inlines a step's body — it reads the current phase from the task file's
execution state, then reads (only) that one step file, executes it, writes the new state,
and stops. The next invocation reads state again and picks up the next step file cold.

## What this buys

- Context per turn is bounded by one step, not by the whole command, regardless of how
  many steps a workflow eventually grows.
- A step file can be edited or extended without inflating every other step's context cost.
- A crash or interruption mid-command loses nothing beyond the current step — state is
  read from disk, not carried in a long-running context.

## What this does not replace

Sharding controls *how much loads*, not *how much is trusted*. The TDD commit-guard
(`${CLAUDE_PLUGIN_ROOT}/context/tdd-and-commit-guard.md`) still runs regardless of which step file executed —
it reads the actual diff and test run, not a claim made inside a step.

## A step file that runs a plugin script directly

Reading a step/context/template file via `${CLAUDE_PLUGIN_ROOT}/...` just works. Running
one of `${CLAUDE_PLUGIN_ROOT}/scripts/*.sh` via the Bash tool needs the real path
substituted first — see `${CLAUDE_PLUGIN_ROOT}/context/plugin-paths.md`.
