---
slug: git-init-default-branch-master
spec: SPEC-git-init-default-branch-master.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — `initializeRepository` (`src/application/git/git-mutations.ts`) passes
  `--initial-branch=master` to `git init`. Fast-path: single-line change, no creative
  needed.
  (satisfies: SPEC-git-init-default-branch-master.md#objective, #boundaries)
  Test strategy: `npm run build`; `node --import tsx --test tests/git-mutations.test.ts`;
  full `npm test`; manual pass in `npm run desktop:dev`.

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
