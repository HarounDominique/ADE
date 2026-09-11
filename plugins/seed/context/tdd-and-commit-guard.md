# TDD enforcement and the commit guard

Tests are written before implementation, and the check that this happened is a script, not
a model's opinion.

## Sequence inside a build phase

1. Write the failing test first. Confirm it fails for the expected reason (RED) — a test
   that fails because of a typo in the test itself is not a valid RED.
2. Implement the minimum needed to pass it (GREEN), in the same warm context as step 1.
3. Run the affected batch of tests, fix red ones in this same context before moving on.
4. Code review gate — quality and pattern compliance, before any commit.
5. Commit.

## The guard

Before a commit lands, a deterministic script — `scripts/commit-guard.mjs` in the
project (copied there by `/seed:init` from `${CLAUDE_PLUGIN_ROOT}/scripts/commit-guard.mjs`,
never run from the plugin directly) — not a sub-agent, not a judgment call — checks:

- Every production file added or modified in the staged diff has a test file in that same
  diff. A production file that is only *deleted* needs nothing added — a cleanup commit is
  not an untested change.
- The test suite was actually run (not merely claimed) and exited `0`, read from
  `memory-bank/.local/last-test-exit-code` — a file, because an environment variable set
  by one Bash call does not survive into the next. A missing file is a FAIL, never an
  assumed green.

What the guard deliberately does **not** check: the *order* in which test and
implementation were written. A script reading a staged diff cannot see that, and pretending
otherwise would put a claim in this document that nothing enforces. Test-first ordering is
enforced upstream instead, by `context/build-steps/step-2-tdd.md` requiring a verified RED
before any implementation — the guard's job is to catch the commit where the test is
missing outright.

If the guard fails, the commit does not happen. The build phase re-enters at step 1 or 2,
not at "explain why it's fine to skip".

## Why a script, not a model

A model — even one dedicated to reviewing this exact gate — will rationalize a bypass
under time pressure or an unusual case ("this one file is config, not logic"). A boolean
gate that a script evaluates from the actual file list and actual test exit code has no
such failure mode. Judgment calls about *what counts as production code* are made once,
in the guard's configuration, not re-litigated per commit.
