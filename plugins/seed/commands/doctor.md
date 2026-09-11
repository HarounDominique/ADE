---
description: On-demand health check of memory-bank shape, hot-cache consistency, and spec corpus integrity
---

# /seed:doctor — health check

On-demand git/config diagnostic. Doubles as a pre-flight before any structural migration
of `memory-bank/`.

---

## Checks

1. **Memory bank shape** — every directory in `${CLAUDE_PLUGIN_ROOT}/context/memory-bank-schema.md`'s cold-truth
   tree exists or is legitimately absent (e.g. no `creative/` yet if no task has used it).
2. **Hot cache consistency** — `.local/state.db`, if present, agrees with a fresh read of
   the cold layer for a sample of tasks; if not, rebuild it and report that it was stale.
   To query it, try `sqlite3` first, then a Python interpreter's stdlib `sqlite3` module —
   try both `python3` and `python`, since one of the two often exists even when the other
   is a broken Windows Store shim (`--version` succeeding is what tells them apart, not
   mere presence on `PATH`). Only report this check as genuinely unverifiable if neither
   `sqlite3` nor a working Python interpreter is found at all.
3. **Spec corpus shape** — if `SPEC-NEXUS.md` exists, every module row has a matching
   `SPEC-<id>.md` file and vice versa; no orphaned module spec, no nexus row pointing at
   nothing.
4. **In-flight branch / task-file consistency** — every `feature/*`/`task/*` branch has a
   task file; every task file claiming `RUNNING` has a matching branch. **Check each
   branch's own tree** (`git show <branch>:memory-bank/tasks/<slug>.md`), never only the
   current branch's working directory — a task's file lives wherever it was last
   committed, same trap `${CLAUDE_PLUGIN_ROOT}/commands/go.md`'s discovery step exists to
   avoid; a plain file listing from the current branch will report a real task file as
   missing just because you haven't checked out the branch that holds it.

   **Also validate `Build Status` and `Can Resume` are canonical values**, not just
   present. `Build Status` must be exactly one of `NOT_STARTED`, `RUNNING`, `DONE` — a
   value like `COMPLETE` or `FINISHED` is a real defect even though it "looks done", since
   every other command's dispatch logic (`${CLAUDE_PLUGIN_ROOT}/commands/build.md` Step
   1, `${CLAUDE_PLUGIN_ROOT}/commands/archive.md`, `/seed:go`) pattern-matches on the
   literal string `DONE` and silently fails to recognize a task as finished otherwise.
   `Can Resume` must be exactly `YES` or `NO`. Flag any task file with a non-canonical
   value, quoting the exact string found and the file.
5. **Commit-guard reachable** — `scripts/commit-guard.sh` (the project's own copy, at
   the project root, per `${CLAUDE_PLUGIN_ROOT}/context/tdd-and-commit-guard.md`) exists
   and is executable. If it exists but lacks the executable bit (`cp` doesn't always
   preserve it, and a plain file write never sets it), do not just report the fail — fix
   it (`chmod +x scripts/commit-guard.sh`) and note that you did, since this is a
   one-line, unambiguous repair, not a judgment call.
6. **Backend configured-vs-used drift** — if `memory-bank/.local/backend-drift.log`
   exists, for each seam in `memory-bank/projectConfig.md`'s `## Agent Backends` block
   still configured as `codex[:model]`, check whether the log's most recent entry for
   that seam recorded a fallback to `anthropic`. If so, flag it: the seam is still
   configured for a backend that wasn't actually reachable last time — recommend either
   fixing Codex reachability or editing `projectConfig.md` back to `anthropic` for that
   seam. No log file, or no seam currently configured `codex` → PASS trivially (nothing
   to drift against). See `${CLAUDE_PLUGIN_ROOT}/context/agent-backends.md`.

Report each check as pass/fail with the specific file or branch at fault — never a bare
"something is wrong".
