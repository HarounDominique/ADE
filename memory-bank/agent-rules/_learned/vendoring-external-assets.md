---
topic: vendoring-external-assets
priority: medium
---

### verify-before-mapping
_derived_from: reflection/explorer-file-type-icons.md · evidence_count: 1 · last_validated: 2026-09-12_

When vendoring named assets from an external catalog (icon packs, font files, any
by-name asset set), build and verify the exact list of filenames against the upstream
source *before* writing any code that references them by name — never guess a plausible
filename and let a missing-file bug surface later. This scaled cleanly from a 53-icon
curated set to 144 with zero broken references, entirely because every one of the 142
unique values was checked to exist upstream first, and cross-checked again (every
mapping value against the actually-vendored files) after writing the mapping.
