---
slug: image-and-html-preview
spec: SPEC-image-and-html-preview.md
status: approved
---

## Implementation Roadmap

- [ ] Phase 1 — Raster image preview: extend `read_file_in`
  (`desktop/src-tauri/src/lib.rs`) with a narrow image-extension whitelist
  (`png`/`jpg`/`jpeg`/`gif`/`webp`/`bmp`/`ico`) that returns bytes under the existing
  `MAX_FILE_PREVIEW_BYTES` cap instead of falling into `kind: "binary"`; every other
  binary extension is unchanged. New Rust unit tests proving both halves (whitelisted
  extension returns bytes; a non-whitelisted binary still returns `binary`/`None`).
  Frontend: `isImagePath`, `<img>` fed by the new byte route, `@panzoom/panzoom` (4.6.2,
  MIT) for pan/zoom; add the dependency to `desktop/package.json` and its row to
  `desktop/THIRD_PARTY_LICENSES.md`. `Open externally` keeps working unchanged.
  No creative needed — ADR-0060 already fixed the transport shape and the whitelist.
  (satisfies: SPEC-image-and-html-preview.md#structure, #style, #boundaries)
  Test strategy: `cargo check`, `cargo test` (the two new classification tests plus the
  full existing suite unchanged), `node --check desktop/src/main.js`,
  `tests/desktop-ui-contract.test.ts` additions, manual pan/zoom + `Open externally`
  check in `npm run desktop:dev`.

- [ ] Phase 2 — SVG preview toggle: `isSvgPath`; `Preview` renders the already-read text
  content via `new Blob([content], { type: 'image/svg+xml' })` +
  `URL.createObjectURL` into an `<img>` (a `<script>` inside the SVG does not execute
  there, by platform design — no sandboxing code needed); `Source` shows the existing
  CodeMirror XML/HTML view. No backend change — SVG already classifies `kind: "text"`.
  No creative needed.
  (satisfies: SPEC-image-and-html-preview.md#structure, #boundaries)
  Test strategy: `node --check desktop/src/main.js`,
  `tests/desktop-ui-contract.test.ts` additions, manual toggle check in
  `npm run desktop:dev`.

- [ ] Phase 3 — HTML preview toggle (security-critical): `isHtmlPath`; `Preview` renders
  inside `<iframe sandbox srcdoc="...">` **without** `allow-scripts`; `Source` reuses the
  existing `@codemirror/lang-html` surface (`ADR-0023`) — no new editor. New
  `tests/html-preview.test.ts`, mirroring `tests/markdown-preview.test.ts`'s method:
  lift the `srcdoc`/sandbox-attribute builder from the shipped bundle and assert
  `allow-scripts` is never present and an embedded `<script>` never reaches an
  executable context. No creative needed — ADR-0060 already rejected
  `allow-scripts`/DOMPurify for this phase.
  (satisfies: SPEC-image-and-html-preview.md#structure, #test-strategy, #boundaries)
  Test strategy: `node --check desktop/src/main.js`, new `tests/html-preview.test.ts`,
  `tests/desktop-ui-contract.test.ts` additions, manual check in `npm run desktop:dev`
  with an `.html` containing `<script>alert(1)</script>` — `Preview` must not alert.

- [ ] Phase 4 — Mermaid diagram rendering: add `mermaid` (12.0.0, MIT) to
  `desktop/package.json` and its row to `desktop/THIRD_PARTY_LICENSES.md`. New
  `markdown-it` core rule alongside `markdownHeadingAnchors`/`markdownTaskLists`
  detecting fenced ` ```mermaid ` blocks and replacing them with `mermaid.render(...)`'s
  inline SVG output; a standalone `.mmd` file reuses the same render call on its full
  source text, with `Source` still reachable via the toggle. Mermaid only ever executes
  its own diagram DSL, never arbitrary file content. No creative needed.
  (satisfies: SPEC-image-and-html-preview.md#structure, #boundaries)
  Test strategy: `node --check desktop/src/main.js`,
  `tests/desktop-ui-contract.test.ts` additions, manual check in `npm run desktop:dev`
  with a ` ```mermaid ` fence inside a `.md` and a standalone `.mmd` file.

- [ ] Phase 5 — Verification: full regression (`npm test`, `cargo test`), then one
  manual pass by the operator in `npm run desktop:dev` covering all four formats in the
  same session (PNG pan/zoom, SVG toggle, HTML toggle with the `<script>` non-execution
  check, Mermaid fence + standalone `.mmd`), plus a check that
  `desktop/THIRD_PARTY_LICENSES.md` lists both new dependencies. No automated GUI
  clicks — see `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
  (satisfies: SPEC-image-and-html-preview.md#test-strategy, #boundaries)
  Test strategy: `npm test`, `cargo test`, manual pass per this repo's `run` skill
  convention.

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
