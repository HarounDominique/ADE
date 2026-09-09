# Third-party licences

Assay is MIT licensed and is built on work by other people. This is the inventory of the direct dependencies Assay declares and ships, with the version resolved in this tree and the licence each project publishes. Every one of them is permissive and compatible with redistribution under MIT; each keeps its own notices inside the npm and Cargo dependency trees.

## Desktop shell — `desktop/package.json`

| Dependency | Version | Purpose | Licence | Source |
| --- | --- | --- | --- | --- |
| [`codemirror`](https://github.com/codemirror/dev) | 6.0.2 | Main editor engine: highlighting, gutter, folding, search, indentation, editing | MIT | [codemirror.net](https://codemirror.net/) |
| `@codemirror/lang-*` — cpp 6.0.3, css 6.3.1, html 6.4.12, java 6.0.2, javascript 6.2.5, json 6.0.2, markdown 6.5.2, php 6.0.2, python 6.2.1, rust 6.0.2, sql 6.10.0, xml 6.1.0, yaml 6.1.3 | — | Per-language parsers and highlighting | MIT | [CodeMirror language packages](https://codemirror.net/docs/ref/#language) |
| [`@lezer/highlight`](https://github.com/lezer-parser/highlight) | 1.2.3 | Highlight tags shared by the CodeMirror grammars | MIT | [lezer.codemirror.net](https://lezer.codemirror.net/) |
| [`monaco-editor`](https://github.com/microsoft/monaco-editor) | 0.55.1 | Editor fallback for languages with no official CodeMirror package | MIT | [Monaco licence](https://github.com/microsoft/monaco-editor/blob/main/LICENSE.txt) |
| [`prettier`](https://github.com/prettier/prettier) | 3.9.6 | Explicit formatting of supported languages | MIT | [prettier.io](https://prettier.io/docs) |
| [`@xterm/xterm`](https://github.com/xtermjs/xterm.js) | 6.0.0 | Terminal surface of the PTY dock | MIT | [xtermjs.org](https://xtermjs.org/) |
| [`@xterm/addon-fit`](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-fit) | 0.11.0 | Fits terminal rows and columns to the dock | MIT | [xtermjs.org](https://xtermjs.org/) |
| [`markdown-it`](https://github.com/markdown-it/markdown-it) | 14.3.1 | Markdown rendering in the Editor (CommonMark + tables), embedded HTML disabled | MIT | [markdown-it.github.io](https://markdown-it.github.io/) |
| [`esbuild`](https://github.com/evanw/esbuild) | 0.28.2 | Bundles the shell into `desktop/dist` | MIT | [esbuild.github.io](https://esbuild.github.io/) |
| [`@tauri-apps/cli`](https://github.com/tauri-apps/tauri) | 2.11.4 | Development and packaging commands | Apache-2.0 OR MIT | [tauri.app](https://tauri.app/) |

## Domain, CLI and sidecar — `package.json`

| Dependency | Version | Purpose | Licence | Source |
| --- | --- | --- | --- | --- |
| [`cross-spawn`](https://github.com/moxystudio/node-cross-spawn) | 7.0.6 | Portable process spawning for Git, agent CLIs and declared commands | MIT | [npm](https://www.npmjs.com/package/cross-spawn) |
| [`typescript`](https://github.com/microsoft/TypeScript) | 5.9.3 | Language of the domain, the CLI and the sidecar | Apache-2.0 | [typescriptlang.org](https://www.typescriptlang.org/) |
| [`tsx`](https://github.com/privatenumber/tsx) | 4.23.13 | Runs TypeScript directly for development and tests | MIT | [tsx.is](https://tsx.is/) |
| [`postject`](https://github.com/nodejs/postject) | 1.0.0-alpha.6 | Injects the sidecar into a Node single executable application | MIT | [npm](https://www.npmjs.com/package/postject) |
| [`@types/node`](https://github.com/DefinitelyTyped/DefinitelyTyped) | 24.13.3 | Node type definitions | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| [`@types/cross-spawn`](https://github.com/DefinitelyTyped/DefinitelyTyped) | 6.0.6 | `cross-spawn` type definitions | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |

## Native shell — `desktop/src-tauri/Cargo.toml`

| Crate | Version | Purpose | Licence | Source |
| --- | --- | --- | --- | --- |
| [`tauri`](https://github.com/tauri-apps/tauri) | 2.11.5 | Desktop shell, window, native commands and sidecar supervision | Apache-2.0 OR MIT | [tauri.app](https://tauri.app/) |
| [`tauri-build`](https://github.com/tauri-apps/tauri) | 2.6.3 | Build script and resource embedding | Apache-2.0 OR MIT | [tauri.app](https://tauri.app/) |
| [`tauri-plugin-opener`](https://github.com/tauri-apps/plugins-workspace) | 2.5.5 | Escape hatch to the system application | Apache-2.0 OR MIT | [plugins-workspace](https://github.com/tauri-apps/plugins-workspace) |
| [`portable-pty`](https://github.com/wezterm/wezterm/tree/main/pty) | 0.8.1 | Native PTY behind the terminal dock | MIT | [wezterm](https://github.com/wezterm/wezterm) |
| [`serde`](https://github.com/serde-rs/serde) | 1.0.229 | Serialisation of the sidecar protocol | MIT OR Apache-2.0 | [serde.rs](https://serde.rs/) |
| [`serde_json`](https://github.com/serde-rs/json) | 1.0.151 | JSON-RPC between shell and sidecar | MIT OR Apache-2.0 | [serde.rs](https://serde.rs/) |

## Runtime, not vendored

| Component | Role | Licence or terms |
| --- | --- | --- |
| [Node.js](https://github.com/nodejs/node) | Runtime of the sidecar, packaged as a single executable application | MIT |
| SQLite, through Node's built-in `node:sqlite` | Operational metadata of the workflow | Public domain |
| [Git](https://git-scm.com/) | Historical truth of the repository; invoked, never embedded | GPL-2.0, used as an external program |
| [OpenCode](https://github.com/sst/opencode) | Agent provider over HTTP/SSE | Its own; installed and authenticated by the user |
| Codex CLI and Claude Code CLI | Agent providers over CLI | Their own proprietary terms; installed and authenticated by the user |
| [ASK Engine](https://github.com/HarounDominique/sourcecode) | Structural evidence for the `structural-gate` | Its own; installed by the user |
| Project toolchains — Node, Python, Maven/Gradle, Rust, Go, .NET | Build, test and lint declared by each Project | Their own; ADE bundles no compilers |

Assay redistributes none of the components in this last table: it calls what the machine already has, and reports their absence instead of substituting them.

## Scope of this inventory

The tables above cover the direct dependencies declared by `package.json`, `desktop/package.json` and `desktop/src-tauri/Cargo.toml`. Monaco's basic language definitions are part of its MIT distribution and load only for the fallback languages ADE declares. Before distributing a packaged release, the complete transitive notice must be generated from `package-lock.json`, `desktop/package-lock.json` and `Cargo.lock`, and kept alongside the bundle.
