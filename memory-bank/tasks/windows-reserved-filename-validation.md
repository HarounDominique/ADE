---
slug: windows-reserved-filename-validation
spec: SPEC-windows-reserved-filename-validation.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — `validate_new_entry_name` gains reserved-device-name, forbidden-
  character, and trailing-dot/space rejection; new `WINDOWS_RESERVED_NAMES` const;
  direct unit tests on the function. Fast-path: extending one existing pure function
  and its test coverage, no creative needed.
  (satisfies: SPEC-windows-reserved-filename-validation.md#objective, #structure,
  #style, #boundaries)
  Test strategy: `cargo test` (`desktop/src-tauri`); manual pass in `npm run
  desktop:dev` (type `CON` into New File, confirm a clear refusal).

## Execution State

**Build Status**: DONE
**Current Phase**: 1
**Current Step**: 6/6
**Step Attempts**: {2: 1, 3: 0, 4: 0}
**Last Block Rule**: none
**Can Resume**: NO — complete, `cargo test` 51/51 green, `npm test` 524/524 green

## Deviations

- Dropped the planned trailing-space rejection: `validate_new_entry_name`'s existing
  `name.trim()` (pre-dating this task) already strips a trailing space before any new
  check would see it, so asserting that case would test something structurally
  unreachable rather than guard real behavior. Kept only the trailing-dot check, which
  `trim()` does not touch. Caught while writing the RED test, before it was ever run.
- The test module imports functions via an explicit named list
  (`use super::{...}`), not a glob — missed on the first pass (assumed `use super::*;`
  by convention from other Rust codebases), caught immediately by the RED run's
  compile error and fixed by adding `validate_new_entry_name` to that list.
