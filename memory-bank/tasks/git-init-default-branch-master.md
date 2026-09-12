---
slug: git-init-default-branch-master
spec: SPEC-git-init-default-branch-master.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — `initializeRepository` (`src/application/git/git-mutations.ts`) passes
  `--initial-branch=master` to `git init`. Fast-path: single-line change, no creative
  needed.
  (satisfies: SPEC-git-init-default-branch-master.md#objective, #boundaries)
  Test strategy: `npm run build`; `node --import tsx --test tests/git-mutations.test.ts`;
  full `npm test`; manual pass in `npm run desktop:dev`.

## Execution State

**Build Status**: DONE
**Current Phase**: 1
**Current Step**: 6/6
**Step Attempts**: {2: 1, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: NO — complete, awaiting operator confirmation in `npm run desktop:dev`

## Deviations

None. Confirmed the bug directly against real `git` (`git init` on this machine
produces `main`) before writing the fix — the operator's report was the trigger, not
the only evidence.
