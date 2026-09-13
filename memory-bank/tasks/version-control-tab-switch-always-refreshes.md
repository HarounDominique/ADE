---
slug: version-control-tab-switch-always-refreshes
spec: SPEC-version-control-tab-switch-always-refreshes.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Add the missing `requestVersionControlData(workspaceRootPath, { force: true })`
  call to the keyboard tab-navigation handler, and `{ force: true }` to `showView`'s
  `view === 'changes'` call. Fast-path: two call sites, no design fork.
  (satisfies: SPEC-version-control-tab-switch-always-refreshes.md#structure, #style)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions; full
  `npm test`; manual verification in `npm run desktop:dev`.

## Execution State

**Build Status**: DONE
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 0, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

None. Manual verification in `npm run desktop:dev` still pending before archive.
