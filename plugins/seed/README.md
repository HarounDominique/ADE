# SEED

A spec-grounded agentic build workflow for Claude Code. Every task traces back to a spec
document, every commit passes a deterministic TDD gate, and every closed task leaves a
reusable rule behind.

Three ideas do the work:

- **Spec-first, always.** `/seed:plan` refuses to run without an approved spec. A spec is
  never skipped, only shrunk — a one-line fix still gets a two-paragraph spec.
- **Just-in-time phase loading.** `/seed:build` reads *one* step file per invocation, not
  the whole six-step procedure. Context per turn is bounded by one step regardless of how
  large the workflow grows.
- **A two-speed memory bank.** Markdown + git is the only truth. A local SQLite cache
  under `memory-bank/.local/` accelerates lookups and is safe to delete at any time.

## Install

```
/plugin marketplace add /path/to/SEED
/plugin install seed@seed
```

Then, in the project you want to work in:

```
/seed:init
```

## Requirements

- `git`
- `sqlite3` **or** any `python3`/`python` with the stdlib `sqlite3` module (the hot-cache
  script prefers the CLI and falls back to Python automatically)
- Optional: the `codex@openai-codex` plugin, if you want to route a seam to Codex. A
  configured-but-unreachable Codex falls back to Claude automatically and says so — it
  never blocks a task.

## The flow

```
/seed:spec → /seed:plan → /seed:creative? → /seed:build → /seed:reflect → /seed:archive
```

`/seed:go` infers which of those comes next from repository state, so you never have to
remember. Not every task runs every phase — `context/complexity-routing.md` classifies the
request first and routes a one-file fix through `spec → build → archive` while a
multi-module initiative gets a nexus spec and per-module phases.

## Commands

| Command | What it does |
|---|---|
| `/seed:go` | Entry point — infers the next action from repo and task-file state |
| `/seed:init` | Initialize `memory-bank/` in a project, plus hot cache and commit guard |
| `/seed:spec` | Write the spec (or nexus + module specs) a task originates from |
| `/seed:plan` | Turn an approved spec into a phased build roadmap |
| `/seed:creative` | Design exploration, only for a phase flagged as needing a decision |
| `/seed:build` | Run one build phase (`--auto` chains the remaining ones) |
| `/seed:reflect` | Extract reusable rules into `agent-rules/_learned/` |
| `/seed:archive` | Validate green, then merge the branch or open the PR |
| `/seed:verify` | Lint/test/build, or `--specs` for a full spec-corpus hygiene pass |
| `/seed:spec-sync` | Propagate a module spec edit to the nexus and every citing spec |
| `/seed:rules-index` | Validate `agent-rules/` for safety and context load, then index it |
| `/seed:roadmap` | Feature and version tracking across many tasks (optional) |
| `/seed:doctor` | Health check — memory-bank shape, cache consistency, corpus integrity |
| `/seed:upgrade` | Migrate a project's `memory-bank/` to the current schema version |

## The commit guard

The one part of this workflow that is a script rather than a judgment call. A model will
rationalize a bypass under pressure; a boolean gate reading the actual staged diff will
not.

`/seed:init` copies `scripts/commit-guard.sh` into your project. Before any build phase
commits, it checks that every production file added or modified in the staged diff has a
test file in that same diff, and that the test suite actually ran and exited `0`.

That second check reads `memory-bank/.local/last-test-exit-code`, written by build step 3.
A **file**, not an environment variable — a var set by one Bash call does not survive into
the next. A missing file is a failure, never an assumed green.

Deleting a production file needs no test: a cleanup commit is not an untested change.

Defaults detect production-vs-test by filename (`test_*`, `*_test.*`, `*.test.*`,
`*.spec.*`), which works unmodified for a flat root and for `src/`+`tests/`. If your
project's convention genuinely differs (`*_spec.rb`, `Test*.java`), edit
`PRODUCTION_EXTS` / `TEST_NAME_PATTERNS` in the copied script once — never loosen it to
get a single commit through.

## Model routing

Every dispatch picks the cheapest tier that can do the job, from a routing table in
`context/model-routing.md` rather than a per-agent hardcode. Mechanical work (git setup,
doc formatting, citation checks) runs on `haiku`; standard build work on `sonnet`.

Escalation is a mechanism, not an intention: the task file's `Step Attempts` counter is
incremented on entry to steps 2, 3 and 4. Reaching `2` dispatches the same agent with an
`opus` override for that one call. Reaching `3` halts the phase for a human decision — a
second `opus`-tier failure at the same step is not a retry budget to raise.

## What lives where

```
commands/            # the 14 slash commands
agents/              # 8 subagents, each dispatched by one step or command
context/             # methodology — the "why", read by commands as needed
  build-steps/       # one file per build step; dispatch targets, never slash commands
scripts/             # commit-guard.sh, init-state-db.sh, session-end-log.sh
templates/           # task file, projectConfig, project .gitignore
hooks/hooks.json     # SessionEnd hook feeding evidence to /seed:reflect
```

Step files live under `context/build-steps/` on purpose — anything under `commands/`
registers as a slash command, and a step file is a dispatch target.

## A note on `${CLAUDE_PLUGIN_ROOT}`

Cross-references in this plugin use `${CLAUDE_PLUGIN_ROOT}` to mean "this plugin's
installed location". For reading a file it resolves transparently. It is **not** an
exported shell variable: when running one of `scripts/*.sh` via Bash, substitute the real
absolute path first. See `context/plugin-paths.md`.

## License

UNLICENSED — all rights reserved. Not licensed for redistribution.
