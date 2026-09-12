# Archive: disable-fetch-origin-without-remote

## Summary

`#git-fetch-origin` now disables when the active Project has no Git remote, mirroring
`#git-push-origin`'s existing behavior — `hasGitRemote` is set from `git.workspace`'s
already-fetched `remotes` field and gates the button in `renderCommitControls()`.

Satisfies: `memory-bank/specs/SPEC-disable-fetch-origin-without-remote.md`.

## Deviations accepted

None.

## Reflection

Inline, in `memory-bank/tasks/disable-fetch-origin-without-remote.md` — fast-path
task, no separate reflection document.
