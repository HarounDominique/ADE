---
slug: add-java-class-jar-icons
spec: SPEC-add-java-class-jar-icons.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Vendor `javaclass.svg`/`jar.svg`, add both entries to
  `file-icon-map.js`. Fast-path: two-entry addition, no creative needed.
  (satisfies: SPEC-add-java-class-jar-icons.md#objective, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; `npm test`; cross-check mapping
  values against vendored files.

## Execution State

**Build Status**: DONE
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

None — matched the spec exactly.

## Reflection (fast-path, inline)

Operator noticed the gap directly (asked "is there an icon for .class?"). Same
verify-first discipline as the parent task: checked upstream existence before adding
either entry. Not novel — this is exactly what
`agent-rules/_learned/vendoring-external-assets.md` already names as the ongoing
extension path for this mapping.
