---
description: Entry point — infers the next action from repository and task-file state
argument-hint: [status | cleanup | <initiative description>]
---

# /seed:go — entry point

Single entry point. Infers the next action from repository state instead of asking the
user to remember which command comes next.

---

## Memory Bank Integration

**Reads from:** `memory-bank/tasks/*.md` execution state, `memory-bank/specs/`, git branch list.
**Updates:** nothing directly — dispatches to the command whose turn it is.
**References:** `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`, `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`.

---

## Step 1: Discover in-flight work

Two sources, both required — a branch alone misses tasks not yet built, and checking
only the current working tree misses a task whose files live on a branch you haven't
checked out. **Never assume the current branch's working tree has every task file** — a
task's `memory-bank/tasks/<slug>.md` exists only on whichever branch last committed it,
same as any other file; read it with `git show <branch>:memory-bank/tasks/<slug>.md`
(or check the branch out) rather than a plain file listing.

1. List branches matching `feature/*`, `task/*`, `chore/*`. For each, read the linked
   task file's `## Execution State` **from that branch**, not from `HEAD`.
2. Separately, list `memory-bank/tasks/*.md` on the current branch (typically the
   default branch) whose `status`/`Build Status` isn't `DONE`-and-archived — a task has
   no branch at all until its first `/seed:build` phase runs
   (`context/build-steps/step-1-git-setup.md` is what creates it), so a just-specced or
   just-planned task lives on the default branch with nothing in `git branch` to find it
   by, and would be missed if this scan only looked at branch names.

Union the two by slug before Step 2 — never report only whichever source you checked
first, and never report "no task file found" for a branch without having checked that
branch's own tree.

## Step 2: Decide

- No in-flight branch, no argument → ask what to build, then go to `/seed:spec`.
- No in-flight branch, argument given → treat the argument as the initiative description,
  go to `/seed:spec`.
- In-flight branch, execution state says `RUNNING` → resume at `Current Step`.
- In-flight branch, execution state says a phase is `DONE` and the next phase hasn't
  started → announce the next command in sequence (spec → plan → creative? → build →
  reflect → archive) and offer to run it.
- Argument is `status` → print every in-flight task, its slug, branch, and current phase.
  No mutation.
- Argument is `cleanup` → list branches whose task is archived and safe to delete; do not
  delete without explicit confirmation.

## Step 3: Never skip the origin

If discovery finds a task file whose execution state has no completed `spec` phase,
route to `/seed:spec` regardless of what phase the file claims to be in — an execution
state that skipped spec is corrupt, not advanced.
