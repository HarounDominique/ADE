# Archive: explorer-file-type-icons

**Spec**: `memory-bank/specs/SPEC-explorer-file-type-icons.md`
**Task**: `memory-bank/tasks/explorer-file-type-icons.md`
**Creative**: `memory-bank/creative/explorer-file-type-icons-ui-ux.md`
**Reflection**: `memory-bank/reflection/explorer-file-type-icons.md`
**Branch**: `feature/explorer-file-type-icons`

## What was built

Per-file-type icons in the Explorer tree, replacing the single generic glyph. 144 SVGs
vendored from a real MIT-licensed open-source icon project (full attribution + license
text in `desktop/src/file-icons/LICENSE`), each individually verified to exist upstream
before inclusion — none guessed. `desktop/src/file-icon-map.js` maps 163 special
filenames and extensions to a vendored icon; an unmapped file keeps the original
CSS-drawn generic glyph. The directory glyph is replaced by one static vendored folder
icon (no open/closed variant — the tree's existing arrow rotation already communicates
that), recolored from the upstream brown default to blue matching this app's own accent.
`desktop/build.mjs` copies the whole `file-icons/` directory into `dist/`.

## Satisfies

`SPEC-explorer-file-type-icons.md` — Objective, Structure, Style, Test strategy, and
Boundaries, in full. No brand/licensed-product name appears anywhere in the shipped
code, comments, specs, or commits — checked explicitly.

## Deviations accepted

1. Default folder icon recolored (upstream brown → blue matching this app's accent) —
   operator-requested during manual verification, a direct edit to the vendored SVG's
   own fill values, permitted under its MIT license.
2. Coverage expanded from the spec's "curated ~50-80" to 144 icons / 163 mapped entries
   across two rounds, both operator-requested during the same manual-verification phase
   rather than deferred to a new task — the spec's own Boundaries named this as the
   expected revisit path. Every value verified against the upstream listing before being
   written; zero broken icon references across the full expansion.

## Follow-up

None outstanding. A small, unrelated visual bug the operator noticed in passing (the
sidebar-collapse chevron overlapping the last nav icon when the sidebar itself is
collapsed) is tracked as its own separate fast-path task, not folded into this one.
