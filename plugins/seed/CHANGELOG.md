# Changelog

Format: one entry per notable change, newest first. Schema-affecting changes also get a
row in `context/schema-migrations.md`.

## 1.1.0

**MIT.** The plugin was published as `UNLICENSED` — "all rights reserved, not licensed for
redistribution" — while sitting in a public repository that invited people to take it, and
vendored inside Assay, which is MIT. A component under a stricter licence than the
repository carrying it is a contradiction someone eventually has to resolve, and it is
cheaper to resolve before anyone has relied on it.

`LICENSE` now states MIT, `plugin.json` declares it, and the README says what it actually
permits. Minor rather than patch: what you are allowed to do with this changed, which is
not a bug fix.

## 1.0.3

**The plugin no longer needs a shell.** Its three scripts were bash, which meant the guard,
the hot cache and the session log all worked on macOS and Linux and quietly did not on
Windows, where `bash` is only present if Git for Windows put it on PATH. A guard that runs
on two platforms out of three is not a guard; it is a convention some people happen to be
held to.

All three are now Node. That removes a dependency rather than adding one: Claude Code runs
on Node, so Node is present wherever this plugin can be installed, and `bash` never was.

- `commit-guard.mjs` — same six verdicts as the shell version, verified case by case:
  production without a test blocks, a pure deletion does not, a rename counts as the file
  that now exists, a missing test-run record blocks rather than passing, a red run quotes
  its exit code, and running outside a repository reports that instead of a git usage dump.
  Its decision is an exported pure function, so it can be tested without a commit.
- `init-state-db.mjs` — tries `node:sqlite` first, then the `sqlite3` CLI, then
  `python3`/`python`. The standard-library path is what makes a fresh Windows machine work
  with nothing installed.
- `session-end-log.mjs` — writes only into an already-initialized project, and still fails
  silently: a hook must never break the session it is attached to.

`chmod +x` is gone from `/seed:init` and `/seed:doctor`. The scripts are invoked through
`node`, so no executable bit is involved — which is also why they behave identically on a
platform that has no such bit.

## 1.0.2

**No command checked that `memory-bank/` existed.** All fourteen read or write under it,
and none of them looked. `/seed:spec` wrote a spec into a tree that was not there, and the
human had to be the one who knew that `/seed:init` comes first — a workflow whose first
phase depends on the operator remembering its own setup step has moved its precondition
into their head.

`/seed:init` was also referenced from nowhere in the flow. `/seed:go` claims to infer the
next action from repository state, and an uninitialized repository is a state whose next
action is `/seed:init`; it had no idea.

The precondition is now stated once, in `context/preconditions.md`, and referenced from
every command whose Memory Bank Integration names a path under `memory-bank/`. `/seed:go`
gains a Step 0 that routes to `/seed:init`, and `/seed:spec` — the first phase, where an
uninitialized project is most likely to arrive — initializes and says so rather than
asking. Asking would be treating a requirement as a decision: someone who asked for a spec
has already said they want the workflow.

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
