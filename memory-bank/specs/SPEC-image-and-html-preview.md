# SPEC: Image, SVG, HTML and Mermaid Preview

status: approved

## Objective

Give the internal Editor preview surfaces for content types `SPEC-file-workspace.md`
today either refuses (raster image — classified `binary`, no bytes sent) or only opens
as plain code text (SVG, HTML): a raster image (PNG/JPEG/GIF/WEBP/BMP/ICO) opens with an
`<img>` preview and pan/zoom; `.svg` and `.html`/`.htm` gain the same `Preview`/`Source`
toggle Markdown already has; a ` ```mermaid ` fence inside a Markdown document, or a
standalone `.mmd` file, renders its diagram to SVG. The decision, the rejected
alternatives (DOMPurify, an `allow-scripts` iframe, OpenSeadragon, server-side PlantUML)
and the license verification are already fixed in **ADR-0060**
(`docu/adr/0060-image-and-html-preview.md`) and propagated into
`docu/specs/SPEC-file-workspace.md` (Product contract, Native boundary, Out of scope,
Acceptance criteria 11-14). This spec turns that already-accepted decision into buildable
phases — it does not re-derive it. Success: PNG, SVG, HTML and Mermaid diagrams open
readable inside Assay without leaving to an external app, and the same invariant
`tests/markdown-preview.test.ts` already enforces for Markdown — *no document in the tree
executes its own embedded script during preview* — holds for every format this task adds.

## Commands

- Backend type-check: `cd desktop/src-tauri && cargo check`
- Backend unit tests: `cd desktop/src-tauri && cargo test`
- Frontend syntax check: `node --check desktop/src/main.js`
- Frontend rebuild (for manual verification): `cd desktop && node build.mjs`
- Full app, manual run: `npm run desktop:dev` — GUI behavior verified by the operator
  directly.
- Contract/regression suite: `npm test` (repo root)

## Structure

- **Backend — `desktop/src-tauri/src/lib.rs`**:
  - `read_file_in` (`~line 798`) classifies by content today: a null byte or invalid
    UTF-8 returns `kind: "binary"` with `content: None`. This task adds a narrow
    exception *before* that check: a whitelisted image extension (`png`, `jpg`/`jpeg`,
    `gif`, `webp`, `bmp`, `ico`) returns its bytes (base64) under the same
    `MAX_FILE_PREVIEW_BYTES` cap already enforced for text, instead of falling into
    `binary`. Every other binary extension is untouched — still `kind: "binary"`,
    `content: None`.
  - `.svg` needs no backend change: it is valid UTF-8 XML with no null bytes, so it
    already classifies `kind: "text"` and its content already reaches the frontend.
  - New unit tests alongside `read_file_classifies_binary_content_without_returning_bytes`
    (`~line 2015`): a whitelisted image extension returns bytes; a non-whitelisted binary
    (e.g. `.bin`) still returns `kind: "binary"`, `content: None` — proving the exception
    is narrow, not a general binary-passthrough.
- **Frontend — `desktop/src/main.js`**:
  - `isImagePath(path)` / `isSvgPath(path)` / `isHtmlPath(path)` helpers, same shape as
    the existing `isMarkdownPath` (`~line 2676`).
  - The `Preview`/`Source` toggle generalizes `markdownPreviewVisible()`'s pattern
    (`~line 2730`, localStorage-backed preference) to SVG and HTML, namespaced per
    format so switching a Markdown tab's preference doesn't flip an HTML tab's.
  - Raster image preview: `<img>` fed by the new backend byte command, wrapped in
    `@panzoom/panzoom` for pan/zoom.
  - SVG preview: `new Blob([content], { type: 'image/svg+xml' })` +
    `URL.createObjectURL` into an `<img>` — the content is already in hand from the
    existing text-read path, no new backend call.
  - HTML preview: `<iframe sandbox srcdoc="...">` **without** `allow-scripts`, filled
    with the document's already-read text content; `Source` reuses the existing
    `@codemirror/lang-html` surface (`ADR-0023`) — no new editor.
  - Mermaid: a new `markdown-it` core rule alongside `markdownHeadingAnchors` /
    `markdownTaskLists` (`~line 2718-2727`) that detects fenced ` ```mermaid ` blocks and
    replaces them with `mermaid.render(...)`'s inline SVG. A standalone `.mmd` file
    reuses the same render call directly on its full source text; `Source` stays
    reachable via the same toggle.
- **`desktop/package.json`**: `@panzoom/panzoom` (4.6.2, MIT) and `mermaid` (12.0.0,
  MIT) as new dependencies — verified in ADR-0060.
- **`desktop/THIRD_PARTY_LICENSES.md`**: two new rows for the packages above.
- **Tests**:
  - `tests/html-preview.test.ts` (new), mirroring `tests/markdown-preview.test.ts`'s
    method — lift the `srcdoc`/sandbox-attribute builder out of the shipped bundle and
    assert `allow-scripts` is never present, and that a `<script>` in the source content
    never reaches an executable context.
  - `tests/desktop-ui-contract.test.ts` gains assertions for the new toggle markup per
    format.

## Style

Backend classification this task extends (`desktop/src-tauri/src/lib.rs`):

```rust
let bytes = std::fs::read(&file).map_err(|error| format!("Unable to read file: {error}"))?;
if bytes.contains(&0) {
    return Ok(FileReadResult {
        path: file.to_string_lossy().into_owned(),
        relative_path,
        name,
        kind: "binary".to_string(),
        size,
        content: None,
        message: Some("This file cannot be previewed as text".to_string()),
    });
}
```

Frontend detection helper this task's `isImagePath`/`isSvgPath`/`isHtmlPath` copy the
shape of (`desktop/src/main.js`):

```js
function isMarkdownPath(filePath) {
  return ['md', 'markdown', 'mdown', 'mkd'].includes(fileExtension(filePath));
}
```

## Test strategy

- `node --check desktop/src/main.js`, `cargo check`.
- `cargo test`: the two new classification tests above pass; every existing binary/text
  classification test still passes unchanged.
- `tests/html-preview.test.ts` (security-critical, same spirit as
  `tests/markdown-preview.test.ts`'s *"a document in the tree is untrusted input, so its
  HTML is never executed"*): asserts the HTML preview never sets `allow-scripts` and that
  embedded `<script>` content never executes.
- `tests/desktop-ui-contract.test.ts` additions for the new toggle markup.
- **Manual verification is mandatory before this task is called done**, in
  `npm run desktop:dev`: a PNG opens with pan/zoom and `Open externally` still works; an
  `.svg` toggles `Preview`/`Source`; an `.html` containing `<script>alert(1)</script>`
  toggles to `Preview` and does **not** alert; a ` ```mermaid ` fence inside a `.md` and
  a standalone `.mmd` both render their diagram.

## Boundaries

**Always:** never set `allow-scripts` on the HTML preview iframe; never execute a
document's own embedded script in any preview path (SVG or HTML); the image byte route
stays limited to the ADR-0060 whitelist (`png`/`jpg`/`jpeg`/`gif`/`webp`/`bmp`/`ico`) —
no other binary extension gains it; reuse the existing 2 MiB cap, the existing
`Preview`/`Source` toggle UX, and the existing CodeMirror `lang-html` surface.

**Ask first:** before adding any dependency beyond `@panzoom/panzoom` and `mermaid` —
ADR-0060 already closed the door on DOMPurify and on other imaging libraries for this
phase; reopening either is a new decision, not an implementation detail of this one.

**Never:** never sanitize-then-`innerHTML` arbitrary HTML content instead of the
sandboxed iframe; never auto-launch an external application for these formats; never
extend the raster whitelist to non-image binaries (PDF, fonts, audio, video, archives)
without a new ADR.
