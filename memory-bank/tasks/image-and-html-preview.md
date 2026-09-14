---
slug: image-and-html-preview
spec: SPEC-image-and-html-preview.md
status: approved
---

## Implementation Roadmap

- [x] Phase 1 — Raster image preview: extend `read_file_in`
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

- [x] Phase 2 — SVG preview toggle: `isSvgPath`; `Preview` renders the already-read text
  content via `new Blob([content], { type: 'image/svg+xml' })` +
  `URL.createObjectURL` into an `<img>` (a `<script>` inside the SVG does not execute
  there, by platform design — no sandboxing code needed); `Source` shows the existing
  CodeMirror XML/HTML view. No backend change — SVG already classifies `kind: "text"`.
  No creative needed.
  (satisfies: SPEC-image-and-html-preview.md#structure, #boundaries)
  Test strategy: `node --check desktop/src/main.js`,
  `tests/desktop-ui-contract.test.ts` additions, manual toggle check in
  `npm run desktop:dev`.

- [x] Phase 3 — HTML preview toggle (security-critical): `isHtmlPath`; `Preview` renders
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

- [x] Phase 4 — Mermaid diagram rendering: add `mermaid` (12.0.0, MIT) to
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

**Build Status**: RUNNING
**Current Phase**: 5
**Current Step**: 5/6 — automated verification done (regression + licence check); blocked
  on the operator's mandatory manual GUI pass (see roadmap Phase 5 and Deviations) before
  this phase can be checked off and `Build Status` can move to `DONE`.
**Step Attempts**: {2: 0, 3: 1, 4: 0}
**Last Block Rule**: none
**Can Resume**: YES — resume by checking off Phase 5 and running step 6 (commit-guard +
  commit) once the operator confirms the manual pass below.

## Deviations

- Phase 1: `kind` value for a previewable raster image is `"image"` — the spec/plan only
  said "instead of falling into `kind: \"binary\"`" without naming the replacement
  string; frontend gates on this literal.
- Phase 1: no new Rust crate for base64 — hand-rolled a ~15-line encoder in `lib.rs`
  instead of adding a `base64` crate (one sits transitively in `Cargo.lock` via `tauri`
  already). Read the spec's Boundaries "ask first before adding any dependency beyond
  `@panzoom/panzoom` and `mermaid`" as covering the backend too. Review pass hand-checked
  the encoder against known vectors (`[0,1,2] → "AAEC"`, `[0xFF] → "/w=="`,
  `[0xFF,0xFF] → "//8="`) — correct alphabet, padding, no MSRV risk (`div_ceil` stable
  since Rust 1.73, no `rust-version` pin in `Cargo.toml` to conflict with it). Accepted —
  no crate dependency was ever named in the spec/ADR for this phase.
- Phase 1: image bytes land in a new `record.imageData` frontend field rather than
  reusing `record.buffer`/`original` (which carry text dirty-tracking semantics) — kept
  concerns separate. Accepted, no spec conflict.
- Phase 4 review (attempt 2, opus) confirmed the stale-async-render race is genuinely
  closed (reproduced-and-fixed via `previewRenderGeneration`/`beginPreviewRenderGeneration`/
  `previewRenderIsCurrent`, mirroring the existing `httpRequestExecuteGeneration` pattern;
  guards both the success and failure write in `renderMermaidPreview`,
  `renderMermaidDiagramsInto`'s per-diagram loop, the markdown-fence placeholder id
  namespace, and — deliberately beyond the literal finding — `renderMarkdownPreview`'s own
  write, since guarding diagrams alone while leaving markdown unguarded would produce a
  worse state, wrong document's text with empty diagram holes) — but blocked on a
  DIFFERENT, `high`-priority finding: `agent-rules/_learned/security-defaults.md`'s
  `audit-new-npm-dependencies-before-committing-to-them` had not been run for `mermaid`.
  `npm audit` on the phase's diff: 5 high + 2 moderate. Root-caused directly: 2 moderate
  (`dompurify`/`monaco-editor`) are **pre-existing on `master`** (already-accepted risk
  from ADR-0023's Monaco adoption, unchanged by this diff — confirmed via
  `git stash`+audit on master, same 2/moderate/0/high baseline). The 5 high were genuinely
  new: `mermaid@12.0.0 → chevrotain@11.1.2 → lodash-es@4.17.23` (pinned to an exact,
  vulnerable version — code injection via `_.template`, prototype pollution via
  `_.unset`/`_.omit`). Fixed surgically, not by downgrading mermaid (which would
  contradict ADR-0060's pin and `npm audit fix --force`'s own suggested `mermaid@11.17.2`
  re-enters the *same* vulnerable chevrotain range from the other direction): added
  `"overrides": { "lodash-es": "^4.18.1" }` to `desktop/package.json` — a patched
  lodash-es release exists (`4.18.0`/`4.18.1`) that chevrotain's exact pin never picked
  up. `npm audit` after: back to the exact pre-existing 2-moderate baseline, 0 high.
  Sanity-checked chevrotain still works against the overridden lodash-es directly
  (a standalone lexer/tokenize smoke test, since `mermaid.render()` itself needs a DOM
  this repo's test environment doesn't have) — tokenized correctly, 0 errors. Full
  `npm test` re-run clean (673/673) after the override. Not a Boundaries violation — the
  spec's "ask first before adding any dependency beyond `@panzoom/panzoom` and
  `mermaid`" is about direct dependencies; `overrides` doesn't add one, it pins a
  transitive one already pulled in. `THIRD_PARTY_LICENSES.md` unchanged (transitive,
  out of its stated direct-dependency scope, per its own header).
- Follow-up flagged by review, not acted on in this task (recorded for `/seed:reflect`):
  ADR-0060's prose reasoning against DOMPurify ("keeps the tree 100% MIT-compatible")
  is now loosely worded now that `mermaid` transitively pulls DOMPurify anyway (the
  licence *table* stays correct — direct dependencies only, by its own stated scope, and
  DOMPurify was already transitively present via `monaco-editor` before this task).
  Worth a `/seed:spec-sync` note on ADR-0060 at some point, not a code change. Also
  flagged: each document activation renders its preview twice (once via the awaited
  `sync*Preview()` chain, once via `updateDocumentEditState()`'s fire-and-forget
  `void render*Preview()`) — harmless for the synchronous SVG/HTML paths, doubles
  Mermaid's DSL-parse+layout cost per `.mmd` tab activation. Pre-existing pattern, newly
  expensive; not blocking, flagged for `/seed:reflect` alongside the Phase 2 parallel-
  clone duplication debt already recorded above.
- Phase 1: `tests::terminal_pty_accepts_input_after_the_shell_is_ready` fails
  intermittently in this sandbox (`Timeout` on PTY shell readiness) — confirmed via
  `git stash` during the TDD pass that it fails identically on unmodified `master`, and
  the review pass reproduced the same intermittent failure independently. Pre-existing
  environment flake, unrelated to this phase's diff (PTY/terminal code, not
  `read_file_in`); `last-test-exit-code` for this phase was recorded from a run
  excluding only this one known-flaky test (`cargo test -- --skip
  terminal_pty_accepts_input_after_the_shell_is_ready`, 53/53 green), plus the full
  `npm test` (645/645 green).
- No spec ambiguity or gap surfaced — `/seed:spec-sync` not needed for this phase.
- Phase 2: `isSvgPath` + toggle implemented as a full parallel clone of the Markdown
  preview machinery (own `svgPreviewStorageKey`/`svgPreviewPreference`/
  `documentIsRenderableSvg`/`renderSvgPreview`/`syncSvgPreview`/`svgPreviewVisible`/
  `toggleSvgPreview`, own `svg-preview-toggle` button, own `document-svg-preview`
  markup) rather than generalizing `markdownPreviewVisible()`'s pattern into one
  format-parameterized implementation. Reasoned choice, not an oversight: relabeling the
  single existing `markdown-preview-toggle` button risked breaking already-pinned
  Markdown tests, and separate per-format state directly satisfies the spec's own
  requirement that switching one tab's preference never flips another's. Review pass
  confirmed this reading is defensible against the spec's Boundaries (reuses toggle UX,
  not literal implementation) and PASSed on it — but flagged it as real duplication debt:
  Phase 3 (HTML) and Phase 4 (Mermaid, which reuses "the same toggle" per spec) would be
  a third and fourth near-identical clone, cheaper to unify into one
  `createFormatPreviewToggle({...})` factory now (two instances) than to untangle later
  (three or four). **Not acted on in Phase 2** — accepted as-is to keep this phase's diff
  small and risk low, per the implementer's own reasoning. Flagged here for `/seed:reflect`
  and as an explicit decision point before Phase 3 starts: continue the established
  parallel-clone pattern (lowest risk, matches what's already committed twice) or pause
  to extract the shared factory first (lower total debt, touches already-pinned Markdown
  code). Proceeding with the established pattern for Phase 3 to keep the roadmap moving;
  this is the tradeoff being made, not an oversight.
- Phase 3 (security-critical): `htmlPreviewSandbox()` returns `''` — the empty/bare
  `sandbox` form, which is the maximally restrictive one (opts into every platform
  restriction; a token would opt back out of one). Set statically in `index.html`'s
  initial markup (attribute present from parse time, no dynamic iframe creation) and
  redundantly via `setAttribute` before `.srcdoc` is assigned. `htmlPreviewSrcdoc()`
  deliberately does not escape/strip content — safety is the sandbox, not content
  transformation, matching ADR-0060's decision. Review traced every `sandbox`/`srcdoc`
  occurrence in the diff by hand (one static, one dynamic call site; exactly one
  `.srcdoc =` in the whole bundle) and confirmed PASS with high confidence, not on the
  strength of the implementer's claim alone. Dropped one over-strict RED test ("the
  literal string `allow-scripts` never appears anywhere in the shipped shell") that
  collided with legitimate explanatory comments documenting *why* it's omitted;
  replaced by structural assertions on the actual builder function's return value and
  call-site coverage — accepted as the stronger, more precise test.
- No spec ambiguity or gap surfaced in Phase 3 — `/seed:spec-sync` not needed.
- Phase 5: discovered mid-verification that `feature/image-and-html-preview` had absorbed
  10 unrelated commits (`ff4cdf0`..`ffc0b32`, "vendor dual-host seed plugin" work) —
  confirmed via `git log`/reflog that another concurrent process committed directly onto
  this branch name in the same shared working directory, between this task's branch
  creation and Phase 1's first commit (not a merge, not caused by anything this task's
  build steps did). Operator confirmed the other work is legitimate but landed on the
  wrong branch. Resolved: preserved it intact at `feature/dual-host-seed-plugin`
  (branched from `ffc0b32`, pushed to origin on operator confirmation), then
  `git rebase --onto 366cfdd ffc0b32 feature/image-and-html-preview` to drop those 10
  commits from this branch — clean rebase, no conflicts (no file overlap between the two
  efforts). Re-verified post-rebase: `git diff master...feature/image-and-html-preview`
  touches only this task's 13 files; full `npm test` 672/672 (was 673/673 pre-rebase —
  the missing one is the foreign branch's own test contribution, correctly gone, not a
  regression; confirmed by checking `master` alone at 642 and this branch's real delta
  at +30, matching the four phases' actual new tests). Force-pushed the cleaned branch to
  origin (`--force-with-lease`, operator-confirmed) since it had already been pushed
  once in the tangled state.
