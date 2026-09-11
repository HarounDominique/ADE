---
description: Run one build phase (or all remaining with --auto), dispatching only the current step file
argument-hint: <slug> [--auto]
---

# /seed:build — one phase, dispatched from the current step file only

This file is metadata and dispatch logic only. It never inlines a step's body — that is
the whole point of `${CLAUDE_PLUGIN_ROOT}/context/jit-sharding.md`.

---

## Memory Bank Integration

**Reads from:** `memory-bank/tasks/<slug>.md` `## Execution State`,
`memory-bank/agent-rules-index.md` (step 4's review gate loads its **Active rules** table,
never the raw `agent-rules/` files — run `${CLAUDE_PLUGIN_ROOT}/commands/rules-index.md`
first if the index is missing or older than any file under `agent-rules/`, per
`${CLAUDE_PLUGIN_ROOT}/agents/build-code-reviewer-agent.md`).
**Updates:** the same section, after each step.
**References:** `${CLAUDE_PLUGIN_ROOT}/context/jit-sharding.md`, `${CLAUDE_PLUGIN_ROOT}/context/tdd-and-commit-guard.md`.

---

## Step index

Step files live under `${CLAUDE_PLUGIN_ROOT}/context/build-steps/`, not under `${CLAUDE_PLUGIN_ROOT}/commands/` — they are dispatch
targets, never registered as slash commands themselves (see `${CLAUDE_PLUGIN_ROOT}/context/jit-sharding.md`).

1. `${CLAUDE_PLUGIN_ROOT}/context/build-steps/step-1-git-setup.md` — worktree + branch
2. `${CLAUDE_PLUGIN_ROOT}/context/build-steps/step-2-tdd.md` — RED then GREEN, one warm context
3. `${CLAUDE_PLUGIN_ROOT}/context/build-steps/step-3-batch-test.md` — run affected batch, fix in-context
4. `${CLAUDE_PLUGIN_ROOT}/context/build-steps/step-4-review.md` — quality gate
5. `${CLAUDE_PLUGIN_ROOT}/context/build-steps/step-5-document.md` — memory bank updates
6. `${CLAUDE_PLUGIN_ROOT}/context/build-steps/step-6-commit.md` — commit-guard, then commit

## Dispatch

1. Read the task file's `## Execution State`. If `Build Status: NOT_STARTED`, this is
   Phase N's first invocation — start at step 1.
2. If `RUNNING`, read `Current Step` and resume there — do not re-run completed steps.
3. Read **only** the one step file for the current step. Execute it. It returns updated
   state (which step is next, or `DONE` for this phase).
4. Write the new `## Execution State` before returning control.
5. If the roadmap has more unchecked phases, stop here — `/seed:build` runs one phase per
   invocation by default. `--auto` chains remaining phases, dispatching this same
   sequence fresh per phase.

## `--auto`

Loop Step 1-5 above per remaining unchecked roadmap phase, in the main session, until
none remain or a halt condition fires: a step reports it is blocked, the commit-guard
fails past a small fix-retry budget, or a design fork appears that the roadmap did not
anticipate. A halt is a resumption point, not a failure state — re-invoke to continue.
