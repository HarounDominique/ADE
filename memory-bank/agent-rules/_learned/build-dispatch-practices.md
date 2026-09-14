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
