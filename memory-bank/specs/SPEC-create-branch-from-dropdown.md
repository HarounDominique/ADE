# SPEC: "New branch" option in the topbar branch dropdown

status: approved

## Objective

The topbar's branch dropdown (`branch-context-menu`) currently only lists existing local
branches to switch to. Add a "+ New branch" entry at the top of that same list. Choosing
it swaps the popover's content in place (no new `<dialog>`) for a small inline form: a
branch-name text input plus Create/Cancel. Submitting the name opens the same "GIT
OPERATION" confirmation dialog every other Git mutation in this app already uses; on
confirm, the sidecar's existing `git.branch.create` method runs `git switch -c <name>`
(create and switch in one step — the same backend already used by the unrelated
Task-panel "create-branch" button), then the branch list, current-branch label, and
version-control view refresh to the new state automatically, once the mutation has
genuinely completed.

## Commands

- Backend (sidecar) type-check: `npm run build` (root `tsc --noEmit`) — no sidecar files
  change; this confirms the existing `git.branch.create` surface is untouched.
- Frontend syntax check: `node --check desktop/src/main.js`
- Frontend rebuild (for manual verification): `cd desktop && node build.mjs`
- Full app, manual run: `npm run desktop:dev` — GUI behavior verified by the operator
  directly; see `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
- Contract/regression suite: `npm test` (repo root; runs `tests/desktop-ui-contract.test.ts`)

## Structure

Frontend-only change — `desktop/src/main.js` and `desktop/src/styles.css`. No sidecar or
Rust changes: `git.branch.create` (`src/desktop-sidecar.ts` confirmed-mutation array →
`createBranch` in `src/application/git/git-mutations.ts`) already exists, already takes
`{ repositoryPath, intent (the branch name), actor, reason, confirmed }`, and already
runs `git switch -c <name>`.

- `renderBranchMenu()` (`desktop/src/main.js`): prepend one `data-create-branch-trigger`
  button ("+ New branch") to the list it already builds from `gitBranches`, ahead of the
  existing branches (or the "No local branches found" empty state) — always present
  once the list itself is rendered, never during the "Loading branches…" placeholder.
- New `renderCreateBranchForm()`: replaces `branch-context-menu`'s content with a form —
  one text input, a Cancel button (`data-cancel-create-branch`, returns to
  `renderBranchMenu()`), a submit button. The submit listener is attached directly to
  the freshly-created form element inside this function (not the page-load static
  dispatcher, and not a stale reference — a fresh listener on a fresh element every
  call), focuses the input on open.
- Two new delegated-click entries in the existing `document.addEventListener('click',
  ...)` block (the same one that already handles `data-branch-name`,
  `data-init-git-repository`, etc.) — never the static `[data-action]` forEach
  dispatcher, which only ever wires elements present at page load: `[data-create-branch-
  trigger]` → `renderCreateBranchForm()`; `[data-cancel-create-branch]` →
  `renderBranchMenu()`.
- New `createBranchFromDropdown(name)`: mirrors `switchBranchFromContext` exactly —
  `sendContextRequest('git.branch.create', { repositoryPath, intent: name, actor:
  'human', reason: ..., confirmed: true }, 'create-branch-from-dropdown')` inside a
  try/catch that sets `setSyncState('failed', ...)` and `notify(...)` on rejection.
- New `contextPurpose === 'create-branch-from-dropdown'` branch in the `sidecar:response`
  listener (`desktop/src/main.js`, alongside the existing `switch-branch` branch it
  mirrors): on `response.result?.operation === 'branch.create'`, calls
  `refreshGitWorkspace(path, nativeInvoke)` (the same call that already updates the
  branch label and re-renders `renderBranchMenu()` via the generic `{branches,
  worktrees, currentBranch}` response matcher further down the same listener), resets
  `gitCommitNeedsPush`/`gitUnpushedCommitCount`, `setSyncState('ready', ...)`,
  `notify(...)`, `renderCommitControls()`.
- **Tests**: `tests/desktop-ui-contract.test.ts` gains string-match assertions for the
  new trigger/cancel/form/dispatch wiring, same convention every prior task in this
  session has used. No sidecar test changes — `git.branch.create`'s own test coverage in
  `tests/git-mutations.test.ts`/`tests/desktop-sidecar.test.ts` is untouched and already
  sufficient; this task only adds a new caller of an already-tested mutation.

## Style

`renderBranchMenu()`, prepending the trigger:

```js
function renderBranchMenu() {
  const menu = document.getElementById('branch-context-menu');
  if (!menu) return;
  const createOption = '<button class="git-context-option git-context-option-create" type="button" role="menuitem" data-create-branch-trigger>+ New branch</button>';
  menu.innerHTML = createOption + (gitBranches.length
    ? gitBranches.map((branch) => `<button class="git-context-option${branch === document.getElementById('current-branch-name')?.textContent ? ' selected' : ''}" type="button" role="menuitem" data-branch-name="${escapeHTML(branch)}">${selectedMarkMarkup(branch === document.getElementById('current-branch-name')?.textContent)}<span><strong>${escapeHTML(branch)}</strong></span></button>`).join('')
    : '<p class="git-context-empty">No local branches found.</p>');
}
```

`renderCreateBranchForm()`, new:

```js
function renderCreateBranchForm() {
  const menu = document.getElementById('branch-context-menu');
  if (!menu) return;
  menu.innerHTML = `<form class="git-context-inline-form" id="create-branch-form">
    <label for="create-branch-name">New branch name</label>
    <input id="create-branch-name" type="text" autocomplete="off" placeholder="feature/my-change" required>
    <div class="git-context-inline-actions">
      <button class="button secondary compact" type="button" data-cancel-create-branch>Cancel</button>
      <button class="button primary compact" type="submit">Create</button>
    </div>
  </form>`;
  const input = document.getElementById('create-branch-name');
  requestAnimationFrame(() => input?.focus());
  document.getElementById('create-branch-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input?.value.trim();
    if (!name) { input?.focus(); return; }
    closeGitContextMenus();
    requestConfirmation({
      eyebrow: 'GIT OPERATION',
      title: `Create branch "${name}"?`,
      copy: `Creates and switches to a new branch from the current one in ${activeProject.name}.`,
      confirmLabel: 'Create',
    }, () => createBranchFromDropdown(name));
  });
}
```

`createBranchFromDropdown`, mirroring `switchBranchFromContext` (`desktop/src/main.js`):

```js
async function createBranchFromDropdown(name) {
  const path = activeRepositoryPath();
  if (!nativeInvoke || !path || !name) return;
  setSyncState('stale', `Creating ${name}…`);
  try {
    await sendContextRequest('git.branch.create', { repositoryPath: path, intent: name, actor: 'human', reason: 'Branch created from Assay Git context bar', confirmed: true }, 'create-branch-from-dropdown');
  } catch (error) {
    setSyncState('failed', 'Branch creation failed');
    notify(error instanceof Error ? error.message : 'Branch creation failed.');
  }
}
```

Response handler, mirroring the existing `switch-branch` branch it sits beside:

```js
if (contextPurpose === 'create-branch-from-dropdown' && response.result?.operation === 'branch.create') {
  const path = activeRepositoryPath();
  if (path) await refreshGitWorkspace(path, nativeInvoke);
  gitCommitNeedsPush = false;
  gitUnpushedCommitCount = 0;
  setSyncState('ready', 'Synced just now');
  notify(`Branch ${response.result.name} created.`);
  renderCommitControls();
  return;
}
```

## Test strategy

- **Sidecar**: none needed — `git.branch.create` is pre-existing, already tested, and
  unchanged by this task.
- **Frontend**: string-match additions to `tests/desktop-ui-contract.test.ts` for:
  `data-create-branch-trigger` present and delegated (not the static dispatcher);
  `data-cancel-create-branch` present and delegated; `function renderCreateBranchForm`
  exists; `function createBranchFromDropdown` exists and calls `sendContextRequest`
  (never a raw `nativeInvoke(...).then()`); the `'create-branch-from-dropdown'`
  response branch exists and gates on `operation === 'branch.create'`.
- **Manual verification is mandatory before this task is called done**, driven by the
  operator in `npm run desktop:dev`: open a Project with Git, open the branch dropdown,
  click "+ New branch", type a name, confirm; verify the current-branch label, the
  branch dropdown's list, and the version-control view all reflect the new branch
  without a manual reload; verify Cancel returns to the branch list without dispatching
  anything; verify an empty/whitespace-only name does not open the confirmation dialog.

## Boundaries

**Always:**
- Reuse the exact same `requestConfirmation` "GIT OPERATION" pattern every other Git
  mutation in this codebase already uses — no new confirmation UI beyond the one new
  inline name-entry step the user explicitly asked for.
- Route completion through `sendContextRequest`'s `pendingContextRequests`/
  `sidecar:response` correlation — never a raw `nativeInvoke('sidecar_request',
  ...).then()` chain. This exact anti-pattern was the root cause of a bug fixed and
  reflected on in `offer-git-init-when-no-vcs`
  (`agent-rules/_learned/spec-writing.md#mirror-pattern-verification`); this spec's
  snippets above route every mutation through `sendContextRequest` specifically because
  of that finding.
- Wire dynamically-rendered trigger/cancel buttons through the existing delegated
  `document.addEventListener('click', ...)` block, never the static `[data-action]`
  dispatcher — the exact bug class documented in
  `offer-git-init-when-no-vcs`'s Deviations (round 1).
- `git switch -c <name>` both creates and switches to the branch — this task does not
  add a "create without switching" variant.

**Ask first:**
- Before adding client-side branch-name format validation beyond non-empty/trimmed
  (git ref-name rules, reserved characters, etc.) — this task lets `git switch -c`
  itself be the validator, surfacing its rejection through the existing error/`notify()`
  path.
- Before touching the unrelated existing "create-branch" button in the Task
  git-workflow panel (`main.js`, pre-fills `feature/<taskSuffix>`) — separate entry
  point, explicitly out of scope.

**Never:**
- Never run `git.branch.create` without an explicit, confirmed operator action.
- Never leave the branch label, branch list, or commit/push controls pointing at the
  pre-creation branch after a successful create — they must reflect the new branch
  without a manual Project reselect, same requirement `offer-git-init-when-no-vcs`
  already established for its own mutation.
