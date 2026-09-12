# SPEC: Handle a Project's `.git` being removed externally

status: approved

## Objective

If a Project's `.git` directory is deleted outside Assay (Finder/terminal/another tool)
while it is the active Project, the app currently crashes the next time it polls Git
state: `inspectPendingGitChanges` (`git status --short --untracked-files=all`) and
`inspectGitWorkspace` (`for-each-ref`/`worktree list`/`remote -v`/`branch
--show-current`/`status --short`) both assume the directory is still a real Git
repository and let the raw `git` failure ("fatal: not a git repository") bubble up as an
"Operation could not be completed" error dialog — including from the background 1.2s
poll timer, so it can appear unprompted. Instead: both read paths detect the repository
is gone and fail with one recognizable, typed error; the sidecar maps it to a distinct
error code; the frontend, on seeing that code, re-syncs via the same live filesystem
check the rest of the app already trusts (Rust's `project_context`) so
`activeVersionControl` flips back to `'none'` and the topbar/version-control UI revert
to the "no Git" state automatically — the exact mirror, in the opposite direction, of
what `offer-git-init-when-no-vcs` already built for the reverse transition.

## Commands

- Backend (sidecar) type-check: `npm run build` (root `tsc --noEmit`)
- Backend (sidecar) unit tests: `npm test` (root, `node --import tsx --test`)
- Frontend syntax check: `node --check desktop/src/main.js`
- Frontend rebuild (for manual verification): `cd desktop && node build.mjs`
- Full app, manual run: `npm run desktop:dev` — GUI behavior verified by the operator
  directly; see `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
- Contract/regression suite: `npm test` (repo root; runs `tests/desktop-ui-contract.test.ts`)

## Structure

- **`src/adapters/git-command.ts`**: new `GitRepositoryMissingError extends Error`
  (`readonly code = "GIT_REPOSITORY_MISSING"`), mirroring the existing
  `GitUnavailableError` in the same file exactly. New `isInsideGitWorkTree(directory):
  Promise<boolean>` — `executeGit(["rev-parse", "--is-inside-work-tree"], { cwd:
  directory }).then(() => true).catch(() => false)`.
- **`src/application/git/workspace-status.ts`**: `inspectGitWorkspace` throws
  `new GitRepositoryMissingError()` up front if `!(await isInsideGitWorkTree(directory))`,
  before its existing `Promise.all` of five `executeGit` calls (all five would otherwise
  fail hard the same way `git status` already does).
- **`src/application/git/version-control.ts`**: `inspectPendingGitChanges` gets the same
  up-front guard (before computing `resolveDiffBase`/running `status`/`diff`).
  `readPendingGitDiff` already calls `inspectPendingGitChanges` first, so it inherits the
  guard without its own change. `listGitCommits` needs no change — its existing
  `rev-parse --verify HEAD` `.catch(() => null)` guard (added for the zero-commit case)
  already happens to return gracefully when there is no `.git` at all too, confirmed by
  inspection: `rev-parse` fails the same way in both cases and is already caught.
- **`src/desktop-sidecar.ts`**: `gitError()` gains a branch mapping
  `GitRepositoryMissingError` to code `"GIT_REPOSITORY_MISSING"`, alongside its existing
  `GitUnavailableError`/`ENOENT` → `"GIT_UNAVAILABLE"` mapping — same function, same
  shape, one more `instanceof` check.
- **`desktop/src/main.js`**: the generic `response.error` handler in the
  `sidecar:response` listener (the one that currently falls through to
  `showOperationError` for any unrecognized error) gains an early branch: if
  `response.error.code === 'GIT_REPOSITORY_MISSING'`, do not open the operation-error
  dialog — instead call `refreshProjectContext(projectSnapshot)` (the same function
  `initGitRepositoryFromUI` already uses to re-sync after `git init`) so
  `activeVersionControl` is re-read live from Rust's `project_context` and the whole
  topbar/version-control UI flips back to the "no Git" state, then `notify(...)` once,
  gently, that Git was no longer found for this Project — never a modal, since this can
  fire from the background poll with no user action in progress.
- **Tests**: `tests/version-control.test.ts` and a new small test file (or an addition to
  an existing one) for `inspectGitWorkspace` gain cases for a plain non-Git directory
  (`mkdtemp`, no `git init` at all) asserting the typed error, not a raw `execFile`
  rejection. `tests/desktop-ui-contract.test.ts` gains string-match assertions for the
  new `GIT_REPOSITORY_MISSING` branch and that it calls `refreshProjectContext` rather
  than `showOperationError`.

## Style

`src/adapters/git-command.ts`, mirroring the existing `GitUnavailableError`:

```ts
export class GitRepositoryMissingError extends Error {
  readonly code = "GIT_REPOSITORY_MISSING";

  constructor() {
    super("This folder is no longer a Git repository.");
  }
}

export async function isInsideGitWorkTree(directory: string): Promise<boolean> {
  return executeGit(["rev-parse", "--is-inside-work-tree"], { cwd: directory })
    .then(() => true)
    .catch(() => false);
}
```

`src/application/git/workspace-status.ts`:

```ts
export async function inspectGitWorkspace(directory: string) {
  if (!(await isInsideGitWorkTree(directory))) throw new GitRepositoryMissingError();
  const [branches, worktrees, remotes, currentBranch, status] = await Promise.all([
    // ...unchanged
  ]);
  // ...unchanged
}
```

`src/desktop-sidecar.ts`, extending the existing `gitError`:

```ts
function gitError(error: unknown, fallback = "GIT_FAILED"): { code: string; message: string } {
  if (error instanceof GitRepositoryMissingError) return { code: "GIT_REPOSITORY_MISSING", message: error.message };
  const unavailable = error instanceof GitUnavailableError
    || (error && typeof error === "object" && "code" in error && error.code === "ENOENT");
  return {
    code: unavailable ? "GIT_UNAVAILABLE" : fallback,
    message: error instanceof Error ? error.message : String(error),
  };
}
```

`desktop/src/main.js`, in the generic error branch (immediately before the existing
`showOperationError(response.error, contextPurpose)` fallthrough):

```js
if (response.error.code === 'GIT_REPOSITORY_MISSING') {
  await refreshProjectContext(projectSnapshot);
  notify('Git was no longer found for this Project.');
  return;
}
```

## Test strategy

- **Sidecar**: `node --import tsx --test` — `inspectGitWorkspace` and
  `inspectPendingGitChanges` each get a case asserting they reject with a
  `GitRepositoryMissingError` (`code === 'GIT_REPOSITORY_MISSING'`) for a plain
  `mkdtemp` directory that was never `git init`-ed, instead of the raw `execFile`
  rejection the operator saw. `gitError()` gets a case confirming the new mapping.
- **Frontend**: string-match additions to `tests/desktop-ui-contract.test.ts` for the new
  `GIT_REPOSITORY_MISSING` branch, that it calls `refreshProjectContext` and does not
  reach `showOperationError` for that code.
- **Manual verification is mandatory before this task is called done**, driven by the
  operator in `npm run desktop:dev`: open a Project with Git, delete its `.git` directory
  from outside Assay (Finder/terminal), wait for or trigger a Git-state refresh (the
  background poll or switching views); confirm no crash dialog appears, the topbar
  reverts to offering "Initialize Git repository," and a plain notification (not a modal)
  reports that Git was no longer found.

## Boundaries

**Always:**
- Route the recovery through the same live check the rest of the app already trusts
  (`refreshProjectContext` → Rust's `project_context_for`, which checks
  `.git` existence directly on disk) rather than inventing a second, parallel way to
  decide a Project has no Git.
- Never show the modal `operation-error-dialog` for `GIT_REPOSITORY_MISSING` — this can
  fire from the unattended background poll timer (`window.setInterval`,
  `desktop/src/main.js`), and a modal interrupting the operator for something they did
  not just do is itself the wrong UX, independent of the crash.
- Mutations (`createBranch`, `createCommit`, `pushBranch`, etc. in
  `src/application/git/git-mutations.ts`) are explicitly out of scope — attempting a
  mutation against a Project whose `.git` just vanished should keep failing loudly, since
  that is a real operator-initiated action that genuinely cannot succeed, unlike a
  passive background read.

**Ask first:**
- Before adding any mechanism that re-creates or restores the removed `.git` directory
  automatically — this task only ever degrades gracefully to the "no Git" state, the
  same state a Project that never had Git is already in; recovery is exactly the existing
  "Initialize Git repository" entry point, not a new one.

**Never:**
- Never let a background poll (`requestPendingGitChanges` on the 1.2s timer) surface a
  raw technical error to the operator when nothing they did triggered it.
