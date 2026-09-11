# Step 4 — code review gate

Quality gate before any commit — blocks on violations, does not merely note them.

## 0. Model tier for this dispatch

Increment `Step Attempts[4]` by 1 and write it back before dispatching.

- Now `1` → dispatch `${CLAUDE_PLUGIN_ROOT}/agents/build-code-reviewer-agent.md` at its
  default tier (`sonnet`).
- Now `2` **and** the blocking finding is the *same* rule id as last time
  (`Last Block Rule` in the task file, set in step 3 below) → dispatch the same agent
  with `model: opus` (this is what "same finding twice" means concretely — a different
  rule blocking on the second pass is a fresh `1`, not an escalation).
- Would be `3` on the same rule id → do not dispatch again. Halt this phase, name the
  rule, and ask for a human decision.

## 1-4. Run the agent

1. Check the diff against `memory-bank/agent-rules/` matching this phase's touched
   files (globs, paths, or topics) — highest priority rule wins on conflict.
2. Check for correctness issues a test batch would not catch: unhandled boundary named in
   the spec's Boundaries section, a pattern the codebase already established elsewhere
   being contradicted without reason.
3. Block on anything that violates a `critical` or `high` priority rule. Write the
   blocking rule's id to `Last Block Rule` in the task file. Report and return to step 2
   for a fix — do not downgrade a finding to let a phase through.
4. Passes clean → clear `Last Block Rule`, write execution state `Current Step: 5/6`
   (leave `Step Attempts` as written in step 0).

Return: proceed to step 5.
