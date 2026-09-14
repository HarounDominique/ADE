# Archive: image-and-html-preview

**Status:** DONE, merged into `master`.
**Spec:** [SPEC-image-and-html-preview.md](../specs/SPEC-image-and-html-preview.md)
**ADR:** [ADR-0060](../../docu/adr/0060-image-and-html-preview.md) — design decision,
accepted before this task's spec was written.
**Reflection:** [reflection/image-and-html-preview.md](../reflection/image-and-html-preview.md)

## What was built

The internal Editor gained four preview surfaces it previously either refused
(raster image, classified `binary`, no bytes sent) or only opened as plain code text
(SVG, HTML):

- **Raster image** (PNG/JPEG/GIF/WEBP/BMP/ICO): a new whitelisted byte route on
  `read_file_in`, under the existing 2 MiB cap; `<img>` preview with pan/zoom via
  `@panzoom/panzoom` (4.6.2, MIT). `Open externally` unchanged.
- **SVG**: the same `Preview`/`Source` toggle Markdown already had, rendering the
  already-read text content via `Blob`+`createObjectURL` into an `<img>` — no backend
  change, no sandboxing code needed (an `<img>`-loaded SVG cannot execute embedded
  script, by platform design).
- **HTML** (security-critical): the same toggle, `Preview` inside an
  `<iframe sandbox srcdoc>` with the sandbox attribute left empty/bare — the maximally
  restrictive form, `allow-scripts` never present, so an embedded `<script>` in an
  untrusted `.html` file in the workspace tree never executes. `Source` reuses the
  existing CodeMirror `lang-html` surface (ADR-0023) — no new editor.
  This is the same trust invariant `tests/markdown-preview.test.ts` already enforces
  for Markdown ("a document in the tree is untrusted input, so its HTML is never
  executed"), now held for a second format by a different mechanism (platform sandbox
  instead of content escaping).
- **Mermaid diagrams**: a ` ```mermaid ` fence inside a Markdown document, or a
  standalone `.mmd` file, renders to SVG client-side via `mermaid` (12.0.0, MIT),
  `securityLevel: 'strict'` set explicitly. Only ever executes its own diagram DSL,
  never arbitrary file content.

## Spec satisfaction

All acceptance criteria in `SPEC-image-and-html-preview.md`'s Test strategy and
Boundaries sections are met — see the task file's per-phase `(satisfies: ...)`
annotations for the exact heading each phase closes. Full regression at close:
672 TypeScript tests, 53 Rust tests (one pre-existing, environment-specific PTY
timing test excluded, confirmed unrelated to this task on unmodified `master` too).

## Deviations accepted

Recorded in full in `memory-bank/tasks/image-and-html-preview.md`'s Deviations
section; summarized:

- `kind: "image"` as the literal classification string (not named in spec/ADR).
- No new Rust crate for base64 — a ~15-line hand-rolled encoder, reading the spec's
  "ask first before a new dependency" boundary as covering the backend too.
- SVG/HTML/Mermaid toggles built as three parallel clones of Markdown's toggle
  machinery rather than one shared, parameterized implementation — a reasoned,
  reviewed tradeoff (avoided touching already-pinned Markdown tests), but real
  duplication debt, flagged for future consolidation (see reflection).
- Phase 4 review found and fixed two real issues before merge: a stale-async-render
  race (tab switches mid-`mermaid.render()` could overwrite the wrong document's
  preview — fixed with a `previewRenderGeneration` guard, the same pattern
  `http-client`'s HTTP-response staleness guard already used) and a missed `npm audit`
  on the new `mermaid` dependency (5 high-severity transitive CVEs via
  `chevrotain@11.1.2 → lodash-es@4.17.23`, fixed with a `lodash-es` override to the
  patched `4.18.1`, without downgrading `mermaid` off ADR-0060's pinned v12).
- A workflow-level incident, unrelated to the implementation itself: mid-Phase-5, this
  task's branch was found to have absorbed 10 unrelated commits from a concurrent
  session's own work ("vendor dual-host seed plugin"), landed directly on this
  branch's name in the shared working directory before this task's first commit.
  Resolved with the operator's confirmation: preserved intact on its own branch
  (`feature/dual-host-seed-plugin`, pushed to origin), dropped from this branch via a
  clean rebase (no conflicts, no file overlap), re-verified green (672/672) after.

## Workflow learnings

Four rules extracted to `agent-rules/_learned/` — see
[reflection/image-and-html-preview.md](../reflection/image-and-html-preview.md) Step 3
for the full list and reasoning. Headline: every non-trivial finding in this task
(the async race, the missed audit, the toggle duplication, the branch contamination)
was caught one step later than it should have been — by review instead of by the step
that created the condition. Rules now point at the earlier step in each case.
