---
slug: explorer-file-type-icons
spec: SPEC-explorer-file-type-icons.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — `/seed:creative`: approved —
  `memory-bank/creative/explorer-file-type-icons-ui-ux.md`. 51 icon files, each verified
  to exist upstream individually (not guessed); 16px sizing; mapping by special filename
  first, then extension; `.ico`/shell/config fall back to the closest real upstream icon
  where no dedicated one exists.
  (satisfies: SPEC-explorer-file-type-icons.md#structure — curation and mechanism)

- [x] Phase 2 — Vendor assets: download the curated SVG subset (files + the one folder
  icon) into `desktop/src/file-icons/`, write `desktop/src/file-icons/LICENSE` with the
  real upstream MIT text and NOTICE per the creative pass, write
  `desktop/src/file-icon-map.js` (`iconForFileName`), update `desktop/build.mjs` to copy
  `file-icons/` into `dist/`. No creative needed — executes Phase 1's decisions.
  (satisfies: SPEC-explorer-file-type-icons.md#structure, #style, #boundaries — assets and mapping half)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions for the
  mapping module's shape and `build.mjs`'s copy step, in this same phase.

- [x] Phase 3 — Wire `renderWorkspaceEntry`'s file and directory branches to
  `iconForFileName`/the vendored folder icon, with the existing glyph as the untouched
  fallback for both. CSS for `.workspace-file-icon`/`.workspace-folder-icon` sizing to
  match the current glyph footprint.
  (satisfies: SPEC-explorer-file-type-icons.md#objective, #structure, #style — rendering half)
  Test strategy: `node --check desktop/src/main.js`; contract-test additions for the
  render-branch lookup/fallback logic, in this same phase.

- [ ] Phase 4 — Verification: full regression (`npm test`), then a manual pass by the
  operator in `npm run desktop:dev` (icons render for several common file types; an
  unmapped extension still shows the plain fallback glyph, not a broken image; the
  folder icon replaces the old glyph for every directory; both light and dark theme
  still look correct — full-color icons are unaffected by theme, confirm that reads
  fine in both) before reporting the task done. No automated GUI clicks — see
  `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-explorer-file-type-icons.md#test-strategy, #boundaries)
  Test strategy: `npm test`, manual pass per this repo's `run` skill convention.

## Execution State

**Build Status**: NOT_STARTED
**Current Phase**: —
**Current Step**: —
**Step Attempts**: {2: 1, 3: 1, 4: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Deviations

- Phase 2: 53 SVGs vendored (not 51 — the creative doc's file list count was slightly
  off from its own enumerated list), totaling 216KB (not the ~150KB estimate) — every
  file verified present, every mapping value cross-checked against an actual vendored
  file (zero missing), every object key checked for duplicates (zero found). Numbers
  only, no design change.
