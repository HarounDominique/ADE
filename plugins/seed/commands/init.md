---
description: Initialize memory-bank/ in this project, including the hot-cache schema and commit guard
---

# /seed:init — initialize the memory bank in a project

---

## Memory Bank Integration

**Reads from:** nothing (first run in a project).
**Updates:** creates `memory-bank/` per `${CLAUDE_PLUGIN_ROOT}/context/memory-bank-schema.md`.
**References:** `${CLAUDE_PLUGIN_ROOT}/templates/*.md`.

---

## Step 1: Detect project state

New project (no source yet) vs. existing codebase — check for real, don't assume
greenfield just because this is the first `/seed:init` run.

**Git facts — read them, never guess:**
- Default branch: `git symbolic-ref refs/remotes/origin/HEAD` if a remote exists,
  otherwise the current branch `git branch --show-current` run right now.
- Existing branch naming convention: `git branch -a`, note if branches already follow a
  pattern (`feature/*`, `release/*`, ticket-id prefixes) worth respecting instead of
  silently imposing `feature/<slug>`/`task/<slug>`.

**Existing codebase — if any tracked source files exist beyond this run's own commits:**
- Detect the dominant language(s) from file extensions actually present (not from a
  README claim) — this sets `commit-guard.mjs`'s `PRODUCTION_EXTS` default relevance and
  the test-naming convention already in use (`test_*.py` vs `*.test.js` vs `*_test.go`),
  which may differ from `scripts/commit-guard.mjs`'s stock `TEST_NAME_PATTERNS`.
- Note the actual source/test directory layout (`src/`+`tests/`, flat root, `lib/`,
  monorepo packages) — this is what later specs' Structure sections should follow, not
  invent a new convention.
- Write these findings into `projectConfig.md` under a `## Detected Stack` section (see
  Step 2) — a greenfield project gets `[none — no source yet]` there instead, explicitly,
  not a silently blank section indistinguishable from "wasn't checked".

## Step 2: Create the cold-truth tree

```
memory-bank/
├── specs/
├── tasks/
├── roadmap/
├── creative/
├── reflection/
├── archive/
└── agent-rules/_learned/
```

Copy `${CLAUDE_PLUGIN_ROOT}/templates/projectConfig-template.md` to `memory-bank/projectConfig.md`, filled in with Step 1's actual git facts and, under `## Detected Stack`, what Step 1 found (or `[none — no source yet]` for a genuine greenfield project) — never the template's bracketed placeholders left untouched for a fact Step 1 was able to determine.

## Step 3: Gitignore the hot cache and common build noise, then create the DB

Append `${CLAUDE_PLUGIN_ROOT}/templates/project.gitignore` to the project's root
`.gitignore` (create one if absent; if one already exists, append only the lines it's
missing rather than duplicating). Covers `memory-bank/.local/` (never committed, per
`${CLAUDE_PLUGIN_ROOT}/context/memory-bank-schema.md`) plus common Python/Node/editor
noise (`__pycache__/`, `node_modules/`, etc.) so the first build phase doesn't leave
cache junk untracked-but-unignored. Not exhaustive for every stack — a project's own
`.gitignore` additions after this are normal and expected.
Run the script — do not create the database yourself, and do not rename it:

```
node <plugin path>/scripts/init-state-db.mjs
```

It writes `memory-bank/.local/state.db` with `spec_index`, `phase_state`, `citations` and
`learned_rules`. **That exact filename is the contract**, not a detail: every later reader
opens `.local/state.db`, and `/seed:doctor` check 2 reports a cache it cannot find at that
path as missing. A database of the right shape under a name of your own choosing is the
same as no cache at all.

**`${CLAUDE_PLUGIN_ROOT}` is
not a real shell environment variable** — it is a placeholder for this plugin's actual
loaded path, which you already know (it's the directory this very file was read from).
Substitute the real absolute path when constructing the Bash command; passing the literal
string `${CLAUDE_PLUGIN_ROOT}` to Bash fails with "No such file or directory" since the
shell has nothing to expand it to. The script uses `node:sqlite` when the Node running it has it (22.5+), and otherwise
falls back to the `sqlite3` CLI and then to `python3`/`python` — report a hot-cache creation
failure as a missing prerequisite (neither sqlite3 nor a working Python found) rather
than skipping silently; `/seed:doctor` check 2 depends on this file existing.

## Step 4: Copy the commit guard into the project

The guard runs against *this* project's diffs, so it lives in the project, not just the
plugin. Copy `${CLAUDE_PLUGIN_ROOT}/scripts/commit-guard.mjs` to `scripts/commit-guard.mjs`
in the project (create `scripts/` if absent). It is run as `node scripts/commit-guard.mjs`,
so no executable bit is needed and none should be set — that is also what makes the guard
behave the same on Windows, where the bit does not exist. Its defaults detect
production-vs-test by filename (extension + `test_*`/`*_test.*`/`*.test.*`/`*.spec.*`
naming), which works unmodified for both a flat-root layout and a `src/`+`tests/` one —
only override `PRODUCTION_EXTS` / `TEST_NAME_PATTERNS` if this project's naming genuinely
doesn't fit either. For an **existing** codebase whose actual test-naming convention
(from Step 1) uses a pattern the stock `TEST_NAME_PATTERNS` doesn't already cover — e.g.
`*_spec.rb`, `Test*.java` — edit the copied script's default now, once, rather than
leaving it to silently misfire on the project's own real files later. If a
`scripts/commit-guard.mjs` already exists (re-running init), leave it untouched — it may
already carry project-specific overrides.

## Step 5: Commit the scaffolding

Everything Steps 2-4 created (`memory-bank/` tree, `projectConfig.md`, `.gitignore`,
`scripts/commit-guard.mjs`) is the cold-truth baseline every later phase branches from —
it must exist in git before any `feature/<slug>` branch is cut, or the baseline itself is
unrecoverable state living only on disk. On the current branch (this runs before any task
branch exists — normally the repo's default branch):

1. `git add memory-bank/ .gitignore scripts/commit-guard.mjs` (and any other file Steps
   2-4 touched).
2. Commit: `Initialize SEED memory bank`.
3. If this is not a git repository yet, report that as a precondition — do not commit,
   and do not silently proceed as if the scaffolding were tracked.

## Step 6: Report

`Memory bank initialized and committed. Next: /seed:spec <what you want to build>.`
