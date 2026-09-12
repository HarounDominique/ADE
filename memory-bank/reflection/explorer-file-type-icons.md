# Reflection: explorer-file-type-icons

## Step 1 — Implementation vs. spec

Everything in `SPEC-explorer-file-type-icons.md` shipped: local-only vendored assets, real
MIT attribution naming the actual upstream project, curated (not full-pack) coverage,
`<img>` rendering with the existing CSS glyph as an untouched fallback for anything
unmapped, one static folder icon regardless of expand state, and — critically — no
brand/licensed-product comparison anywhere in any committed file (checked explicitly,
twice, across every new file).

Two deviations, both operator-requested during Phase 4 manual verification rather than
gaps the operator merely noticed:

1. The default folder icon's upstream color (a brown/tan `#8d6e63`) read as "raro" —
   recolored to blue via a direct edit to the vendored SVG's own fill values (permitted
   under MIT modification, still fully attributed). Not something the spec anticipated,
   since the spec never described a color, only "a matching vendored folder icon."
2. Coverage was explicitly named "curated ~50-80" in the spec; the operator asked for
   broader coverage after seeing real gaps (`.db`, `.gitkeep`, sourcemaps, then a general
   "cover more"). Expanded twice — 53→56 (targeted misses), then 56→144 (systematic
   sweep across ~15 more language/tooling categories) — every one of the 142 unique icon
   references checked against the upstream file listing before being written, not
   guessed. Zero broken references across the whole expansion, confirmed by an automated
   cross-check (every mapping value against the actual vendored files) at each step.

## Step 2 — Workflow evaluation

- **Complexity routing**: "designed" tier fit — the icon-set/license choice and the
  curation-vs-mechanism split were both real open decisions, correctly routed through
  `/seed:creative`. Not mis-routed.
- **Sharding**: no build step needed context its own step file lacked.
- **Spec correction mid-build**: none needed — the spec's Boundaries already permitted
  exactly what happened ("curated... revisit only if the operator wants broader coverage
  than the curated list turns out to provide," "ask first" on the recolor question was
  answered affirmatively in the moment). The spec anticipated its own extension points
  correctly; this is spec-writing working as intended, not a gap.
- **What made the mid-verification expansion safe to do quickly**: the exact same
  discipline used in Phase 1/2 — verify every candidate filename against the upstream
  listing *before* writing any mapping entry — scaled cleanly to 3x the original size
  with zero broken icons. Worth naming explicitly as a rule, since it is the concrete
  practice (not just "be careful") that made a large, fast expansion safe.

## Step 3 — Patterns extracted

New topic file:

- `vendoring-external-assets.md` → `verify-before-mapping`
