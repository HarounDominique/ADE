# SPEC: Disable "Fetch origin" when the Project has no remote

status: approved

## Objective

`#git-fetch-origin` (Version Control) is never disabled — clicking it against a
repository with no `origin` remote runs `git fetch origin`, which fails hard and
surfaces the raw "fatal: 'origin' does not appear to be a git repository" error to the
operator. `#git-push-origin` already avoids this class of problem, but only
incidentally: it disables whenever there are no unpushed commits to report, and
`listUnpushedCommits` (`src/application/git/version-control.ts`) happens to return an
empty set when there's no remote — not because anything explicitly checks for a
remote. Fetch has no equivalent fallback, so it stays enabled unconditionally. Fix:
track whether the Project has any remote (from `git.workspace`'s existing `remotes`
field, already fetched, just never stored) and disable Fetch when it does not.

## Boundaries

**Always:** `#git-fetch-origin` disables whenever `hasGitRemote` is false or
`activeVersionControl === 'none'`, mirroring `renderCommitControls()`'s existing
pattern for Push/Commit.

**Never:** never adds a second, parallel way to detect "has a remote" — reuses the
`remotes` array `git.workspace`'s response already carries, the same response
`renderCommitControls()` already runs from.
