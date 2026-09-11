# Agent backends — per-seam routing with automatic fallback

Each seam below can run on `anthropic[:tier]` (a Claude sub-agent; tier overrides
`${CLAUDE_PLUGIN_ROOT}/context/model-routing.md`'s default) or `codex[:model]`
(delegate to the OpenAI Codex plugin, `codex@openai-codex`, if installed). Configured in
`memory-bank/projectConfig.md`'s `## Agent Backends` block:

```markdown
## Agent Backends

- spec: anthropic
- tdd: codex:gpt-5.1-codex
- code-review: anthropic
- creative: anthropic
```

Default when the block is absent or a seam is unlisted: `anthropic`, at
`context/model-routing.md`'s normal tier for that seam.

## Seams

| Seam | Which command/agent | Mandatory output? |
|---|---|---|
| `spec` | `agents/spec-writer-agent.md` | yes |
| `tdd` | `agents/build-tdd-agent.md`, `agents/build-batch-test-agent.md` | yes |
| `code-review` | `agents/build-code-reviewer-agent.md` | yes |
| `creative` | `commands/creative.md` | yes |

There is no advisory-only seam in SEED today (unlike BMB's `creative-critique`) — every
seam here produces output the workflow depends on, so every seam's fallback rule is the
same: **never fail the task over backend unavailability.**

## Detection, per dispatch

1. Read this seam's line from `memory-bank/projectConfig.md`. Absent block or absent
   line → `anthropic`, skip to Step 3.
2. Line says `codex[:model]` → check the Codex plugin is actually reachable
   (`codex@openai-codex` present and its companion runtime answers) — do not assume
   presence in `projectConfig.md` means it is currently usable.
   - Reachable → dispatch to Codex, passing the same task/spec/phase context this seam
     would otherwise hand a Claude sub-agent.
   - Not reachable → fall back to `anthropic` at this seam's normal tier, and **say so**
     in the command's output (a silent fallback hides a config drift the human would
     want to know about, even though it must not block the task). Also append one line
     to `memory-bank/.local/backend-drift.log` (create the file if absent — hot cache,
     gitignored, never a truth source): `<ISO date>\t<seam>\t<configured>\t<actual>\t<reason>`,
     e.g. `2026-09-11T10:00:00Z\ttdd\tcodex:gpt-5.1-codex\tanthropic\tcodex CLI not found`.
     This is what `/seed:doctor` check 6 reads — a fallback that never wrote this line
     is invisible to doctor, so this step is not optional.
3. Dispatch (Codex or Anthropic, whichever Step 1-2 resolved) and continue the command
   normally — the rest of the workflow (commit-guard, spec-sync, reflect) does not care
   which backend produced the diff or the spec text.

## Why silent-fail-to-Anthropic and not a hard error

A `codex`-configured seam that can't reach Codex right now (not installed, auth expired,
transient) must not turn into "the build is blocked" — that would make an optional
cost/quality optimization into a single point of failure for the whole workflow. Report
the fallback plainly; never let it silently change what the human thinks is running
without at least one line of output saying so.

## `/seed:doctor` check

`commands/doctor.md` check 6 reads `memory-bank/.local/backend-drift.log` and reports,
per seam, whether `projectConfig.md` still configures a backend that recent dispatches
had to fall back away from — a signal the human should either fix (install/auth Codex)
or accept (edit `projectConfig.md` back to `anthropic` for that seam) rather than a
standing silent mismatch between what's configured and what's actually running.
