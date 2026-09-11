# Step 3 — batch test

## 0. Model tier for this dispatch

Increment `Step Attempts[3]` by 1 and write it back before dispatching.

- Now `1` → dispatch `${CLAUDE_PLUGIN_ROOT}/agents/build-batch-test-agent.md` at its
  default tier (`sonnet`).
- Now `2` → dispatch the same agent with `model: opus` for this call (a failure survived
  the first pass's fix attempt — see `${CLAUDE_PLUGIN_ROOT}/context/model-routing.md`
  rule 3).
- Would be `3` → do not dispatch again. Halt this phase, name the still-red test(s), and
  ask for a human decision.

## 1-3. Run the agent

1. Run the full test batch affected by this phase's changes (not only the new test from
   step 2 — anything the change could plausibly have touched).
2. Fix any red result in this same context before moving on. A failure here belongs to
   this phase, not to a future cleanup pass.
3. If a failure resists this pass's direct fix, re-read the spec section this phase
   satisfies for a misunderstood requirement before suspecting the test — if it's still
   red after that, this is the trigger for the counter in step 0 on the next dispatch.
4. **Record the actual result the commit-guard reads later**: after the batch's final
   run this pass, write its real exit code to `memory-bank/.local/last-test-exit-code`
   (create `memory-bank/.local/` if absent) — e.g. `... ; echo $? > memory-bank/.local/last-test-exit-code`.
   This is not optional bookkeeping: `scripts/commit-guard.sh` refuses to commit at all
   if this file is missing, precisely so "the tests ran and are green" is never a claim
   nobody checked.
5. Write execution state: `Current Step: 4/6` (leave `Step Attempts` as written in step 0).

Return: proceed to step 4.
