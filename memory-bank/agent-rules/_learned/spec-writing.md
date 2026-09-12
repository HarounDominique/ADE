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
