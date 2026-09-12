# SPEC: Per-extension file icons in the Explorer tree

status: approved

## Objective

Replace the Explorer tree's single generic file glyph with a per-file-type icon, so an
operator recognizes a file's kind (TypeScript, Rust, JSON, Markdown, an image, a lock
file, …) at a glance without opening it or reading the extension. The generic directory
glyph is also replaced with a matching vendored folder icon (one static icon for both
expanded and collapsed — the adjacent arrow already rotates to show expand state, and
the chosen icon set ships no separate "open folder" asset; deriving one is out of scope
here). Icons come from a curated subset of a vendored, MIT-licensed open-source SVG icon
set (confirmed with the operator) — bundled as local static assets, no network fetch. An
unmapped file extension falls back to the existing generic file glyph, unchanged.

## Commands

- Frontend syntax check: `node --check desktop/src/main.js`
- Frontend rebuild (for manual verification): `cd desktop && node build.mjs`
- Full app, manual run: `npm run desktop:dev` — GUI/visual behavior verified by the
  operator directly; see `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.
- Contract/regression suite: `npm test` (repo root)

## Structure

- **Vendored assets** — `desktop/src/file-icons/*.svg`: a curated subset of the chosen
  icon set's files (exact list finalized in the `/seed:creative` pass this roadmap
  requires — an open design decision on curation scope and rendering mechanism), plus
  `desktop/src/file-icons/LICENSE` carrying the upstream project's real MIT license text
  and a short NOTICE naming the actual open-source project and its URL (required
  attribution — distinct from, and never combined with, any comparison to a commercial
  product, which must never appear anywhere in this codebase).
- **Mapping** — `desktop/src/file-icon-map.js` (new module): a plain object/function
  mapping a lowercased extension, or an exact special-cased filename (`package.json`,
  `Dockerfile`, `.gitignore`, `tsconfig.json`, `Cargo.toml`, `README.md`, `LICENSE`,
  `.env`, …), to a vendored icon's filename. Special filenames take precedence over the
  extension rule. No match → the caller keeps today's generic glyph.
- **Rendering** — `desktop/src/main.js`, `renderWorkspaceEntry`: the file branch looks up
  `entry.name` in the mapping; a hit renders `<img class="workspace-file-icon" src="file-icons/<icon>.svg" alt="">` in place of the current `<span class="workspace-glyph file">`; a miss keeps that span exactly as today. The directory branch swaps its
  `<span class="workspace-glyph directory">` for the single vendored folder icon,
  unconditionally (no expanded/collapsed variant) — the arrow's existing rotation is what
  already communicates that state.
- **Build**: `desktop/build.mjs` needs to copy `desktop/src/file-icons/*.svg` into the
  built `dist/file-icons/` the same way it already copies other static assets — verified
  in Phase's test strategy, not assumed.
- **Tests**: `tests/desktop-ui-contract.test.ts` string-match additions for the mapping
  module's shape, the `renderWorkspaceEntry` lookup/fallback logic, and the presence of
  the vendored `LICENSE`/NOTICE file. No DOM/browser test harness exists in this repo, so
  the *visual* result (icons actually rendering, look distinct per type, both themes)
  is manual-only.

## Style

The file branch gains a lookup before choosing what to render, with the existing glyph as
the untouched fallback path:

```js
import { iconForFileName } from './file-icon-map.js';
// …
const icon = iconForFileName(name);
const glyph = icon
  ? `<img class="workspace-file-icon" src="file-icons/${icon}.svg" alt="" />`
  : `<span class="workspace-glyph file" aria-hidden="true"></span>`;
return `<li class="workspace-node file" data-entry-name="${name.toLowerCase()}"><button class="workspace-entry file${selected ? ' selected' : ''}${resultClass}" type="button" data-file-path="${path}" aria-current="${selected ? 'page' : 'false'}" aria-label="Open ${name} in ${escapeHTML(parentPath)}">${glyph}${fileLabel}</button></li>`;
```

`file-icon-map.js` itself stays a flat, dependency-free lookup table — no build step, no
generated code, easy to extend by adding one more entry:

```js
const byFileName = { 'package.json': 'nodejs', 'dockerfile': 'docker', '.gitignore': 'git', /* … */ };
const byExtension = { ts: 'typescript', tsx: 'react_ts', rs: 'rust', json: 'json', md: 'markdown', /* … */ };
export function iconForFileName(name) {
  const lower = name.toLowerCase();
  if (byFileName[lower]) return byFileName[lower];
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';
  return byExtension[ext] ?? null;
}
```

## Test strategy

- **Frontend**: string-match additions to `tests/desktop-ui-contract.test.ts` for
  `iconForFileName`'s exported shape and a handful of its real entries, the
  `renderWorkspaceEntry` icon/fallback branch, and that `desktop/build.mjs` actually
  copies `file-icons/` into `dist/`. No DOM/browser test harness exists in this repo.
- **Manual verification is mandatory before this task is called done**, driven by the
  operator in `npm run desktop:dev` — confirming icons actually render, read as visually
  distinct per common file type, survive a light/dark theme switch, and that an
  unrecognized extension still shows the plain fallback glyph rather than a broken image.
  See `agent-rules/_learned/gui-automation-unsafe-in-this-environment`.

## Boundaries

**Always:**
- Every vendored icon file and the mapping table stays local/offline — no CDN, no
  runtime fetch, consistent with this desktop app's architecture.
- `desktop/src/file-icons/LICENSE` carries the upstream project's real, complete MIT
  license text and names the actual open-source project and URL it came from — required
  attribution, kept current if the vendored subset ever grows.
- An unmapped file keeps today's exact generic glyph — never a broken `<img>`, never a
  blank space where an icon should be.
- Never write, in any comment, commit message, spec, or code in this repository, a
  comparison naming or describing similarity to any commercial/licensed product's visual
  style — describe the actual behavior/appearance instead, exactly as this repo already
  does for every prior Explorer feature.

**Ask first:**
- Before vendoring the icon set's full ~900+ files instead of a curated subset — bundle
  size and maintenance burden argue for curation; revisit only if the operator wants
  broader coverage than the curated list turns out to provide.
- Before giving directories per-type or open/closed-state icons — this task uses one
  static folder icon for every directory, regardless of content or expand state.
- Before switching to inline SVG (enables CSS recoloring) instead of `<img>` — the chosen
  icons are inherently full-color/branded per language, so recoloring is not an obvious
  win, but the tradeoff is worth a real decision, not an assumption, if it comes up.

**Never:**
- Never bundle an icon whose individual file carries a different (non-MIT, more
  restrictive) license than the pack's blanket MIT license — verify before vendoring
  anything, not after.
- Never let the mapping table or vendored assets grow into a full copy of the upstream
  pack "just in case" — curated means curated; add entries when a real, observed file
  type in this project's own trees needs one.
