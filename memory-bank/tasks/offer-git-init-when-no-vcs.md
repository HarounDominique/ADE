---
slug: offer-git-init-when-no-vcs
spec: SPEC-offer-git-init-when-no-vcs.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Sidecar: `initializeRepository` in `src/application/git/git-mutations.ts`
  (mirrors `fetchOrigin`'s shape exactly), `"git.init"` added to the existing confirmed-
  mutation method array in `src/desktop-sidecar.ts`. Rust/backend unaffected — this is
  entirely in the Node sidecar, same as every other Git mutation. No creative needed —
  direct mirror of an established pattern.
  (satisfies: SPEC-offer-git-init-when-no-vcs.md#structure, #style, #test-strategy — sidecar half)
  Test strategy: `npm run build` (tsc); `node --import tsx --test tests/git-mutations.test.ts`.

- [x] Phase 2 — Frontend: `renderSnapshot`'s branch-button `branchable`/`title` logic
  drops the `hasGit` requirement; `toggleGitContextMenu` drops its no-git early return
  and renders an "Initialize Git repository" option instead of the branch list in that
  state; new `init-git-repository` dispatcher entry (confirm → `sidecar_request` →
  `refreshProjectContext`). No creative needed — mirrors the existing
  create-branch/push-origin dispatcher shape exactly.
  (satisfies: SPEC-offer-git-init-when-no-vcs.md#objective, #structure, #style — frontend half)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions for the
  changed `branchable` condition, the dropped guard, and the new dispatcher entry, in
  this same phase per the convention every prior task in this session has used.

- [ ] Phase 3 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (open/create a Project with no `.git`, confirm the
  branch button is enabled with only "Initialize Git repository" in its dropdown,
  confirm the dialog, confirm the branch name/commit/push buttons and version-control
  view all update to the git-aware state without a manual reload) before reporting the
  task done. No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-offer-git-init-when-no-vcs.md#test-strategy, #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: RUNNING
**Current Phase**: 3
**Current Step**: 3/6
**Step Attempts**: {2: 1, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- Phase 3 manual verification: the operator clicked "Initialize Git repository" and
  nothing happened. Root cause: the button is created dynamically (via
  `menu.innerHTML = ...` inside `toggleGitContextMenu`), but the spec's Style snippet
  used `data-action="init-git-repository"`, wired by the *static* `[data-action]`
  dispatcher that only ever attaches listeners at page load — dynamically-inserted menu
  content in this codebase is always delegated instead (a separate `document`-level
  listener matching `data-branch-name`, `data-project-id`, etc.), which this task's own
  spec should have followed but didn't check against. Fixed by renaming the attribute to
  `data-init-git-repository` and adding delegation for it alongside the sibling
  `data-branch-name` handling, extracting the logic into `initGitRepositoryFromUI()`.
  Flagged as a learned rule (see reflection) since this exact class of bug — a
  `data-action` on dynamically-created markup — is invisible to every contract test that
  only checks the attribute string exists in `main.js`, not that anything actually reads
  it for that element.

- Phase 3 manual verification, round 2: after the dispatch fix above, the operator
  reported the repository now initializes but the branch dropdown still reads "No Git"
  instead of updating. Root cause: `sidecar_request` (Rust, `desktop/src-tauri/src/
  lib.rs`) only writes the JSON-RPC request to the sidecar's stdin and returns — it does
  not wait for or correlate the actual response. `initGitRepositoryFromUI` chained
  `refreshProjectContext(projectSnapshot)` directly off that promise, so it ran on send,
  not on completion — a race that usually lost, since `git init` had not finished before
  the re-fetched `project_context` was read. Every other Git mutation in this codebase
  (`switch-branch`, `git-commit-local`, `git-push-origin`) already avoids this by going
  through `sendContextRequest`, which registers the request's `id` in
  `pendingContextRequests` and only runs its follow-up once the `sidecar:response` Tauri
  event actually correlates back to it. Fixed by rewriting `initGitRepositoryFromUI` to
  use that same path (`sendContextRequest('git.init', ..., 'init-git-repository')`) and
  adding a `contextPurpose === 'init-git-repository'` branch in the response listener
  that calls `refreshProjectContext` only once `response.result?.operation === 'init'`.
  This is the same bug class as the dispatch fix above, one layer deeper: this task's own
  spec/plan should have checked the existing create-branch/push-origin template closely
  enough to notice it doesn't actually await completion via the raw promise either — see
  reflection for the resulting learned rule.

- Phase 3 manual verification, round 3: after Git init succeeds and the UI refreshes
  correctly, switching Projects in the project selector threw "Command failed:
  /usr/bin/git diff HEAD --binary — fatal: ambiguous argument 'HEAD': unknown revision".
  Root cause: `inspectPendingGitChanges`/`readPendingGitDiff` in `src/application/git/
  version-control.ts` unconditionally diffed against `HEAD`, which does not exist in a
  repository with zero commits — exactly the state a `git init` just produced, and
  exactly the state this task exists to make reachable from the UI, so it was never
  exercised before this feature existed. Fixed by resolving whether `HEAD` exists
  (`git rev-parse --verify HEAD`) and falling back to Git's well-known empty-tree hash
  (`4b825dc642cb6eb9a060e54bf8d69288fbee4904`) as the diff base otherwise, so a
  commit-less repository reads as "everything pending is new" instead of erroring.

- Phase 3 manual verification, round 4: same repository-switch action, next error —
  "Command failed: git log -50 ... fatal: your current branch 'main' does not have any
  commits yet". `listGitCommits` in the same file had the identical unconditional-`HEAD`
  assumption as round 3's diff calls, just via `git log` instead of `git diff`, and was
  missed in that pass because it is a separate call site, not a separate bug. Fixed by
  checking `HEAD` exists first and returning an empty commit list otherwise, rather than
  letting `git log` fail. Every other `executeGit` call site in `src/application/git/`
  was audited at the same time and confirmed not to share this assumption (none of them
  need a commit to exist: `for-each-ref`, `worktree list`, `remote -v`,
  `branch --show-current`, `status --short`).

- Phase 3 manual verification, round 5: after rounds 3-4, switching Projects no longer
  errored, but the operator reported that switching away from a freshly-initialized
  Project and back made the branch dropdown revert to offering "Initialize Git
  repository" again, as if the init had never happened. Root cause: a registered
  Project's `versionControl`/`branch` is persisted in the sidecar's SQLite store at
  registration time (`registerProject`, `src/application/tasks/project-commands.ts`) and
  never re-read afterward. `git.init` only ran `git init` on the filesystem — nothing
  told the stored row it was now `"git"` instead of `"none"`. `switchProjectFromContext`
  reads the correct live value from Rust's `project_context` first, but then also
  requests `project.snapshot` from the sidecar, whose response carries the *stored*
  Project record and overwrites `activeProject` via `mergeActiveProject` — silently
  reintroducing the stale `"none"`. Fixed by adding `AdeStore.updateProjectRepository`
  and an application-layer `refreshProjectRepositoryState(store, git, repositoryPath)`
  (looks the Project up by its canonicalized repository path, re-inspects the repository
  live, writes the fresh state back), called from the sidecar's `git.init` dispatch
  right after the mutation succeeds and before the response is written, so no later read
  can observe the stale row. Caught by a new spawn-based integration test
  (`tests/desktop-sidecar.test.ts`) that drives `git.init` then `project.snapshot`
  through a real child process, exactly reproducing the two-request sequence the UI
  performs — the existing unit-level tests for the store and for
  `refreshProjectRepositoryState` in isolation would not have caught this, since the bug
  was in the *wiring* between them, not in either piece alone.
