---
slug: changes-tab-status-glyphs-and-selective-commit
spec: SPEC-changes-tab-status-glyphs-and-selective-commit.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Sidecar: `createCommit` gains optional `files?: string[]`
  (`git reset` then `git add -- <files>` or `git add --all`); `git.commit.create`'s
  dispatch forwards `params.files` when present. `git.commit.push`/Ship untouched. No
  creative needed — direct extension of an already-tested function's signature.
  (satisfies: SPEC-changes-tab-status-glyphs-and-selective-commit.md#structure, #style,
  #test-strategy — sidecar half)
  Test strategy: `npm run build`; `node --import tsx --test tests/git-mutations.test.ts`.

- [x] Phase 2 — Frontend: `gitStatusGlyph()` (built on `workspaceGitStateClass()`)
  replaces the raw status text in `gitFileLabelMarkup`; pending-file rows become
  `<div role="button">` wrappers carrying a checkbox
  (`data-git-pending-file-select`) alongside the existing diff-select
  (`data-git-pending-file`); new `pendingCommitSelection` Set, reset only on a genuine
  file-set change; select-all checkbox in `index.html`'s `.changes-section-heading`;
  commit submit refuses an empty selection and omits `files` when everything is
  selected. No creative needed — mirrors this session's established delegated-click
  and Set-based-selection-state patterns.
  (satisfies: SPEC-changes-tab-status-glyphs-and-selective-commit.md#structure, #style
  — frontend half)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions in
  `tests/desktop-ui-contract.test.ts`, same phase per this session's convention.

- [x] Phase 3 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (modify/add/delete files, confirm the three
  glyphs/colors; uncheck one file, commit, confirm only checked files land in the
  commit via `git log`/`git show` and the unchecked one stays pending; confirm
  select-all/indeterminate behavior; confirm an empty selection refuses to commit;
  confirm a checkbox click never changes the diff preview) before reporting the task
  done. No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-changes-tab-status-glyphs-and-selective-commit.md#test-strategy,
  #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: DONE
**Current Phase**: 3
**Current Step**: 6/6
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: NO — all phases complete, operator confirmed in `npm run desktop:dev`

## Deviations

- Phase 1: none. Added one extra test beyond the spec's Test strategy ("committing a
  subset already-staged outside Assay ignores the extra staged file") to directly
  exercise the `git reset` determinism claim, not just infer it from the other cases.

- Phase 2, found in review (step 4), not by the operator:
  1. The spec's own Style snippet turned the pending-file row from a `<button>` into a
     `<div role="button" tabindex="0">` (necessary — a `<button>` cannot legally nest
     the new checkbox `<input>`), but neither the spec nor the initial implementation
     wired keyboard activation back: a real `<button>` gets Enter/Space for free, a
     `role="button"` div does not. Fixed with a delegated `keydown` handler that
     synthesizes a `.click()` on the row for Enter/Space, guarded so it never fires
     when the checkbox itself has focus (which already handles Space natively).
  2. Clicking a `<label>` that wraps an `<input>` can land on the label's own box
     (padding, flex sizing) rather than exactly on the input — `closest()` only
     searches ancestors, so `[data-git-pending-file-select]` (on the input, a
     descendant of the click target in that case) does not match, and the click fell
     through to the row's diff-select branch, firing both. The browser separately
     forwards a synthesized click straight at the input for the actual toggle, so the
     fix is a guard (`event.target.closest('.git-pending-file-checkbox')`) that stops
     the row's diff-select branch from ever running for a label click, before the
     synthesized input click arrives and handles the real toggle.
  - `gitFileLabelMarkup` is shared with the History tab's per-commit file list
    (`.git-commit-file`), not scoped to Changes alone — reusing it (rather than
    duplicating a second near-identical function) means the History tab's file rows
    also gain the same colored glyphs as a byproduct. Flagging this explicitly since
    the spec's Objective named only the Changes tab; the change itself is purely
    cosmetic and consistent (same status codes, same meaning), so kept rather than
    forking the function — but it is visible scope the operator did not explicitly ask
    for.
