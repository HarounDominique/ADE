---
name: seed-rules-index
description: Validate and index repository agent rules before workflow phases that depend on them.
---

# SEED rules index

Inspect `memory-bank/agent-rules/` for unsafe, contradictory or excessive
context. Validate rule scope and precedence, then regenerate the repository's
rules index when a rule changed. Report warnings and failures explicitly; do
not rewrite a rule's meaning without human approval.

Run this before planning, design or build when the rules index is stale.
