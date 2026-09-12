---
slug: disable-fetch-origin-without-remote
spec: SPEC-disable-fetch-origin-without-remote.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — `hasGitRemote` state set from `git.workspace`'s existing `remotes`
  field; `renderCommitControls()` disables `#git-fetch-origin` accordingly. Fast-path:
  single new state variable, one new disabled-check, no creative needed.
  (satisfies: SPEC-disable-fetch-origin-without-remote.md#objective, #boundaries)
  Test strategy: `node --check desktop/src/main.js`; contract-test addition in
  `tests/desktop-ui-contract.test.ts`; manual pass in `npm run desktop:dev`.

## Execution State

**Build Status**: DONE
**Current Phase**: 1
**Current Step**: 6/6
**Step Attempts**: {2: 1, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: NO — complete, awaiting operator confirmation in `npm run desktop:dev`

## Deviations

None.

## Reflection (inline, fast-path)

`#git-fetch-origin` was simply never wired to any disabled state at all -- not a
regression, an original gap. `#git-push-origin`'s correct-looking behavior was
incidental (empty unpushed-commits set with no remote), not an explicit check, which
is why the asymmetry wasn't obvious from reading either button in isolation. No new
rule extracted -- a plain missing check, not a recurring failure pattern.
