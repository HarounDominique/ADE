---
slug: discard-pending-file-changes
spec: SPEC-discard-pending-file-changes.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Backend mutation + sidecar dispatch + right-click menu, end to end.
  Small enough to be one phase: the mutation, its sidecar wiring, the context-menu
  markup/handlers, and the discard action are all one cohesive unit with no natural
  seam to split on. (satisfies: SPEC-discard-pending-file-changes.md#structure, #style)

  - `src/application/git/git-mutations.ts`: `discardFileChanges`.
  - `src/desktop-sidecar.ts`: `git.discard.file` dispatch.
  - `desktop/src/index.html`: `#git-pending-file-context-menu` markup.
  - `desktop/src/main.js`: `openGitPendingFileContextMenu`,
    `closeGitPendingFileContextMenu`, the `discard-pending-file` action handler,
    wired into the existing outside-click/Escape handlers.

  Test strategy: unit tests for `discardFileChanges` against a real temp git fixture
  (modified reverts, deleted reappears, untracked removed, staged-new
  unstaged-then-removed); contract-test additions for the menu markup and its
  `contextmenu`/outside-click/Escape wiring; full `npm test`; **mandatory manual
  verification** in `npm run desktop:dev` across all three status buckets (new,
  modified, deleted).

## Execution State

**Build Status**: DONE
**Current Phase**: 1
**Current Step**: 6/6
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

`openGitPendingFileContextMenu`'s definition was moved from the spec's suggested
location (near `gitFileLabelMarkup`) to further down in `main.js` (near the new
`contextmenu` listener) — placing it at the spec's suggested spot broke two
pre-existing contract tests asserting source-order between two occurrences of the
same selector string. Safe (function hoisting), verified in review; code itself
unchanged. All build steps green on first attempt otherwise. Manual verification
(new/modified/deleted buckets in `npm run desktop:dev`) still outstanding — mandatory
before archiving.
