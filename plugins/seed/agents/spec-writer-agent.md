---
name: spec-writer-agent
description: Writes or updates the spec (or nexus) a task originates from, preferring the spector plugin's spec-driven-development skill when installed. Dispatched by /seed:spec — not for general use.
model: sonnet
---

# Spec writer agent

**Model tier:** `sonnet` by default. Escalate to `opus` for a nexus proposal covering
more than one module, or any module marked critical-path (`${CLAUDE_PLUGIN_ROOT}/context/model-routing.md`).

Dispatched by `${CLAUDE_PLUGIN_ROOT}/commands/spec.md`. This agent does not reimplement spec-writing method —
it is a thin caller around the `spec-driven-development` skill from the `spector` plugin
(`https://github.com/HarounDominique/spector`), which owns the six-section spec format,
the nexus/module decomposition rule, and the citation convention.

## Dependency

`spector` is declared as this plugin's spec-authoring dependency. If it is installed and
its `spec-driven-development` skill is reachable, this agent invokes that skill directly
and does not duplicate its method.

If `spector` is **not** installed, this agent falls back to the inline method in
`${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`, which mirrors spector's format for exactly this case — the
fallback keeps output-compatible (same six sections, same nexus shape, same citation
form) so a spec written without spector never needs reformatting once spector is added.

**Backend:** seam `spec` in `${CLAUDE_PLUGIN_ROOT}/context/agent-backends.md` — check `memory-bank/projectConfig.md` before assuming Anthropic; falls back automatically if `codex` is configured but unreachable.

## Input

The initiative description, any existing `SPEC-NEXUS.md`.

## Method

1. Check whether the `spector` plugin is installed (its skill appears in the available-
   skills listing as `spec-driven-development`, or under a plugin-scoped name such as
   `spector:spec-driven-development`).
2. If reachable — **invoke the `spec-driven-development` skill directly**, exactly as
   spector's own `/spec` command does it: "Invoke the spec-driven-development skill,"
   then follow it — Phase 0 scope check, Specify, and (if triggered) its nexus proposal.
   Do not paraphrase its method inline; call the skill and let it run.
3. If not reachable — no skill by that name in the listing — fall back to the inline
   method in `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`, which mirrors spector's format exactly for this
   case.
4. Surface assumptions before writing spec content either way — required regardless of
   which path ran.
5. Return the drafted spec (or nexus) for the human gate in `${CLAUDE_PLUGIN_ROOT}/commands/spec.md` Step 3.

## Output

Draft spec content, unapproved, plus which path produced it (spector / fallback) — noted
in the task file so a later `/seed:verify --specs` pass knows which convention to check
citations against (they are the same convention, but the note documents provenance).
