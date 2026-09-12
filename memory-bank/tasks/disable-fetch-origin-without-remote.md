---
slug: disable-fetch-origin-without-remote
spec: SPEC-disable-fetch-origin-without-remote.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — `hasGitRemote` state set from `git.workspace`'s existing `remotes`
  field; `renderCommitControls()` disables `#git-fetch-origin` accordingly. Fast-path:
  single new state variable, one new disabled-check, no creative needed.
  (satisfies: SPEC-disable-fetch-origin-without-remote.md#objective, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; contract-test addition in
  `tests/desktop-ui-contract.test.ts`; manual pass in `npm run desktop:dev`.

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
