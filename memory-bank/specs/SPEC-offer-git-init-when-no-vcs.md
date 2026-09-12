# SPEC: Offer "Initialize Git repository" when a Project has no VCS

status: approved

## Objective

When the active Project has no Git repository (`activeVersionControl === 'none'`), the
topbar's branch dropdown currently disables its button entirely (`title: 'This project
is not a Git repository'`) with no path forward. Instead, the button stays enabled and
its dropdown offers a single "Initialize Git repository" action. Confirmed through the
same "GIT OPERATION" dialog every other Git mutation already uses, it runs `git init` at
the Project's root, then refreshes project context so the whole topbar/version-control UI
flips to its normal git-aware state automatically — no manual reload, no separate
"you're now on Git" step.

## Commands

- Backend (sidecar) type-check: `npm run build` (root `tsc --noEmit`, covers `src/`)
- Backend (sidecar) unit tests: `npm test` (root, `node --import tsx --test`)
- Frontend syntax check: `node --check desktop/src/main.js`
- Frontend rebuild (for manual verification): `cd desktop && node build.mjs`
- Full app, manual run: `npm run desktop:dev` — GUI behavior verified by the operator
  directly; see `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
- Contract/regression suite: `npm test` (repo root; also runs `tests/desktop-ui-contract.test.ts`)

## Structure

- **Sidecar application layer** — `src/application/git/git-mutations.ts`:
  `initializeRepository(input: ConfirmedOperation)` — no extra params beyond the shared
  `{ directory, actor, reason, confirmed }` shape every sibling mutation already takes.
  Named `initializeRepository`, not `initRepository`, to avoid colliding with the
  same-named local test-fixture helper already in `tests/git-mutations.test.ts`.
- **Sidecar dispatch** — `src/desktop-sidecar.ts`: `"git.init"` added to the existing
  confirmed-mutation method array (alongside `git.branch.create`, `git.push`, …) with the
  same `repositoryPath`/`actor`/`reason` validation every entry in that array already
  gets; no extra required param, so no new validation branch needed beyond what the
  shared block already does.
- **Frontend** — `desktop/src/main.js`:
  - `renderSnapshot`'s branch-button block: `branchable` changes from
    `hasProject && hasGit` to `hasProject`; `title` gains a third case for "no git."
  - `toggleGitContextMenu`: drops its `kind === 'branch' && activeVersionControl ===
    'none'` early return; the `else` branch that currently always loads branches gains a
    no-git case rendering one `data-action="init-git-repository"` button instead.
  - A new dispatcher entry for `init-git-repository`: `requestConfirmation({ eyebrow:
    'GIT OPERATION', ... })`, on confirm calls `sidecar_request` with `method: 'git.init'`,
    then `await refreshProjectContext(projectSnapshot)` on success (its own existing
    notify is the completion signal — no separate toast here, avoiding a double
    notification).
- **Tests**: `tests/git-mutations.test.ts` gains a case for `initializeRepository`
  (mirroring the file's existing fixture style). `tests/desktop-ui-contract.test.ts`
  gains string-match assertions for the changed `branchable` condition, the dropped
  early-return guard, and the new dispatcher entry — same convention every prior task in
  this session has used.

## Style

Sidecar application function, mirroring `fetchOrigin`'s exact shape (same file):

```ts
export async function initializeRepository(input: ConfirmedOperation) {
  assertConfirmed(input);
  const result = await executeGit(["init"], { cwd: input.directory });
  return { operation: "init", output: result.stdout.trim(), actor: input.actor, reason: input.reason };
}
```

Frontend dispatcher entry, mirroring the existing `create-branch`/`push-origin` shape:

```js
if (item.dataset.action === 'init-git-repository') {
  closeGitContextMenus();
  requestConfirmation({
    eyebrow: 'GIT OPERATION',
    title: 'Initialize a Git repository here?',
    copy: `Creates a new Git repository at the root of ${activeProject.name}.`,
    confirmLabel: 'Initialize',
  }, () => {
    nativeInvoke('sidecar_request', { request: JSON.stringify({
      id: `git.init-${Date.now()}`,
      method: 'git.init',
      params: { repositoryPath: activeRepositoryPath(), actor: 'human', reason: 'Git repository initialized from Assay', confirmed: true },
    }) }).then(() => refreshProjectContext(projectSnapshot))
      .catch((error) => { notify('Unable to initialize the Git repository.'); console.warn(error); });
  });
  return;
}
```

## Test strategy

- **Sidecar**: `node --import tsx --test` covering `initializeRepository` — requires
  confirmation (mirrors the existing "git mutations require confirmation" test), and a
  real `git init` on a fresh temp directory actually creates a working repository
  (`git rev-parse --is-inside-work-tree` succeeds afterward).
- **Frontend**: string-match additions to `tests/desktop-ui-contract.test.ts` for the
  changed `branchable` logic, the dropped early-return guard, and the new dispatcher
  entry. No DOM/browser test harness exists in this repo.
- **Manual verification is mandatory before this task is called done**, driven by the
  operator in `npm run desktop:dev`: open (or create) a Project with no `.git`, confirm
  the branch button is enabled and its dropdown offers only "Initialize Git repository",
  confirm the dialog, and confirm the whole topbar (branch name, commit/push buttons,
  version-control view) updates to the git-aware state without a manual reload.

## Boundaries

**Always:**
- Reuse the exact same `requestConfirmation` "GIT OPERATION" pattern every other Git
  mutation in this codebase already uses — no new confirmation UI.
- `initializeRepository` requires `confirmed: true`, `actor`, and `reason` exactly like
  every sibling mutation (`assertConfirmed`) — no bypass for this one operation.
- After a successful `git.init`, refresh project context (`refreshProjectContext`) so
  `activeVersionControl`, the branch label, and every other git-gated control update
  together — never leave the UI in a stale "no git" state after the repo now exists.

**Ask first:**
- Before letting the operator choose an initial branch name, set `user.name`/
  `user.email`, or pick a `.gitignore` template as part of this flow — `git init` alone,
  nothing else bundled in.
- Before exposing "Initialize Git repository" anywhere other than the branch dropdown
  (e.g. a toolbar button, the Projects list) — this task is one entry point.

**Never:**
- Never run `git init` without an explicit, confirmed operator action — no automatic
  init on Project open or on any other implicit trigger.
- Never leave the commit/push buttons pointing at a stale `activeVersionControl` value
  after init succeeds — they must reflect the refreshed context, not require a manual
  Project reselect.
