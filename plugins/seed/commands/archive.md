---
description: Close a task — validates green, then merges the branch (or opens the PR if a remote exists)
argument-hint: <slug>
---

# /seed:archive — close the task

---

## Memory Bank Integration

**Reads from:** `memory-bank/tasks/<slug>.md`, `memory-bank/reflection/<slug>.md`.
**Updates:** `memory-bank/archive/<slug>.md`; resets nothing in `_learned/` (that
persists across tasks by design).
**References:** —

---

## Step 1: Precondition

Refuse if `/seed:reflect` has not produced `memory-bank/reflection/<slug>.md` — closing
without reflection silently drops the learning step. Exception: fast-path tasks may carry
a one-paragraph reflection inline in the task file instead of a full document; either
satisfies this gate.

## Step 2: Write the archive document

Summary of what was built, the spec(s) it satisfies, deviations accepted, link to the
reflection document.

## Step 2.5: If this task's spec belongs to a nexus, sync it now

Check the task's spec frontmatter (or `memory-bank/specs/SPEC-NEXUS.md`'s Modules table)
for a `Nexus:` reference. If one exists, run
`${CLAUDE_PLUGIN_ROOT}/commands/spec-sync.md` for this module **before** Step 3 —
mark the module `done`, clear anything it was blocking, recompute readiness for whatever
depended on it, append the Change Log line. A merge that leaves the nexus row `ready`
after the module actually shipped is exactly the drift `context/spec-hygiene.md` exists
to catch later; doing it here means there is nothing to catch. `/seed:doctor` check 3
verifies this did not get skipped.

## Step 3: Commit the corpus onto the feature branch

The task's whole cold-truth trail — its spec(s), its task file, its reflection document,
and this archive document — lands on `feature/<slug>` in one commit before merge, so the
branch that gets merged is self-contained (the merge itself is Step 5, not this commit).
Do not defer any of these to "already committed somewhere" — verify each actually is,
right now, on this branch.

## Step 4: Validate before merge — every flow ends this way, never skipped

A branch merges into the target only once it is shown green, not once reflection exists.
Run `${CLAUDE_PLUGIN_ROOT}/commands/verify.md` Step 1 (lint, full test suite, build) on
`feature/<slug>` right now, even if a build phase already ran tests — this is the
independent check right before merge, not a trust of an earlier one.

- Green → proceed to Step 5.
- Red → refuse to merge. Report exactly what failed and on which file. The task stays
  on its branch, `Build Status` unchanged, until a follow-up build phase or fix makes it
  green — archive does not merge a red branch to "finish the task anyway".

## Step 5: Merge

Merge `feature/<slug>` into the project's configured target branch
(`memory-bank/projectConfig.md`'s git section). If a remote exists and the project
config names one, open the pull request with the archive document as its body instead of
merging directly. If there is no remote configured at all, merge locally into the target
branch and say so explicitly — do not attempt to open a pull request against nothing.

After a successful merge (local or via PR merge), the feature branch has done its job —
delete it locally once merged, keeping `git branch` free of finished work.

## Step 6: Reset for the next task

The task file's execution state does not need clearing — a new task gets a new slug and a
new file. Nothing here mutates `agent-rules/_learned/` or any other task's files.
