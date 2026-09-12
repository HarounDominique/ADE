# Archive: offer-git-init-when-no-vcs

## Summary

Added an "Initialize Git repository" option to the topbar branch dropdown, shown
whenever the active Project has no Git (`activeVersionControl === 'none'`), replacing
the previous fully-disabled button. Confirmed via the existing "GIT OPERATION" dialog,
it runs `git init` at the Project's root and then refreshes the whole topbar/
version-control UI to its git-aware state automatically.

Satisfies: `memory-bank/specs/SPEC-offer-git-init-when-no-vcs.md` (Objective, Structure,
Style, Test strategy, Boundaries — all sections).

## What was built

- **Sidecar** (`src/application/git/git-mutations.ts`): `initializeRepository`, mirroring
  the shape of every sibling Git mutation (`assertConfirmed` + `executeGit(["init"])`).
  Dispatched via `"git.init"` in `src/desktop-sidecar.ts`'s existing confirmed-mutation
  array.
- **Frontend** (`desktop/src/main.js`): the branch button's `branchable` condition drops
  its `hasGit` requirement; its dropdown renders an "Initialize Git repository" button
  instead of the branch list when there is no VCS; `initGitRepositoryFromUI()` confirms
  via the standard dialog, then dispatches `git.init` through `sendContextRequest` so the
  UI refresh runs on the sidecar's real `sidecar:response` completion event, not on send.
- **Stored state correctness** (`src/persistence/sqlite-store.ts`,
  `src/application/tasks/project-commands.ts`): a registered Project's `versionControl`/
  `branch` columns, persisted once at registration and never re-read, are now refreshed
  (`AdeStore.updateProjectRepository` + `refreshProjectRepositoryState`) right after
  `git.init` succeeds, so no later cached read can reintroduce the stale `"none"`.
- **Read-path robustness** (`src/application/git/version-control.ts`): the pending-diff
  and commit-history read paths (`git diff HEAD`, `git log`) now handle a repository with
  zero commits — the exact state `git init` produces — instead of failing on an
  ambiguous/missing `HEAD`.

## Deviations accepted

Five manual-verification rounds surfaced five distinct gaps, all in the read side of the
system rather than the write side; full root-cause detail for each lives in
`memory-bank/tasks/offer-git-init-when-no-vcs.md`'s `## Deviations`:

1. The dynamically-rendered button was wired through the static `[data-action]`
   dispatcher instead of the delegated one every other dynamic menu item uses — fixed by
   delegation, extracted into `initGitRepositoryFromUI()`.
2. `sidecar_request` (Rust) is fire-and-forget; the spec's own Style snippet chained the
   UI refresh directly off it, racing ahead of the real `git init` completion — fixed by
   routing through `sendContextRequest`'s `pendingContextRequests`/`sidecar:response`
   correlation, the same mechanism every other Git mutation already relies on.
3. `git diff HEAD` fails on a zero-commit repository — fixed with a live `HEAD`-exists
   check falling back to Git's empty-tree hash.
4. `git log` fails the same way, same fix shape (check `HEAD` first, return empty).
5. A registered Project's Git state is cached in SQLite at registration time and never
   refreshed — `git.init` updated the filesystem but not the cache, so switching
   Projects away and back re-surfaced the stale `"none"` — fixed by refreshing the
   stored row as part of the `git.init` mutation itself.

All five were root-caused, fixed, covered by a new automated test, and confirmed by the
operator in `npm run desktop:dev` before this archive.

## Reflection

See `memory-bank/reflection/offer-git-init-when-no-vcs.md` for the full analysis. Headline
finding: every deviation traces to the spec treating "mirrors an existing pattern" as
sufficient verification, when this task's entire purpose was to produce a state (a
zero-commit Git repository) that no existing pattern in this codebase had ever been
proven against. Three rules extracted to `agent-rules/_learned/`: `spec-writing.md`
(mirror-pattern-verification), `testing-side-effecting-code.md`
(kill-spawned-children-in-finally), and the new `stale-cached-state.md`
(mutation-must-refresh-what-it-invalidates).
