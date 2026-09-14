---
topic: security-defaults
priority: high
---

### audit-new-npm-dependencies-before-committing-to-them
_derived_from: reflection/http-client.md, reflection/image-and-html-preview.md · evidence_count: 2 · last_validated: 2026-09-14_

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

**Second occurrence, same rule, still skipped at implementation time:** `image-and-
html-preview` Phase 4 installed `mermaid@12.0.0` and moved straight to implementation
without running `npm audit` — the rule above already existed in this same file and was
not self-applied by the build-TDD dispatch; it was only caught reactively by the
build-review step, one phase-cycle later than it should have been. `npm audit` found
5 high-severity CVEs the dependency actually introduced (`mermaid → chevrotain →
lodash-es@4.17.23`, an exact pin, code injection + prototype pollution — patched
releases `4.18.0`/`4.18.1` existed but chevrotain's exact pin never picked them up),
resolved without downgrading the pinned major version via `"overrides": { "lodash-es":
"^4.18.1" }` in `package.json`, re-verified by a direct chevrotain smoke test against
the overridden version. Conclusion: a rule in this file is not self-enforcing — a
build-TDD dispatch prompt that adds a new npm dependency must explicitly include "run
`npm audit` right after `npm install`, before writing implementation code" as an
instruction, not assume the agent will recall this file's contents unprompted.

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
