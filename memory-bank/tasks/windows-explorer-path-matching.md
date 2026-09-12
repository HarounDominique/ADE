---
slug: windows-explorer-path-matching
spec: SPEC-windows-explorer-path-matching.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — `pathsEqual()` in `paths.js`; all three Explorer path-matching call
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

**Build Status**: DONE
**Current Phase**: 1
**Current Step**: 6/6
**Step Attempts**: {2: 1, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: NO — complete; no live manual verification possible (Windows-only bug
on a macOS development machine), covered by the unit test instead

## Deviations

- The new test file's import from `desktop/src/paths.js` initially failed `tsc
  --noEmit` (TS7016, no declaration file) until spotting the established convention
  `tests/project-context.test.ts` already uses for this exact situation
  (`// @ts-expect-error The browser-loaded helper has no declaration file by design.`)
  and mirroring it. Not a design deviation, just a missed existing convention on first
  pass.
