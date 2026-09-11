# Step 2 — TDD: RED then GREEN

One warm context for both halves — the model that writes the test also implements
against it, so intent does not get lost in a handoff.

## 0. Model tier for this dispatch

Increment `Step Attempts[2]` by 1 and write it back before dispatching.

- Now `1` → dispatch `${CLAUDE_PLUGIN_ROOT}/agents/build-tdd-agent.md` at its default
  tier (`sonnet`, from its own frontmatter — no override).
- Now `2` → dispatch the same agent with an explicit `model: opus` override for this one
  call (this step is being re-entered because step 6's commit guard sent it back —
  see `${CLAUDE_PLUGIN_ROOT}/context/model-routing.md` rule 3).
- Would be `3` → do not dispatch. Halt this phase: report that step 2 has now failed
  twice, including once at `opus`, and needs a human decision. This is not a retry
  budget to raise — it is the intended stop.

## 1-3. Run the agent

1. Read this phase's entry in the roadmap and the spec section it satisfies
   (`SPEC-<slug>.md#<heading>`, per `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md` citation form).
2. Write the failing test first. Run it. Confirm it fails for the expected reason — a
   test failing on a typo in itself is not a valid RED; fix the test, not the target,
   until the failure is the right one.
3. Implement the minimum that makes it pass. Run it again. Confirm GREEN.
4. Write execution state: `Current Step: 3/6` (leave `Step Attempts` as written in step 0).

Return: proceed to step 3.
