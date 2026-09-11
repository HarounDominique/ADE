# Adaptive complexity routing

No command asks "what level is this, 1 to 4". A fixed level either overshoots a small
change (full nexus, full creative pass, mandatory multi-phase gates for a one-file fix)
or undershoots a large one (a single flat spec for something that is really five modules).
Instead, every entry point classifies the request from observable signals before choosing
how much of the workflow to run.

## Signals

Gather these before routing, cheaply, without spawning an agent:

- **Estimated file/module surface** — how many files or modules does the request plausibly touch.
- **Capability bundling** — does the request name more than one independently testable
  capability, or more than one distinct screen/view/menu (see `spec-nexus` in
  `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`). If yes, a nexus spec is mandatory regardless of anything else below.
- **Requirement clarity** — is there an unambiguous, self-contained requirement, or does
  answering it require a design decision.
- **Existing pattern match** — does the codebase already do something structurally
  identical (same shape of CRUD, same kind of integration) that this can follow.

## Routing table

| Signal read | Treatment | Phases run |
|---|---|---|
| 1 file, mechanical, unambiguous | fast-path | spec (one paragraph) → build → archive |
| 2-5 files, clear requirement, known pattern | standard | spec → plan → build → reflect → archive |
| Open design decision, or new component boundary | designed | spec → plan → creative → build (×N phases) → reflect → archive |
| Bundled capabilities / multiple modules | nexus | spec-nexus → per-module spec → plan → creative? → build (×N per module) → reflect → archive |

`nexus` is not a fifth tier above `designed` — it is orthogonal. A nexus project still
routes each module through fast-path/standard/designed independently, per module, once
the nexus itself is approved.

## The one hard rule

Spec is never skipped, only shrunk. See `${CLAUDE_PLUGIN_ROOT}/context/spec-first.md`. Every other phase can be
absent from a given task's execution state; spec cannot.

## Self-correction

If the same shape of task gets mis-routed twice in a row (fast-path task that turns out
to need a design decision, or vice versa), that is a `/seed:reflect` finding, not a
one-off override — the routing signals themselves are wrong for that pattern of work and
should gain a rule in `agent-rules/_learned/`, not be judged case by case forever.
