---
description: Design exploration for a roadmap phase flagged as needing a decision — optional, never a default
argument-hint: <slug>
---

# /seed:creative — design exploration, only when the plan calls for it

Optional by construction. A task whose roadmap phases carry no open design decision
never invokes this — no context-loading cost is paid for a step that does not apply.

---

## Memory Bank Integration

**Reads from:** `memory-bank/tasks/<slug>.md` (the specific phase flagged as needing
design), the approved spec it satisfies, `memory-bank/agent-rules-index.md` (run
`${CLAUDE_PLUGIN_ROOT}/commands/rules-index.md` first if missing or stale) for any
existing architectural conventions the design must respect.
**Updates:** `memory-bank/creative/<slug>-<type>.md`.
**References:** `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`.
**Backend:** seam `creative` in `${CLAUDE_PLUGIN_ROOT}/context/agent-backends.md` — check
`memory-bank/projectConfig.md` before assuming Anthropic; falls back automatically if
`codex` is configured but unreachable.

---

## Step 1: Confirm this phase actually needs it

Re-check the roadmap's flag against the spec's Boundaries section. If the "open
decision" is actually already resolved by an explicit boundary rule, skip and say so —
do not manufacture a design exploration for a decision the spec already made.

## Step 2: Explore

Produce the design document for the relevant type (architecture / UI-UX / algorithm /
user-journey — pick the one the flagged decision actually is). Full reasoning, not just
a conclusion: alternatives considered, why the chosen one, what it costs.

## Step 3: Save and gate

Save to `memory-bank/creative/<slug>-<type>.md`. Human approves before the flagged
build phase can start. Update the roadmap entry to reference this document.
