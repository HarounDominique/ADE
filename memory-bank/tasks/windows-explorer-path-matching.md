---
slug: windows-explorer-path-matching
spec: SPEC-windows-explorer-path-matching.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — `pathsEqual()` in `paths.js`; all three Explorer path-matching call
  sites in `main.js` switch from `===` to it; new `tests/paths.test.ts`. Fast-path:
  single new utility function plus a mechanical swap at three call sites, no creative
  needed.
  (satisfies: SPEC-windows-explorer-path-matching.md#objective, #structure, #style,
  #boundaries)
  Test strategy: `node --import tsx --test tests/paths.test.ts`; `node --check
  desktop/src/main.js`; full `npm test`. No live manual verification possible
  (Windows-only bug, macOS development machine) — the unit test with a Windows-shaped
  path string is the regression guard.

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
