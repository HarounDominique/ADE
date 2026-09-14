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

### read-paths-must-tolerate-external-drift
_derived_from: reflection/handle-git-repository-removed.md · evidence_count: 1 · last_validated: 2026-09-12_

The mirror image of the rule above: a read path that assumes a resource still has the
shape it had the last time it was checked will break the moment that assumption is
falsified by something *outside* the app's control, not just by the app's own
mutations. `inspectGitWorkspace`/`inspectPendingGitChanges` (`src/application/git/`)
both assumed a Project's `.git` directory still existed — true when the Project was
registered, false the moment an operator deleted it from Finder/terminal/another tool
while Assay still held it open, including discovered by an unattended background poll
with no operator action in progress. Any read path over state this app does not
exclusively own (the filesystem, in this case) needs its own up-front liveness check,
not just a guard on the app's own cached belief about that state.

### async-render-needs-a-generation-guard
_derived_from: reflection/image-and-html-preview.md · evidence_count: 1 · last_validated: 2026-09-14_

A third variant of the same family: when a UI re-render is triggered by a *slow, real*
async computation (not a cached/near-instant one), the write of that computation's
result into a shared DOM target must re-check the target is still current before
writing — otherwise a slow pass for entity A can resolve after a fast pass for entity B
already finished, and overwrite B's correct state with A's stale one. `image-and-html-
preview` Phase 4 added Mermaid diagram rendering (`mermaid.render(...)`, genuinely slow
— DSL parse + SVG layout, unlike the synchronous SVG/HTML preview paths built in the
same task) without this guard: switching tabs mid-render let an earlier document's
diagram silently overwrite the tab the user had already switched to, both for a
standalone `.mmd` preview and for markdown-fence placeholder ids colliding across
documents at the same fence position. Caught by build-review, not by the TDD pass that
introduced it — the codebase already had the fix pattern (`httpRequestExecuteGeneration`/
`httpEditorGeneration`, an HTTP-response staleness guard from the `http-client` task)
sitting unused nearby. Before adding *any* new async render/write path (not just HTTP
responses), check whether the target it writes to is still the current one, using this
codebase's existing generation-counter pattern rather than inventing a new mechanism —
and a build-TDD dispatch prompt for a phase adding async rendering should name this
requirement explicitly rather than leaving it to be discovered by review.
