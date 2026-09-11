---
description: Ad-hoc verification — lint/test/build, or --specs for a full spec corpus hygiene pass
argument-hint: [--specs]
---

# /seed:verify — ad-hoc verification

**Precondition:** `memory-bank/` must exist — see `${CLAUDE_PLUGIN_ROOT}/context/preconditions.md`. Absent, run `/seed:init` first, say that you did, then continue.

Runs independently of the phase lifecycle, at any point.

---

## Usage

- `/seed:verify` — lint, full test suite, build, on the current tree.
- `/seed:verify --specs` — runs the spec corpus hygiene pass, `${CLAUDE_PLUGIN_ROOT}/context/spec-hygiene.md`,
  in full (Phase 0 through Phase 4). Use before treating any spec's claims about current
  implementation state as authoritative for a new decision, or periodically on a
  long-lived corpus.

---

## Step 1: Mechanical checks

Lint, test suite, build — report pass/fail per check, do not editorialize a red result.

## Step 2: `--specs` only

Dispatch `${CLAUDE_PLUGIN_ROOT}/agents/spec-hygiene-agent.md`, which runs `${CLAUDE_PLUGIN_ROOT}/context/spec-hygiene.md` end to end
at the model tiers `${CLAUDE_PLUGIN_ROOT}/context/model-routing.md` assigns per phase. Report the stopping
metric: per defect class, how many closed, how many introduced this pass.
