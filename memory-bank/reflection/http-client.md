# Reflection: http-client

## Step 1: Implementation vs. spec

Full match against `SPEC-http-client.md`'s final state. All seven bullets in
`#acceptance-criteria` are backed by real tests, verified during Phase 5's sweep rather
than assumed from earlier phases' own claims — two of the seven had no test at all
until that sweep (delete; environment-switch re-evaluation), both closed the same
session rather than left as a documentation gap.

Real deviations, roughly in order of how much they cost:

1. **Vendoring scope, corrected twice, both times before review had to catch it.**
   ADR-0059's spec-time survey named five Bruno packages as the engine to vendor.
   Phase 2 installed `@usebruno/requests`, ran `npm audit`, found two high-severity
   CVEs in its transitive deps, read its actual exported surface, and found none of it
   (OAuth2/Digest/gRPC/WebSocket) matched this module's own `HttpAuth`/`HttpBody`
   contract — removed it, used `axios` directly, and corrected the ADR/spec/Nexus
   changelog to record the real reasoning rather than silently diverging from what
   they claimed. This was self-caught, not review-caught: two extra commits mid-Phase-2
   (`fix: pin axios/faker...`, then `fix: drop @usebruno/requests...`) before the
   phase's actual TDD work even started.

2. **A real, live security gap, self-caught late but fixed before it shipped.**
   Phase 5's review didn't ask about path traversal — it asked about the Ask-first
   boundary's scope. But its dispatch also asked the reviewer to judge whether a
   pre-existing, shared shape ("all five `http.collection.*` methods build their path
   the same unguarded way") deserved a different bar for *delete* specifically, given
   `rm(..., { recursive: true })`'s blast radius. That question surfaced that the
   save-dialog's free-text path input was a real, reachable traversal vector, not a
   theoretical one — closed with a shared containment guard and a test that proves a
   sentinel file outside the root survives a crafted path, in the same session, on the
   task's last phase, specifically because there was no later phase left to catch it.

3. **A scope cut that drifted out of sync with its own spec text.** Phase 5 shipped
   Ask-first as loopback-only, deliberately deferring the `run-configurations`
   cross-reference the original Boundary line and the roadmap's own test-strategy
   sentence both named. The direction was safe (asks more, never less) but the spec
   text and task file weren't updated to say so — review blocked on exactly that
   mismatch, not on the cut itself. Fixed by rewriting the Boundary bullet and adding
   an Open Question, not by implementing the deferred half.

4. **Two RPC methods the roadmap didn't anticipate, added mid-phase, not left as a
   silent gap.** Phase 4a's plan covered list/save; Phase 4b (the UI) discovered it
   also needed to *read* a single request/environment's full content by path (the
   tree only ever carries id/name/method) — added `http.collection.request.get`/
   `.environment.get` in the same dispatch, mirroring `.save`'s shape, rather than
   shipping a UI that couldn't actually load what it listed.

5. **A genuine phase-scope correction discovered at planning time, not mid-build.**
   Before dispatching Phase 4 at all, re-reading Phase 1's own deviations showed
   collection-tree listing and RPC wiring had been explicitly deferred to "Phase 4
   prep work" — meaning Phase 4 as originally roadmapped (just the UI) had no backend
   to consume. Split into 4a (backend CRUD) and 4b (the view) before either was
   dispatched, rather than discovering the gap inside a UI build and course-correcting
   there.

6. Smaller, accepted-as-documented gaps: `HttpRequest.params` not distinguishing
   query/path (Phase 1, open question); multipart file-upload fields deferred (Phase
   2, documented + tested); delete/rename not in 4a's scope (documented, closed by
   Phase 5 instead); a request-in-flight/delete race (found by Phase 5's own review,
   fixed same session with a generation counter).

## Step 2: Workflow evaluation

**Complexity routing (designed, 5 phases) was right in shape, wrong in granularity
once.** Phase 4 needed a real mid-build split (4a/4b) that the original roadmap
didn't anticipate — not because the phase was mis-routed at the "designed" tier, but
because the roadmap's Phase 4 line assumed backend coverage that Phase 1 had
explicitly deferred without that deferral being cross-checked against what Phase 4
would actually need. See the new `verify-full-crud-exists-before-scoping-a-consuming-
ui-phase` rule.

**The spec needed correction well past "more than once."** ADR-0059/SPEC-http-client
were amended after Phase 2 (vendoring scope), after Phase 1→2 (the `params`
ambiguity), after Phase 4 (nav propagation, the resizer's design-contract fidelity),
and after Phase 5 (Boundary text vs. shipped scope). None of these were spec *errors*
in the sense of being wrong when written — each was the spec catching up to a fact
only the corresponding build phase could discover (a library's real exports, a UI's
real data needs, a security review's real finding). The pattern worth naming isn't
"write better specs up front" — some of this genuinely can't be known until
implementation — it's that every one of these corrections happened in the same
session as the phase that discovered it, none were left for a later spec-sync pass.
That discipline held for five phases in a row and is worth treating as validated, not
just lucky.

**Review, dispatched with a named target, found something real almost every time.**
Four of five phases had at least one review pass with a genuine finding (Phase 1's
license-table gap; Phase 3's evidence-pruning omission; Phase 4's secret-redaction gap
plus the resizer's design-fidelity miss; Phase 5's spec/code drift plus the
proactively-pushed traversal and race findings). Only Phase 2 passed clean on the
first attempt. Every one of these was surfaced because the dispatch prompt named the
specific thing to check — a prior pattern to diff against, a real-world trigger
scenario to trace, an existing convention's exception list — not because the reviewer
happened to notice on a general pass. See the new `name-exact-risk-areas-in-review-
dispatch-prompts` rule.

**Infra crashed three times, recovered cleanly three times, same technique each
time.** An API 400 (assistant message prefill) mid-Phase-3, a session rate limit at
the start of Phase 4a, and an ECONNRESET at the start of Phase 5 — all killed a
dispatched agent before or partway through its work. All three were resolved by
checking `git status` for partial work and finishing directly in the orchestrating
session (which already held the same grounding — file locations, established
patterns — the crashed dispatch prompt had spent real effort gathering), rather than
by blind redispatch. This is the strongest, most repeated pattern in this task and
the one most likely to recur on the next large multi-phase build. See the new
`resume-in-session-after-subagent-infra-crash` rule.

**A rule already in `_learned/` (`kill-spawned-children-in-finally`) got violated
fresh, by an agent that never saw it.** `build-tdd-agent`'s own method never reads
`_learned/` — only the review gate does — so a rule that's been in the system since
`offer-git-init-when-no-vcs` still had to be rediscovered by review in Phase 3,
because the TDD agent writing a new spawn-based test had no path to it at write time.
Bumped the rule's evidence count and noted the mechanism gap directly on it, rather
than treating this as a one-off repeat.

## Step 3: Extracted patterns

New: `build-dispatch-practices.md` (two entries — resuming in-session after an infra
crash; naming exact risk areas in review dispatches). New:
`security-defaults.md` (two entries — auditing a new npm dependency immediately after
install, not just at spec time; file-path RPC methods needing a containment guard by
default). Extended `spec-writing.md` with `verify-full-crud-exists-before-scoping-a-
consuming-ui-phase`. Extended `vendoring-external-assets.md` with
`verify-actual-api-surface-before-vendoring-a-library` (the library-level sibling of
the existing filename-level rule). Bumped `testing-side-effecting-code.md`'s
`kill-spawned-children-in-finally` to evidence_count 2, with the mechanism gap
(TDD dispatch never reads `_learned/`) recorded as the reason it recurred.

Next: `/seed:archive http-client`.
