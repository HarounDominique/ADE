# Step 6 — commit-guard, then commit

Runs the deterministic gate from `${CLAUDE_PLUGIN_ROOT}/context/tdd-and-commit-guard.md`. This step does not
use judgment — it runs the guard and obeys its verdict.

1. Run `scripts/commit-guard.sh` (the project's own copy, at the project root — not
   `${CLAUDE_PLUGIN_ROOT}/scripts/commit-guard.sh`) against the actual staged diff. It
   reads its own recorded test result from `memory-bank/.local/last-test-exit-code`,
   written by step 3 — if step 3 hasn't run this phase (shouldn't happen in normal
   dispatch order, but if resuming into step 6 directly after a crash, confirm it did),
   the guard refuses rather than assuming green.
2. Guard fails → do not commit. Write execution state back to `Current Step: 2/6` (RED
   phase must be revisited) and report exactly which check failed.
3. Guard passes → **before staging or committing**, update `memory-bank/tasks/<slug>.md`
   in place: check off this phase's roadmap box, and set `Build Status` to
   `NOT_STARTED` (more unchecked phases remain — a fresh `/seed:build` invocation starts
   the next one at step 1) or `DONE` (none remain). Then stage the code diff *and* this
   task-file update together, and commit once, with a message naming the phase and the
   spec section it satisfies. **Never commit the code first and the task-file state
   update second** — a phase whose "done" marker isn't in the same commit as its code
   is exactly the drift `context/spec-hygiene.md` exists to catch later, and here it's
   free to avoid by ordering the write before the commit instead of after it.
4. If `Build Status` is now `DONE`, report `Next likely: /seed:reflect <slug>`.
