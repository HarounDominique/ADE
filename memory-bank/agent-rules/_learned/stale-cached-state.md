---
topic: stale-cached-state
priority: low
---

### mutation-must-refresh-what-it-invalidates
_derived_from: reflection/offer-git-init-when-no-vcs.md · evidence_count: 1 · last_validated: 2026-09-12_

When a mutation changes a fact about an entity that is also cached/persisted elsewhere
(a database row, a registry, an in-memory snapshot), the mutation is not done once the
primary write succeeds — every cached copy of that fact must be refreshed too, or a
later read of the cache will silently reintroduce the stale value. `git.init`
(`src/desktop-sidecar.ts`) correctly ran `git init` on the filesystem, but a
registered Project's `versionControl` is also persisted in `src/persistence/
sqlite-store.ts` at registration time and never re-read afterward; every later
`project.snapshot` read kept answering the old value and overwrote the correct live one
the frontend had just fetched. Before calling a mutation complete, grep for every other
place the fact it changes is stored or cached, not just the one place it was written.
