---
topic: build-dispatch-practices
priority: medium
---

### resume-in-session-after-subagent-infra-crash
_derived_from: reflection/http-client.md · evidence_count: 1 · last_validated: 2026-09-14_

When a dispatched build-step agent (TDD, batch-test, or review) dies with an
infrastructure error (`API Error: 400 ... assistant message prefill`, `429 rate_limit`,
`ECONNRESET`, or similar — never a real assertion/test failure), check `git status`
first, not a retry-and-hope: if nothing was written, just redispatch (or, once the
grounding work is already done, finish it directly in the orchestrating session using
the same investigation already gathered, rather than paying to re-derive it cold in a
fresh dispatch); if partial work exists, read what's there and complete it directly —
the orchestrating session already holds the exact context (file locations, established
patterns, the dispatch prompt's own research) a fresh subagent would have to rebuild.
`http-client` hit this shape three separate times across five build phases (Phase 3's
TDD step, Phase 4a's TDD step, Phase 5's TDD step) and recovered cleanly every time by
finishing the work in-session — never by discarding progress and starting over cold.

### name-exact-risk-areas-in-review-dispatch-prompts
_derived_from: reflection/http-client.md · evidence_count: 1 · last_validated: 2026-09-14_

A build-review dispatch that says "review this diff" catches surface issues; one that
names the specific risk (`"Phase 2 already redacts responseHeaders — does this new
responseBody field get the same treatment, or does an API that echoes request content
back leak a secret in plaintext?"`) catches the real ones. Across `http-client`'s five
phases, every blocking review finding — a missing evidence-pruning call the codebase's
other 8 evidence writers all had, a genuinely exploitable secret-redaction gap on a
newly-added field, a spec/code drift on a deliberately narrowed security boundary —
came from a dispatch prompt that pointed the reviewer at the exact file, the exact
prior pattern to diff against, or the exact real-world trigger scenario to trace,
not from a generic pass over the diff. Before dispatching a build-review, write down
what could plausibly be wrong given *this specific diff's* shape (a new field bypassing
an established side-effect convention, a new user-facing input reaching a filesystem
path, a security boundary whose spec text and shipped scope might have drifted apart)
and put each one in the prompt by name.

### verify-branch-provenance-before-the-first-phase-commit
_derived_from: reflection/image-and-html-preview.md · evidence_count: 1 · last_validated: 2026-09-14_

Step 1 (git setup) creates a task's branch with a plain `git checkout -b` in the shared
working directory — it does not isolate the branch in its own worktree, and does not
re-check that the branch still points where it was created before the first build-phase
agent commits to it. `image-and-html-preview` branched cleanly from a clean `master`,
but a second, unrelated process (a concurrent session doing legitimate but different
work, "vendor dual-host seed plugin") committed 10 commits directly onto that same
branch name in the same shared checkout before this task's Phase 1 TDD agent made its
first commit — invisible until Phase 5, when `git diff master...feature` showed files
this task never touched. Recovered by preserving the foreign commits on their own
branch (`git branch <name> <foreign-tip-sha>`) and `git rebase --onto <true-branch-
point> <foreign-tip-sha> <this-branch>` to drop them, but this was only caught by
chance during a pre-merge diff review, not by any build step. When more than one
concurrent session may share this repository's working directory, step 1 (or the first
phase's step 6 commit) should verify `git merge-base <branch> <base>` still equals the
base's tip actually recorded at branch-creation time before trusting the branch's
history is exclusively this task's own — and prefer an isolated `git worktree` per task
branch over a plain `checkout -b` in the shared tree wherever concurrent sessions on the
same repository are a realistic possibility.

### extract-shared-abstraction-on-the-third-clone
_derived_from: reflection/image-and-html-preview.md · evidence_count: 1 · last_validated: 2026-09-14_

When a build phase copies an existing interaction pattern (a toggle, a preview surface,
a state machine) to cover a second format/case, and the spec's own language already
signals a third is coming for the same pattern, that is the point to extract a shared,
parameterized implementation — not after the third copy exists. `image-and-html-
preview` cloned Markdown's `Preview`/`Source` toggle machinery for SVG (Phase 2,
reviewed and accepted — relabeling the one shared button risked breaking already-
pinned Markdown tests), then HTML (Phase 3, same shape again), then Mermaid (Phase 4,
a fourth near-identical clone) — by Phase 4 there were four ~25-line state machines
differing only by format string, extension check, and render mechanism, each carrying
its own copy of every future fix (the Phase 4 async-render-generation-guard fix, for
example, had to be threaded through all four). The Phase 2 review flagged this
explicitly as a decision point before Phase 3 and recommended extracting a
`createFormatPreviewToggle({...})`-shaped factory then, while only two instances
existed; the task's own roadmap had already fixed four phases with this shape before
review ran, so the flag arrived one phase too late to act on cheaply. When a roadmap
plans three or more phases that will each clone the same pattern, name the extraction
as its own phase (or fold it into the second phase, while only two clones exist)
instead of letting review discover the debt after the fact.
