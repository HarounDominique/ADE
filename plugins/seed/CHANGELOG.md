# Changelog

Format: one entry per notable change, newest first. Schema-affecting changes also get a
row in `context/schema-migrations.md`.

## 1.0.1

Correctness pass over 1.0.0 — no schema change, so no `context/schema-migrations.md` row.

**Commit guard (`scripts/commit-guard.sh`).** Its test-green check was inert: it read
`SEED_LAST_TEST_EXIT_CODE`, which nothing set, and could not have worked anyway since an
environment variable set by one Bash call does not survive into the next. It now reads
`memory-bank/.local/last-test-exit-code`, written by build step 3, and treats a missing
file as a failure rather than an assumed green. Also: pure deletions no longer fail the
guard (a cleanup commit is not an untested change), and running outside a git repository
now reports that precondition instead of dying on `git diff --cached` with a usage dump.

**Task-file execution state.** `/seed:plan` hand-wrote a shortened `## Execution State`
that omitted `Current Step`, `Step Attempts` and `Last Block Rule` — the fields build
steps 2/3/4 and the whole tier-escalation mechanism depend on. It now copies
`templates/task-template.md` verbatim. Separately, `Current Phase` was declared by the
template but written by nothing; build step 1 now sets it from the first unchecked
roadmap box.

**Spec approval.** Single-spec (non-nexus) projects could not reach `/seed:plan`:
`/seed:spec` only ever wrote `draft`, and only `/seed:spec-sync` — which exits early
without a nexus — wrote `ready`. `/seed:spec` now writes `approved` on approval, and the
distinction between `approved` and nexus-only `ready` is stated where it is used.

**Hot-cache schema.** `init-state-db.sh` wrote `CHECK` constraints with double-quoted
string literals, which SQLite only accepts via its legacy double-quoted-string fallback.
Now single-quoted.

**Executable bit.** `/seed:init` now runs an explicit `chmod +x` on the copied guard
rather than trusting `cp` to preserve the mode, and `/seed:doctor` check 5 repairs a
missing bit instead of only reporting it.

**Documentation corrected to match behavior.** `/seed:doctor` check 5 and build step 6
now name `scripts/commit-guard.sh` (the project's copy) instead of pointing at a
methodology file that named no script. `context/tdd-and-commit-guard.md` no longer claims
the guard verifies test-before-implementation ordering — a script reading a staged diff
cannot see that; the claim is replaced with where ordering is actually enforced.
`rules-index` cites the four-level rule priority scale directly rather than
`model-routing.md`, which has no such scale. `/seed:build` and `/seed:creative` now
document the `agent-rules-index.md` dependency that `rules-index` already claimed they
had. `context/memory-bank-schema.md` gained the four files it omitted
(`agent-rules-index.md`, `.local/session-logs/`, `.local/backend-drift.log`,
`.local/last-test-exit-code`) and corrects `phase_state`, which stores
`NOT_STARTED`/`RUNNING`/`DONE`, not a RED/GREEN test result. `model-routing.md`'s agent
table now uses the real agent filenames.

**Removed.** `templates/spec-module-template.md` and `templates/spec-nexus-template.md`,
both referenced by nothing — the spec shape `/seed:spec` actually follows lives in
`context/spec-first.md`, and a second unreferenced copy could only drift. The module
template also carried Spanish frontmatter keys (`titulo`, `estado`, `depende_de`) that
matched no field name any command read.

**Packaging.** Added `README.md` and `.claude-plugin/marketplace.json`. `plugin.json`
gained `author`, `keywords`, and explicit `agents`/`hooks` paths (previously relying on
default discovery while declaring `commands`).

## 1.0.0

Initial complete build. Spec-grounded workflow (`spec` → `plan` → `creative`? → `build`
→ `reflect` → `archive`), nexus support for multi-module initiatives with real
dependency tracking, adaptive complexity routing, just-in-time phase loading for
`build`, a deterministic filename-based TDD commit guard, per-seam model routing with
automatic tier escalation, per-seam Anthropic/Codex backend routing with automatic
fallback, `agent-rules` with safety validation and context-load monitoring
(`rules-index`), a `SessionEnd` hook feeding evidence to `reflect`, schema migration
(`upgrade`), and a `doctor` health check (memory-bank shape, hot-cache consistency,
spec-corpus integrity, branch/task-file consistency including Execution State vocabulary
validation, commit-guard reachability, backend configured-vs-used drift).
