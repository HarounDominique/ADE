---
slug: add-java-class-jar-icons
spec: SPEC-add-java-class-jar-icons.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Vendor `javaclass.svg`/`jar.svg`, add both entries to
  `file-icon-map.js`. Fast-path: two-entry addition, no creative needed.
  (satisfies: SPEC-add-java-class-jar-icons.md#objective, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; `npm test`; cross-check mapping
  values against vendored files.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

[Anything a build phase did differently from what the spec/plan predicted, and whether
it was accepted, and by whom.]
