# Reflection: handle-git-repository-removed

## Step 1: Implementation vs. spec

Both phases implemented from the spec's Style snippets essentially verbatim — a genuine
verified mirror this time (the `mirror-pattern-verification` rule from
`offer-git-init-when-no-vcs` was explicitly checked against during spec-writing: I
confirmed `isInsideGitWorkTree`'s only false-positive edge case, a bare repository
reading as `true`, before accepting it as out of scope rather than discovering it in
manual verification like the prior task's bugs were). All Boundaries satisfied: no modal
for the background-poll-triggered case, recovery routes through the existing live
`project_context` check rather than a new parallel one, mutations left untouched.

Two minor deviations, both caught by me before reaching the user:
- Phase 1: `inspectGitWorkspace` had zero prior test coverage; added a happy-path test
  alongside the new guard test rather than leaving the function's normal behavior
  unverified.
- Phase 2: the first RED assertion used a fragile block-extraction regex that never
  matched real source; simplified to two direct assertions once GREEN caught it.

Zero user-facing follow-ups this time — the first task since `offer-git-init-when-no-vcs`
in this session's git-init/branch-dropdown/repository-lifecycle arc to close in one pass.

## Step 2: Workflow evaluation

Complexity routing (standard, no creative) matched the task's real shape correctly this
time — unlike `offer-git-init-when-no-vcs`, this task's entire premise (audit every git
read path for an unverified assumption) was already stated as the spec's own method, not
discovered live during build.

Notable: this bug was found by the *user*, not by build-phase testing, and the trigger
was external to the app entirely (deleting `.git` from Finder/terminal, not through any
Assay action). The prior task's reflection concluded "a mutation must refresh what it
invalidates" — this task is that same principle's mirror image: **a read path must not
assume its own cached understanding of the world stays true between reads**, whether the
staleness comes from the app's own mutation (prior task) or from something entirely
outside the app's control (this task). Worth keeping both framings in the same rule
topic since they are the same underlying failure mode from two different directions.

## Step 3: Extracted rules

One entry appended to the existing `stale-cached-state.md` topic (not a new file — same
underlying failure mode as its first entry, opposite trigger).

Next: `/seed:archive handle-git-repository-removed`.
