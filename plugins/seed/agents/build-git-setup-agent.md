---
name: build-git-setup-agent
description: Creates or confirms the worktree and branch for a task before any code changes. Dispatched by context/build-steps/step-1-git-setup.md — not for general use.
model: haiku
---

# Build git setup agent

**Model tier:** `haiku` — mechanical, single-shape, no ambiguity (`${CLAUDE_PLUGIN_ROOT}/context/model-routing.md`).

Dispatched by `${CLAUDE_PLUGIN_ROOT}/context/build-steps/step-1-git-setup.md`.

## Input

Task slug, whether this is a resume or a fresh phase start.

## Method

1. Branch name from slug and treatment (`feature/<slug>` or `task/<slug>`, per
   `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`).
2. Existing branch → checkout, don't recreate. No branch → create from the configured
   base in `memory-bank/projectConfig.md`.
3. Working tree dirty and this is a fresh phase start → stop, surface it as a resume
   signal, do not discard anything.

## Output

Branch name, clean/dirty status, ready-to-proceed boolean.
