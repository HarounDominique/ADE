# Archive: changes-tab-status-glyphs-and-selective-commit

## Summary

Version Control → Changes now shows a colored glyph per pending file (green `+` new,
red `−` deleted, amber `º` modified/renamed/conflict) instead of the raw git status
code, and each file has a checkbox (checked by default) so the operator can commit a
subset atomically, with a select-all/none toggle near the file-count header. The
commit mutation stages exactly the checked set deterministically.

Satisfies: `memory-bank/specs/SPEC-changes-tab-status-glyphs-and-selective-commit.md`
(all sections).

## What was built

- **`src/application/git/git-mutations.ts`**: `createCommit` gains optional
  `files?: string[]` — `git reset` then `git add -- <files>`, or `git add --all`
  unchanged when omitted. Confirmed safe on a zero-commit repository directly against
  real `git` before writing any code.
- **`src/desktop-sidecar.ts`**: `git.commit.create` forwards `params.files`.
  `git.commit.push`/Ship untouched, per boundary.
- **`desktop/src/main.js`/`index.html`/`styles.css`**: `gitStatusGlyph()` built on the
  Explorer tree's existing `workspaceGitStateClass()`; pending-file rows carry a
  checkbox alongside the existing diff-select; `pendingCommitSelection` state, reset
  only on a genuine file-set change; select-all checkbox with indeterminate support;
  commit submit refuses an empty selection and omits `files` when everything is
  selected (identical request shape to before this task).

## Deviations accepted

Two bugs found in review (not by the operator), both fixed and tested: keyboard
activation lost when the row became a `<div role="button">` (a `<button>` cannot
legally nest the new checkbox), and a checkbox-label click that could fall through to
the row's diff-select branch alongside the browser's own forwarded click. Full detail
in the task file's `## Deviations`. `gitFileLabelMarkup` is shared with the History
tab's file list, so it picked up the same glyphs as a flagged, not silent, side effect.

## Reflection

See `memory-bank/reflection/changes-tab-status-glyphs-and-selective-commit.md`. One
rule added to `agent-rules/_learned/desktop-webview-constraints.md`
(`interactivity-conversion-has-a-fixed-cost`): converting a native interactive element
to a `role="button"` div to nest a second control always costs keyboard activation and
label-click correctness, and a spec proposing that conversion should name both.
