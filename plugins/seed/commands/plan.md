---
description: Turn an approved spec into a phased build roadmap — refuses to run without one
argument-hint: <slug>
---

# /seed:plan — turn an approved spec into a phased build roadmap

---

## Memory Bank Integration

**Precondition:** `memory-bank/` must exist — see `${CLAUDE_PLUGIN_ROOT}/context/preconditions.md`. Absent, run `/seed:init` first, say that you did, then continue.

**Reads from:** `memory-bank/specs/SPEC-<slug>.md` (or the relevant module spec under a
nexus), `memory-bank/agent-rules-index.md` (run `${CLAUDE_PLUGIN_ROOT}/commands/rules-index.md`
first if missing or stale), `memory-bank/projectConfig.md`.
**Updates:** `memory-bank/tasks/<slug>.md` (creates it, or extends its `## Implementation
Roadmap` if it already exists from a fast-path spec).
**References:** `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`, `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`.

---

## Step 0: Hard gate — refuse without a spec

Look for `memory-bank/specs/SPEC-<slug>.md` (or the module spec this task belongs to).

- **Missing entirely** → stop. Do not draft a plan from the conversation. Tell the user
  to run `/seed:spec` first and exit.
- **Present, status `draft`** → stop. Report what is unapproved and exit. A plan built on
  an unapproved spec inherits its ambiguity silently.
- **Present under a nexus, but the nexus row is `blocked`** → stop. Name what it is
  blocked by and exit.
- **Present and `ready`/approved** → proceed.

This gate is not a formality — it is the mechanism that makes "spec-grounded" true rather
than aspirational. No exception path exists for "just this once, the requirement was
obvious in chat".

## Step 1: Read complexity signals

Apply `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md` to the approved spec's scope, not to the original
conversational request — the spec is the corrected, de-ambiguated version of the ask.

## Step 2: Draft the phased roadmap

One phase per independently-committable increment. Each phase states: what it delivers,
which spec section(s) it satisfies, its test strategy (from the spec's Test strategy
section), and whether it needs `/seed:creative` before it can be built.

## Step 3: Write the task file

Create `memory-bank/tasks/<slug>.md` from `${CLAUDE_PLUGIN_ROOT}/templates/task-template.md`
**verbatim** — do not hand-write a shorter inline version. The template already carries
every `## Execution State` field `/seed:build`'s steps depend on
(`Current Step`, `Step Attempts`, `Last Block Rule`) — a copy that drops any of them
looks fine until a build phase tries to read a field that was never there. Fill in
`<slug>`, the spec filename, and the roadmap's phase list; leave `status: planned` and
the Execution State defaults exactly as the template has them.

## Step 4: Gate

Present the roadmap for human approval before any `/seed:build` phase runs. On approval,
mark the task file `status: approved` and report `Next likely: /seed:build <slug>` (or
`/seed:creative <slug>` if a phase needs design decisions first).

## Step 5: Commit

Commit `memory-bank/tasks/<slug>.md` on the current branch **now**, whether or not this
run got a human approval — the roadmap itself is a fact worth having in git the moment
it's written, same reasoning as `${CLAUDE_PLUGIN_ROOT}/commands/spec.md` Step 5. A task
still sitting on the default branch with no `feature/*`/`task/*` branch yet (this
command runs before `/seed:build`'s step 1 creates one) is exactly the scenario
`${CLAUDE_PLUGIN_ROOT}/commands/go.md`'s discovery Step 1 point 2 exists for — it should
never be looking at an uncommitted file to find this task. Commit message: `plan: <slug>`.
