---
topic: security-defaults
priority: high
---

### audit-new-npm-dependencies-before-committing-to-them
_derived_from: reflection/http-client.md · evidence_count: 1 · last_validated: 2026-09-14_

Run `npm audit` immediately after `npm install`ing any new dependency during a build
phase, before writing code against it — not only at spec time, and not only when
something feels risky. `http-client` Phase 2 installed `@usebruno/requests` on the
strength of an earlier spec-time survey; `npm audit` right after install surfaced two
high-severity CVEs (axios prototype pollution enabling Basic-auth header injection, a
faker RCE) in its transitive dependencies. Reading the package's actual exported
surface (not just its name/description) then showed it covered OAuth2/Digest/gRPC/
WebSocket — none of which this module's own contract needed — so the real fix wasn't
pinning around the CVEs, it was removing the unnecessary dependency entirely and using
`axios` directly. Both steps (audit, then verify the surface is actually needed) belong
immediately after every `npm install` in a build phase, not deferred to review.

### file-path-rpc-methods-need-containment-guards-by-default
_derived_from: reflection/http-client.md · evidence_count: 1 · last_validated: 2026-09-14_

Any sidecar/backend method that joins an operator- or webview-editable string onto a
filesystem root (`join(repositoryPath, ".ade", "<module>", userSuppliedPath)`) needs a
resolve-and-verify-containment guard (resolve the joined path, confirm it still starts
with the resolved root) before touching the filesystem — treat this as a default
requirement for the method's own review, not something to add only if a reviewer
happens to think of path traversal. `http-client`'s five `http.collection.*` RPC
methods all built their path this way with no guard for four build phases; the gap was
real and live (a save-dialog text input fed `collectionPath` as free text with nothing
sanitizing it), caught only when Phase 5's review was explicitly asked to trace
reachability rather than just note the shared shape. Write the guard once as a shared
helper the first time a module gains more than one such method, and use it from the
first call site, not retrofitted after the fact.
