---
slug: windows-reserved-filename-validation
spec: SPEC-windows-reserved-filename-validation.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — `validate_new_entry_name` gains reserved-device-name, forbidden-
  character, and trailing-dot/space rejection; new `WINDOWS_RESERVED_NAMES` const;
  direct unit tests on the function. Fast-path: extending one existing pure function
  and its test coverage, no creative needed.
  (satisfies: SPEC-windows-reserved-filename-validation.md#objective, #structure,
  #style, #boundaries)
  Test strategy: `cargo test` (`desktop/src-tauri`); manual pass in `npm run
  desktop:dev` (type `CON` into New File, confirm a clear refusal).

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
