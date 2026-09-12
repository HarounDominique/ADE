---
topic: spec-writing
priority: low
---

### spec-assumption-verification
_derived_from: reflection/explorer-new-file-folder.md · evidence_count: 1 · last_validated: 2026-09-12_

When a spec assumption concretizes an ambiguous UI/state concept (e.g. "the currently
selected directory"), grep the actual codebase for that state before writing the
assumption down. Silently narrowing to the nearest state that already exists (e.g. file
selection, when no directory-selection concept exists yet) produces a spec the build
satisfies exactly, but that ships functionally incomplete against what the requester
actually meant — surface the gap as an explicit assumption for human confirmation instead
of quietly picking the easiest-to-implement reading.

### mutating-operation-feedback
_derived_from: reflection/explorer-selection-and-drag-drop.md, reflection/explorer-delete-and-rename.md · evidence_count: 2 · last_validated: 2026-09-12_

When a spec covers a mutating UI operation (create, move, rename, delete), its Boundaries
must state explicitly what visible feedback proves the operation succeeded and what
UI/selection state needs to follow the mutated path — not leave it implicit. Two separate
gaps in one task took this exact shape: a full tree-reload silently re-collapsing the
target directory (operator had to notice and ask), and a moved item's stale selection
state pointing at a path that no longer existed (caught only in review). Ask "what does
the operator see that confirms this worked" as its own spec question, every time.

Second occurrence (`explorer-delete-and-rename`): `selectedDirectoryPath` was correctly
cleared on an affecting delete/rename but the symmetric `selectedFilePath` case was
missed in the first draft — same shape of stale reference, this time caught in review
before the operator ever saw it. That task's manual-verification pass raised zero
follow-ups, the first of its arc to do so.

### mirror-pattern-verification
_derived_from: reflection/offer-git-init-when-no-vcs.md · evidence_count: 2 · last_validated: 2026-09-12_

When a spec's Style section says a new code path "mirrors" an existing one, verify the
existing one is actually correct for the property that matters, don't just check it
looks similar. `offer-git-init-when-no-vcs`'s spec gave a literal snippet chaining
`.then()` straight off `nativeInvoke('sidecar_request', ...)`, claiming to mirror
create-branch/push-origin — but Rust's `sidecar_request` is fire-and-forget (writes to
stdin, returns before the response arrives), and the real create-branch/push-origin
handlers only read correctly because they go through a separate `sendContextRequest` +
event-listener correlation the snippet skipped. The build phase implemented the spec
exactly and shipped the bug. Also: when a feature's entire purpose is to produce a state
the app has never been in before (here: a Git repository with zero commits — every prior
Project already had one by construction), "an existing pattern already covers this" is
specifically the wrong inference, since that pattern was only ever proven against the
old state.

Second occurrence (`create-branch-from-dropdown`): `inspectGitWorkspace`'s
`for-each-ref refs/heads` call hit the identical zero-commit-repository invariant, a
third independent git read path (after `git diff HEAD` and `git log`) broken by the
same state, discovered a full task later on the very Project the operator used to test
the *first* task's own fix. Confirms this is not a one-off spec gap but a durable blind
spot: every git read path in this codebase needs its own independent check against a
zero-commit repository, not an inference from sibling paths already fixed.
