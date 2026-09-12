# Reflection: offer-git-init-when-no-vcs

## Step 1: Implementation vs. spec

The spec's Objective and Boundaries were satisfied in the end, but only after five
manual-verification rounds instead of one — every one of the extra four rounds traces
back to a gap in the spec itself, not to a build-phase mistake:

1. **The spec's own Style snippet for the frontend dispatcher was the bug.** Section
   "Style" gave a literal code block chaining `.then(() => refreshProjectContext(...))`
   directly off `nativeInvoke('sidecar_request', ...)`. That code was implemented
   exactly as written (Phase 2), and it was wrong: `sidecar_request` (Rust) only writes
   to stdin and returns — it never waits for the correlated response — so the refresh
   ran on send, not on completion. The spec called this "mirroring the existing
   create-branch/push-origin shape," but neither of those call sites actually awaits
   real completion via the raw promise either; they happen to read correctly today only
   because `switchBranchFromContext` and its siblings go through `sendContextRequest`
   and a separate `sidecar:response` event-listener correlation, which the spec's own
   snippet skipped. "Mirrors an existing pattern" was asserted without checking that the
   pattern is actually the async-correct one.
2. **The spec never named the state this feature creates.** Every Project this app had
   ever opened, until this feature shipped, already had at least one commit (cloned or
   pre-existing). "Initialize Git repository" is the first thing in this codebase that
   deliberately produces a *zero-commit* repository and then asks the rest of the app to
   read it. `inspectPendingGitChanges`/`readPendingGitDiff` (`git diff HEAD`) and
   `listGitCommits` (`git log`) both assumed `HEAD` exists — true of every repo state the
   app had ever encountered before, false of the one this feature exists to produce. The
   spec's Boundaries said "refresh project context... never leave the UI in a stale
   state," which is necessary but not sufficient — it does not cover "the newly-true
   state breaks code that assumed the old invariant elsewhere in the app."
3. **A registered Project's Git state is cached, not live.** `src/persistence/
   sqlite-store.ts` persists `version_control` at registration time; nothing re-reads it.
   `git.init` mutated the filesystem correctly but never touched that cached row, so
   `project.snapshot` kept answering `"none"` on every later read, silently overwriting
   the correct live value `switchProjectFromContext` had just set. The spec's Structure
   section described the sidecar dispatch and the frontend dispatcher in isolation but
   never traced what else in the sidecar reads/writes a Project's `versionControl`
   field — the boundary between "this mutation" and "everything that caches its effect"
   was invisible to the spec because it was written per-file, not per-invariant.

Net: the *shape* of the implementation (sidecar mutation mirroring `fetchOrigin`,
frontend dispatcher mirroring `create-branch`) was exactly right and needed no rework.
Every deviation was a spec gap surfacing through manual verification, one at a time,
because manual verification was the only step that actually exercised the new state
end-to-end.

## Step 2: Workflow evaluation

Complexity routing (standard tier, "mirrors an established pattern," no `/seed:creative`)
was reasonable for the *shape* of the change but missed that this specific task's entire
point was to create a state this codebase had never had before. "Mirror the proven
pattern" is a systematically weaker check exactly when the feature's purpose is to reach
a new state no existing pattern was ever exercised against — the existing patterns were
proven for repos that already had commits, which tells you nothing about a repo that
doesn't yet.

The spec-first discipline still worked as intended once corrected: each deviation was
written into `## Deviations` with root cause and fix before moving on, so the task file
is a complete, honest trail of what actually happened rather than a clean story that
skips the four extra rounds. No sharding leak — each fix stayed inside the one file it
belonged in.

One process gap: the integration test written to catch round 5 (stale cached
`versionControl`) initially hung the test runner indefinitely on failure, because the
spawned child process was never killed on the assertion-failure path — no `finally`.
This was caught before it reached a commit, but cost real time diagnosing "is this
hung or just slow" before the missing cleanup was found.

## Step 3: Extracted rules

Three rules written to `agent-rules/_learned/`: one appended to `spec-writing.md`
(mirror-pattern verification), one new topic `stale-cached-state.md` (mutations must
refresh what they invalidate, not just what they directly write), one appended to
`testing-side-effecting-code.md` (spawned-child test cleanup).

Next: `/seed:archive offer-git-init-when-no-vcs`.
