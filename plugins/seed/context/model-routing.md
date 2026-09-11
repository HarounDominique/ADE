# Model routing — cheapest model that can do the job

Every agent dispatch picks a model tier from the task at hand, not a fixed default. A
routing rule, not a per-agent hardcode — so tightening or loosening it happens in one
file.

## Tiers

| Tier | Use for | Cost |
|---|---|---|
| `haiku` | Structured/mechanical: routing, doc formatting, citation checks, git setup, simple extraction | lowest |
| `sonnet` | General coding, orchestration, standard TDD/build/review work | mid |
| `opus` | Architecture, ambiguous requirements, hard debugging, adversarial review of a high-stakes decision | highest |

## Signals that pick the tier

Read these in order — the first one that fires wins, no averaging:

1. **Task explicitly flagged high-stakes** (spec Boundaries says "ask first" or "never",
   a nexus module marked critical-path, a decision that's hard to reverse) → `opus`,
   regardless of surface size.
2. **Open design decision or ambiguous requirement** (routed as `designed` in
   `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`, or a build phase whose spec heading needed
   interpretation per `${CLAUDE_PLUGIN_ROOT}/agents/build-tdd-agent.md`'s output note) → `opus` for the
   decision itself; the resulting implementation can still run on `sonnet`.
3. **A prior attempt at this exact step already failed once** (test still red after a
   fix attempt, a review blocked twice on the same finding) → escalate one tier from
   whatever ran it, once. Do not escalate again without a human checkpoint.

   **Mechanism, not just intent.** The task file's `Step Attempts` counter
   (`templates/task-template.md`) makes this concrete: steps 2/3/4 each increment their
   own counter on entry, before dispatching.
   - Counter reaches 1 → dispatch at the step's default tier (its agent frontmatter's
     `model:` field, no override).
   - Counter reaches 2 → dispatch the **same agent file** with an explicit `model: opus`
     override at call time (the Agent tool's `model` parameter beats the file's own
     frontmatter default for that one call) — this is the actual token-saving lever:
     the expensive tier is spent only on the retry that already proved itself hard,
     never on the first attempt.
   - Counter would reach 3 → do not dispatch again. Halt the phase and report which step,
     to whom, and why — a second opus-tier failure at the same step is a human decision,
     not a third automatic attempt.
   - `Step Attempts` resets to `{2: 0, 3: 0, 4: 0}` at the start of every new phase
     (`context/build-steps/step-1-git-setup.md`), never mid-phase.
4. **Structured, single-shape, low-ambiguity work** (formatting a doc into a template,
   checking citations resolve, git branch setup, extracting a count from a table) →
   `haiku`.
5. **Everything else** → `sonnet`.

## Default tier per agent

| Agent | Default | Escalates to |
|---|---|---|
| `build-git-setup-agent` (step 1) | haiku | — |
| `build-tdd-agent` (step 2) | sonnet | opus, on rule 3 |
| `build-batch-test-agent` (step 3) | sonnet | opus, on rule 3 |
| `build-code-reviewer-agent` (step 4) | sonnet | opus, if blocking a `critical` rule twice |
| `build-documentation-agent` (step 5) | haiku | — |
| `spec-writer-agent` (delegates to spector where available) | sonnet | opus, for a nexus with >1 module or any `critical-path` module |
| `spec-hygiene-agent` (Phase 0 mechanical checks) | haiku | — |
| `spec-hygiene-agent` (Phase 1 semantic audits) | sonnet | opus, if a Phase 1 finding contradicts an approved decision |
| `reflection-agent` | sonnet | opus, only for a task that was itself `opus`-tier |

## Where this lives

Every agent methodology file in `${CLAUDE_PLUGIN_ROOT}/agents/` states its own row above instead of a fixed
model name inline — a routing-table edit here changes every agent's behavior without
touching their files.

## What this is not

Not a cost cap that silently degrades quality — rule 1 and rule 3 exist precisely so a
hard or high-stakes step never runs on a model too cheap for it. The savings come from
never spending `opus` on the steps that were never going to need it (branch setup,
citation checks, doc formatting), not from underpowering the ones that do.
