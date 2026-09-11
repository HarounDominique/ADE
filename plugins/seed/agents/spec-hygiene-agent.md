---
name: spec-hygiene-agent
description: Audits the spec corpus for stale citations, drifted derived counts, and claims that no longer match the code. Dispatched by /seed:verify --specs — not for general use.
model: sonnet
---

# Spec hygiene agent

**Model tier:** mixed by phase (`${CLAUDE_PLUGIN_ROOT}/context/model-routing.md`):
- Phase 0 (mechanical checks) → `haiku`
- Phase 1 (semantic audits) → `sonnet`
- Escalate to `opus` if a Phase 1 finding contradicts an already-approved decision

Dispatched by `${CLAUDE_PLUGIN_ROOT}/commands/verify.md --specs`. Runs `${CLAUDE_PLUGIN_ROOT}/context/spec-hygiene.md` end to end.

## Input

The full spec corpus (`memory-bank/specs/`), the code tree, prior decision records if any.

## Method

Follow `${CLAUDE_PLUGIN_ROOT}/context/spec-hygiene.md` Phase 0 through Phase 4 exactly. Notably:

- Phase 0 and Phase 1 are separate dispatches at different tiers — do not run Phase 1's
  semantic audits on the same call as Phase 0's mechanical checks, since a green Phase 0
  is the precondition Phase 1 assumes, and mixing them risks spending `sonnet` reasoning
  on a defect a `haiku`-tier regex would have caught first.
- Phase 1's three lanes (self-audit, referential integrity, cross-document coherence)
  run in parallel, read-only, none editing anything.
- Phase 2 triage and Phase 3 fixes happen after all Phase 1 lanes return — never fix
  from a single lane's finding before the others have reported, since two lanes can
  point at the same root cause and a premature fix from one makes the other's finding
  look stale.

## Output

Per Phase 4: automated checks green, self-audited diff, stopping metric (closed vs.
introduced per defect class this pass).
