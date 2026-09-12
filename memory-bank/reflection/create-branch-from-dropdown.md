# Reflection: create-branch-from-dropdown

## Step 1: Implementation vs. spec

Phase 1's code matched the spec's Style snippets essentially verbatim — the first
genuinely "verified, not just similar-looking" mirror in this session's git-init/
branch-dropdown arc, per the `mirror-pattern-verification` rule `offer-git-init-when-
no-vcs` produced. That confidence was correctly placed: neither of Phase 2's two bugs
originated in the mirrored dispatch/completion-correlation logic the spec was careful
about. Both were in adjacent code the spec did not — and structurally could not have —
covered:

1. A pre-existing outside-click-closes-the-menu listener, unrelated to anything this
   task wrote, broke the moment this task introduced the first delegated handler that
   replaces a `.git-context-menu`'s content *in place* rather than closing the menu
   outright. Every prior git-context-menu action (branch switch, Git init) closed the
   menu itself before doing anything else; this task's "stay open, show a form" UX was
   new, and exposed a latent assumption (`event.target` stays attached to the DOM for
   the rest of that click's listener chain) nothing had tested before.
2. `inspectGitWorkspace`'s `for-each-ref` call hit the exact same "zero-commit
   repository" invariant `offer-git-init-when-no-vcs` had already found twice
   (`git diff HEAD`, `git log`) — a third independent git read path, discovered on the
   very Project the operator had used to test *that* task's own fix, a task later.

## Step 2: Workflow evaluation

Both bugs were genuinely undiscoverable from the spec-writing vantage point:
- Bug 1 required actually clicking a real, rendered popover — a DOM-timing interaction
  between two listeners registered at different points in a 6,000+ line file, invisible
  to any string-match contract test (which is this repo's only test tool for frontend
  behavior; no DOM/browser harness exists). This is a real, not hypothetical, limit of
  that test strategy.
- Bug 2 required a live repository in the specific "just initialized, zero commits"
  state, which only exists once the operator actually walks through both features
  back-to-back in the running app — exactly what manual verification exists to catch,
  and exactly why it stayed mandatory throughout this task rather than being treated as
  optional once the automated suite went green.

Complexity routing (standard, no creative) was still the right call — neither bug
represents a design decision the spec skipped; both are implementation-detail
interactions no spec section would plausibly have called out in advance.

## Step 3: Extracted rules

Two rules, in two existing topics (no new topic file needed):
- `desktop-webview-constraints.md`: the `event.target`-detachment hazard — general
  guidance for any future delegated handler over dynamically-replaced menu content.
- `spec-writing.md`: bumped `mirror-pattern-verification`'s evidence to 2, not a new
  entry. The zero-commit-repository `for-each-ref` bug is not "external drift"
  (`stale-cached-state.md`'s topic — that rule is about state an outside actor changes,
  like deleting `.git`) — it is the same lesson `mirror-pattern-verification` already
  names: a state the app itself newly creates breaking read paths that assumed the old
  invariant, confirmed a second, independent time in a different task.

Next: `/seed:archive create-branch-from-dropdown`.
