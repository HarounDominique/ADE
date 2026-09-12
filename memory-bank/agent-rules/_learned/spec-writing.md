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
_derived_from: reflection/explorer-selection-and-drag-drop.md · evidence_count: 1 · last_validated: 2026-09-12_

When a spec covers a mutating UI operation (create, move, rename, delete), its Boundaries
must state explicitly what visible feedback proves the operation succeeded and what
UI/selection state needs to follow the mutated path — not leave it implicit. Two separate
gaps in one task took this exact shape: a full tree-reload silently re-collapsing the
target directory (operator had to notice and ask), and a moved item's stale selection
state pointing at a path that no longer existed (caught only in review). Ask "what does
the operator see that confirms this worked" as its own spec question, every time.
