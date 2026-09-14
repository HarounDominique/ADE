# Archive: http-client

## Summary

An embedded HTTP request client — the `Requests` view, sixth nav entry between
`Agents` and `Version control` — vendoring Bruno's engine (`@usebruno/lang` via
`@usebruno/filestore`) rather than building a `.bru` parser or an execution engine
from scratch. Five phases, all reviewed and committed on `feature/http-client`:

1. **Domain + collection I/O** — `HttpAuth`/`HttpBody`/`HttpAssertion`/`HttpRequest`/
   `HttpEnvironment` types, `.bru` round-trip via `@usebruno/filestore`, verified
   against a hand-written fixture from outside Assay (not just its own output).
2. **Execution engine** — `axios` directly (not `@usebruno/requests`, whose real
   surface turned out to be OAuth2/Digest/gRPC/WebSocket, none of it needed). Secret
   redaction on both response headers and body.
3. **History + Task evidence** — `http_executions` table (Project-scoped, Task
   optional), `RuntimeEvidence` via the same `loadGatePolicy`→save→prune mechanism
   every other evidence writer in the codebase uses. Citable, never a gate.
4. **The `Requests` view** — collection tree, request editor (5 tabs), environment
   picker, Send/Save, a real resizable request/response divider (mirrors the terminal
   dock's own resizer). Split into a backend CRUD sub-step (4a) once Phase 4 planning
   found list/save/delete had never been wired to RPC.
5. **Network boundary + delete + acceptance sweep** — Ask-first confirmation
   (loopback-only this iteration, `run-configurations` cross-referencing deferred and
   recorded as an Open Question, not silently dropped), delete for requests/
   collections/environments (a real acceptance-criteria gap no earlier phase closed),
   and every bullet in `#acceptance-criteria` checked against a real test.

Satisfies: `docu/specs/SPEC-http-client.md` (all sections, `done`), `ADR-0059`
(vendoring decision, corrected mid-build once the real package surfaces were read).
Nexus module row: `done`.

Baseline: 573 → 642 TypeScript tests. `tsc --noEmit` and the desktop esbuild bundle
both clean throughout.

## Deviations accepted

- Vendoring scope corrected twice in Phase 2 (installed `@usebruno/requests`, audited
  it, read its real exports, removed it — used `axios` directly) before that phase's
  own TDD work started. ADR-0059 and the Nexus changelog rewritten to match.
- A real path-traversal gap across all five `http.collection.*` RPC methods, found by
  Phase 5's review and closed with a shared containment guard — the task's last
  phase, so fixed rather than deferred with nothing left to catch it later.
- Ask-first ships loopback-only; `run-configurations` host cross-referencing deferred
  and recorded explicitly in `SPEC-http-client.md#boundaries`/`#open-questions` after
  review blocked once on the spec text and shipped scope having drifted apart.
- Three infra crashes (an API 400, a session rate limit, an ECONNRESET) during
  dispatched build-step agents, all recovered by finishing the work directly in the
  orchestrating session rather than discarding progress.
- Smaller, documented-not-silent gaps: `HttpRequest.params` doesn't distinguish
  query/path (Open Question); multipart file-upload fields deferred (tested,
  documented); a delete/send race found and closed same-session via a generation
  counter.

## Reflection

`memory-bank/reflection/http-client.md` — two new learned-rule topics
(`build-dispatch-practices`: resuming in-session after a subagent infra crash, hit
three times this task with the same recovery each time; naming exact risk areas in
review dispatch prompts, which every blocking finding across five phases traced back
to. `security-defaults`: auditing a new npm dependency immediately after install, not
just at spec time; file-path RPC methods needing a containment guard by default).
Extended `spec-writing` (verify full CRUD exists before scoping a consuming UI phase)
and `vendoring-external-assets` (verify a library's actual API surface before
depending on it, not just its name/description). Bumped
`kill-spawned-children-in-finally` to evidence_count 2 — recurred because
`build-tdd-agent`'s own method never reads `_learned/`, only the review gate does.
