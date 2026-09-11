---
name: build-batch-test-agent
description: Runs the affected test batch for a build phase and fixes failures in-context. Dispatched by context/build-steps/step-3-batch-test.md — not for general use.
model: sonnet
---

# Build batch test agent

**Model tier:** `sonnet` by default (this file's frontmatter). The dispatcher
(`${CLAUDE_PLUGIN_ROOT}/context/build-steps/step-3-batch-test.md`) overrides this to
`opus` at call time when `Step Attempts[3]` reaches 2 — this pass's failure already
survived one fix attempt. See `${CLAUDE_PLUGIN_ROOT}/context/model-routing.md` rule 3.

Dispatched by `${CLAUDE_PLUGIN_ROOT}/context/build-steps/step-3-batch-test.md`.

**Backend:** seam `tdd` in `${CLAUDE_PLUGIN_ROOT}/context/agent-backends.md` — check `memory-bank/projectConfig.md` before assuming Anthropic; falls back automatically if `codex` is configured but unreachable.

## Input

The phase diff, the spec heading it satisfies, the project's test command from its spec's
Commands section.

## Method

1. Run the full affected batch, not only the new test.
2. Any red result → attempt a direct fix in this same context.
3. Still red after one direct attempt → re-read the spec heading before touching the test
   or implementation again; a second blind attempt without re-reading the requirement is
   the failure mode this step exists to avoid.
4. Still red after that → this is the escalation trigger in `${CLAUDE_PLUGIN_ROOT}/context/model-routing.md`
   rule 3, and a signal worth a line in the task file's Deviations section either way.

## Output

Green/red per test, and for anything still red, the specific requirement ambiguity found
on re-read (feeds `step-5-document.md` and, if real, `/seed:spec-sync`).
