# Archive: discard-pending-file-changes

## Summary

Right-click "Discard changes" on any pending file row in `Version control > Changes`.
Backend `discardFileChanges` branches on the file's already-known status bucket:
`git reset` + `git clean -f` for new/untracked files (deletes them, no committed
version to restore to), `git checkout --` for modified/deleted tracked files
(restores from `HEAD`). New `git.discard.file` sidecar dispatch, new
`#git-pending-file-context-menu` reusing the Explorer tree's existing `contextmenu`
pattern, and the existing `requestConfirmation` dialog with copy distinguishing the
two cases.

Satisfies: `memory-bank/specs/SPEC-discard-pending-file-changes.md` (all sections).
Operator manually confirmed all three status buckets (new, modified, deleted) in
`npm run desktop:dev`.

## Deviations accepted

`openGitPendingFileContextMenu`'s definition moved further down in `main.js` than the
spec's suggested location, to avoid breaking two pre-existing ordering-sensitive
contract tests — code unchanged, safe per function hoisting, verified in review.

## Reflection

`memory-bank/reflection/discard-pending-file-changes.md` — no new rule extracted.
Surfaced an adjacent, unrelated finding: the Changes tab doesn't auto-refresh when
switching into it from History or another top-level view, contradicting
`docu/specs/SPEC-git-collaboration.md`'s documented claim. Tracked as a separate
follow-up task, not part of this one's scope.
