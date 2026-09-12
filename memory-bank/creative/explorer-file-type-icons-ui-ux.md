# Creative: file-type icon curation and mechanism — explorer-file-type-icons

## Step 1 — does this actually need a design pass?

The spec's Boundaries already resolved the bigger questions (curated subset not the full
pack, local assets only, `<img>` not inline SVG, one static folder icon). What's genuinely
open: which exact files to curate, whether each candidate filename actually exists
upstream (verified below, not assumed), and the icon's on-screen size against the
existing tree row. Yes, this needs the pass.

## Step 2 — exploration

**Curation source.** Surveyed this repo's own tracked extensions (`git ls-files`) —
dominated by `.md`, `.ts`, `.mjs`, `.png`, `.json`, `.csv`, `.py`, `.js`, `.toml`, `.rs`,
`.html`, `.css`, `.yml/.yaml` — then extended with extensions common across software
projects generally, since Assay opens *any* Project, not only itself: `.go`, `.rb`,
`.php`, `.java`, `.kt`, `.swift`, `.c/.cpp/.h`, `.cs`, `.sql`, `.graphql`, `.vue`,
`.svelte`, `.xml`, lock files, images, fonts, archives, logs, keys/certs.

**Every candidate filename below was checked against the upstream pack's actual file
listing before being included** — none are guessed. A handful of natural first guesses
did not exist and were swapped for the closest real match: `bash`/`zsh` → `console.svg`
(no dedicated shell icon upstream); `.ini`/`.env`/generic config → `settings.svg`;
`.ico` → `image.svg` (no dedicated icon); `Dockerfile` → `docker.svg`.

**Icon size.** The current CSS-drawn glyphs are 10-13px, sized for simple line-art. The
vendored icons are full-detail colorful artwork (drawn for a 32×32-ish canvas) — at
10-13px their detail collapses into a smear. 16×16px is the established sweet spot for
this style of icon in a compact tree row, and both the sidebar's 33px-tall rows and the
main view's 29px rows have headroom for it without changing row height.

## Decision — curated mapping (`desktop/src/file-icon-map.js`)

```js
const byFileName = {
  'package.json': 'nodejs', 'package-lock.json': 'npm', 'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm', 'tsconfig.json': 'typescript-def', 'cargo.toml': 'rust',
  'cargo.lock': 'lock', 'dockerfile': 'docker', 'docker-compose.yml': 'docker',
  '.gitignore': 'git', '.gitattributes': 'git', '.env': 'settings',
  '.editorconfig': 'editorconfig', 'readme.md': 'readme', 'license': 'license',
  'makefile': 'makefile', 'go.mod': 'go-mod', 'requirements.txt': 'python-misc',
  '.eslintrc': 'eslint', '.eslintrc.json': 'eslint', 'favicon.ico': 'image',
};

const byExtension = {
  ts: 'typescript', tsx: 'react_ts', mts: 'typescript', js: 'javascript',
  jsx: 'react', mjs: 'javascript', json: 'json', md: 'markdown',
  rs: 'rust', py: 'python', html: 'html', css: 'css', scss: 'sass',
  yml: 'yaml', yaml: 'yaml', toml: 'toml', lock: 'lock',
  svg: 'svg', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', ico: 'image',
  sh: 'console', bash: 'console', zsh: 'console',
  go: 'go', rb: 'ruby', php: 'php', java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
  sql: 'database', graphql: 'graphql', gql: 'graphql',
  vue: 'vue', svelte: 'svelte', xml: 'xml',
  zip: 'zip', pdf: 'pdf', log: 'log', key: 'key', pem: 'certificate', csv: 'database',
  woff: 'font', woff2: 'font', ttf: 'font',
};
```

Special filenames match case-insensitively and take precedence, per the spec.

## Decision — vendored files

The distinct icon filenames referenced above, plus `folder-base.svg` for directories:
`typescript`, `typescript-def`, `react_ts`, `javascript`, `react`, `json`, `markdown`,
`rust`, `python`, `python-misc`, `html`, `css`, `sass`, `yaml`, `toml`, `lock`, `svg`,
`image`, `console`, `go`, `go-mod`, `ruby`, `php`, `java`, `kotlin`, `swift`, `c`, `cpp`,
`csharp`, `database`, `graphql`, `vue`, `svelte`, `xml`, `zip`, `pdf`, `log`, `key`,
`certificate`, `font`, `docker`, `git`, `settings`, `editorconfig`, `readme`, `license`,
`makefile`, `nodejs`, `npm`, `yarn`, `pnpm`, `eslint`, `folder-base` — 51 files total,
well inside the spec's ~50-80 curation budget.

## Decision — sizing and markup

```css
.workspace-file-icon, .workspace-folder-icon { width: 16px; height: 16px; flex: 0 0 auto; }
```

`alt=""` on every icon `<img>` (decorative — the file/directory name text right next to
it is the accessible name, exactly as `aria-hidden="true"` already marks the CSS glyph
it replaces).

## What this costs

51 small SVG files (typically 1-3KB each, so well under 150KB total added to the bundle),
one flat mapping module with no runtime dependency, two CSS rules, and a `LICENSE` file
carrying the upstream project's real MIT text plus a one-line NOTICE naming the actual
project and URL. Nothing here needs its own follow-up design pass; extending the mapping
later is a one-line addition per entry.
