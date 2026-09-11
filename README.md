# Assay

Assay is a local-first workstation for agentic software engineering: the human states intent and constraints, agents implement, and the system makes the changes, the execution, the verification and the review visible.

The name states the posture: an *assay* is the determination of a sample's composition and purity. What an agent claims to have done is not authority over what it did; the code, the tests and Git are. The repository and the binary keep `ade` as their technical identifier, and the decision is recorded in [ADR-0032](docu/adr/0032-product-identity.md).

This repository deliberately starts from documentation. Documentation is the source of intent and architecture; Git holds the state and history of the code; ADE holds the operational metadata of the workflow.

## Documentation

- [Spec nexus](docu/specs/SPEC-NEXUS.md)
- [Module specs](docu/specs/)
- [Documentation index](docu/README.md)
- [ADRs](docu/adr/)

## Status

The CLI MVP and the desktop vertical are operable: ADE can register Projects, create and advance Tasks, run the Implementer/Reviewer flow with OpenCode, persist ChangeSets, Reviews, evidence and gates in SQLite, and apply human approval from Changes. The runtime includes a minimal lifecycle for local services.

v0.3 closed on macOS: a local workspace with native PTY terminals, the OpenCode, Codex and Claude Code providers with resumable sessions, installable skills with per-run permissions, Git/GitHub linked to Tasks, and living documentation with automatic reconciliation. The current shell adds a single resizable sidebar (190–720 px, bounded so the workbench survives), `Projects` as a minimal catalogue that adds and safely stops tracking Git and non-Git folders, an internal `Editor`, a conversational `Agents` view and `Version control` with history, changes, diff, local commit, push and fetch. `Agents` scopes conversations to the active Project and groups them by Task and General; provider, model and permissions are chosen next to the composer, and a turn shows its incremental response plus verifiable public actions — never private reasoning. `↑`/`↓` walk only the prompts saved in the active conversation. In `Version control`, `Changes` uses a real split of working tree and dominant diff; `History` can collapse its auxiliary columns and restore them from accessible headers, while diffs reflow to the available width in real time. The interface avoids simulated state: `Git workspace` appears only in `Version control` and the documentation graph only in `Context`; Tasks, tabs and dialogs are keyboard navigable. CodeMirror serves the main path and Monaco/Prettier load on demand. The current baseline (2026-09-11) is `npm test` with 473 TypeScript tests and `cargo test` with 20 Rust tests. Per-task operational state lives in [tasks/todo.md](tasks/todo.md); the boundaries and closing evidence are in [SPEC-v0.3](docu/specs/SPEC-v0.3.md), [SPEC-file-workspace](docu/specs/SPEC-file-workspace.md), [SPEC-agent-providers](docu/specs/SPEC-agent-providers.md) and [v0.3-close](docu/releases/v0.3-close.md).

The `Agents` list includes OpenCode, Codex and Claude Code when their commands or services are available locally; sessions resume without copying credentials into ADE.
The conversation header lets you pick `Provider default` or an alias the active provider accepts, and star that agent's default model; the catalogue changes with the conversation, the default only seeds new conversations, and the selection is passed to the runtime.
Each conversation also carries three pressure dials — session window, weekly window and context — that show only what the provider itself reports and read as unknown when it reports nothing, per [ADR-0041](docu/adr/0041-agent-pressure-dials.md).

## The development workflow

Assay conducts a Task through eight phases — FRAME, EXPLORE, DESIGN, BUILD, VERIFY, REVIEW, RECONCILE, SHIP — with four modes that propose different routes through them: `quick` for a small local change, `standard` for a normal feature or bug, `design-heavy` when a public contract moves, `recovery` when new evidence contradicts the plan. Phases are workflow state, not Task states: a Task stays IN_PROGRESS while the work moves BUILD → VERIFY → BUILD, and going back is recorded as re-entry with the reason it happened.

Each phase counts its attempts. The first runs at its default tier, the second raises it once, and the third refuses to dispatch and asks a person instead. That is the intended stop, not a retry budget: a failure that already survived a higher tier is information about the problem rather than about the model.

Before a change passes VERIFY, a deterministic guard reads the staged diff. A production file added or modified without a test in the same diff blocks; a pure deletion does not, because removing code is not an untested change. The test verdict comes from the `verification.tests.*` evidence a real run produced — a missing run blocks rather than passing, since absence is not green. The guard deliberately does not check the order test and implementation were written in: a diff cannot show that, so BUILD enforces the order and the guard covers the case it can see.

RECONCILE leaves rules behind. A rule is one directive about how this Project writes code, born at low priority with one Task behind it, climbing only as other independent Tasks reach the same conclusion, and never reaching the tier reserved for a rule a human wrote. Rules are validated before they are stored and again before they are loaded, and a phase reads only the ones matching the files it is about to touch.

The workflow is on by default and can be switched off in two places: your own preferences, in Settings, and the Project's `.ade/policy.json`. The Project wins when it declares a position, because a repository that requires the workflow requires it of whoever opens it; silence hands the decision back to you. Switched off, Tasks, gates, evidence, review and approval all still work — what stops is the conducting, not the governance.

Assay carries the workflow as a Claude Code plugin of its own, in `plugins/seed/`, shipped in the bundle and passed to every `Agents` turn with `--plugin-dir`. Nothing has to be installed for it to be there. The terminal dock is the exception and says so: it runs your real shell, so what you type there uses whatever that machine has. The methodology was first published standalone as [SEED](https://github.com/HarounDominique/seed), which anyone can still take and modify; Assay no longer depends on it or tracks it. The contract is in [SPEC-development-workflow](docu/specs/SPEC-development-workflow.md), the decisions in [ADR-0056](docu/adr/0056-native-development-workflow.md) and [ADR-0057](docu/adr/0057-assay-carries-the-workflow-plugin.md).

### Known gaps

The gap between what this README promises and what the code sustains is inventoried in [product-gap-audit](docu/knowledge/product-gap-audit.md), and the work is tracked in [tasks/todo.md](tasks/todo.md). Two of them are structural today: an `Agents` turn produces no ChangeSet, evidence or gates, and the `tests` gate waits on evidence nothing writes yet. Read that audit before trusting the governance flow end to end.

## Platform support

macOS and Ubuntu are verified platforms. Ubuntu's full manual smoke was completed on 2026-09-10 over the real `.deb`; Fedora, Arch and the rest of Linux remain without platform-specific evidence. Windows remains buildable but not manually verified. Every platform boundary and its degree of support is declared in [SPEC-cross-platform-support](docu/specs/SPEC-cross-platform-support.md#platform-boundary); no document here claims more than CI or a recorded smoke run supports.

Pushing a tag such as `v0.1.0` runs [Desktop release](.github/workflows/release.yml), which builds the Ubuntu `.deb`, macOS `.dmg` and Windows installer on their native runners, validates them and publishes all three plus the combined `latest.json` to a GitHub Release. The packages are not signed yet; Ubuntu users can install with `sudo apt install ./Assay-<version>-ubuntu-<arch>.deb`.

## Quick start

```bash
npm install
npm run build
npm test
```

With OpenCode installed and serving on `127.0.0.1:4096`:

```bash
npm run dev -- /path/to/repository "Inspect the repository and report its current state without editing files."
```

See [Spike 001](docu/spikes/001-opencode-runtime.md) and [Spike 002](docu/spikes/002-independent-review.md) for contracts, results and known limitations.

The integrated flow runs with `npm run review -- /path/to/repository "Describe the task"` while OpenCode is serving locally.

The internal Editor uses CodeMirror 6 (MIT) as its main engine for syntax highlighting, the line gutter, folding, search, indentation and editing. JavaScript/TypeScript, C++, Java, PHP, Python, Rust, CSS/SCSS, HTML, JSON, Markdown, SQL, XML and YAML use their official packages; Monaco Editor (MIT) is activated automatically as a fallback for C, C#, Go, Dart, Kotlin, Ruby, Swift, Scala, Lua, Shell, PowerShell, Objective-C, F#, Elixir, Perl, R, GraphQL, Protocol Buffers and Dockerfiles. ADE's surface stays the same even when the engine changes with the extension. `Format` uses Prettier (MIT) for JavaScript/TypeScript, JSON, CSS/SCSS, HTML, Markdown and YAML; the scope and the licence inventory are in [SPEC-file-workspace](docu/specs/SPEC-file-workspace.md) and [THIRD_PARTY_LICENSES](desktop/THIRD_PARTY_LICENSES.md).

Run control also inspects the Project's manifests non-destructively and proposes build, test and lint configurations for Node, Python, Maven/Gradle, Rust, Go and .NET. ADE delegates to the toolchains the repository already installs — it bundles no compilers — shows their availability and version, and neither runs nor saves a proposal until the operator accepts it. The contract and its limits are in [SPEC-run-configurations](docu/specs/SPEC-run-configurations.md) and the decision in [ADR-0038](docu/adr/0038-external-project-toolchains.md).

The CLI registers Projects and drives Tasks without the UI:

```bash
npm run ade -- project register ade ADE /path/to/repository
npm run ade -- project snapshot ade
npm run ade -- task create task-1 "Describe the task" ade /path/to/repository
npm run ade -- task advance task-1 READY "Acceptance criteria recorded"
npm run ade -- review /path/to/repository "Describe the task"
```

`project snapshot` is the structured read the desktop shell consumes through Tauri's JSON-RPC sidecar.

## Modules

ADE is specified as a nexus of modules. Each one owns a contract, declares what it depends on and is cited by id; the authoritative table, with status and build order, lives in [SPEC-NEXUS](docu/specs/SPEC-NEXUS.md#modules).

| Module | Spec | Responsibility |
| --- | --- | --- |
| `project-task-workflow` | [SPEC-project-task-workflow](docu/specs/SPEC-project-task-workflow.md) | Projects, Tasks, conversations and states |
| `development-workflow` | [SPEC-development-workflow](docu/specs/SPEC-development-workflow.md) | Adaptive transitions, workflow skills and execution modes |
| `agent-runtime` | [SPEC-agent-runtime](docu/specs/SPEC-agent-runtime.md) | Sessions, implementer, reviewer and the runtime port |
| `knowledge-docs` | [SPEC-knowledge-docs](docu/specs/SPEC-knowledge-docs.md) | Documentation, skills, context and drift |
| `changes-review-governance` | [SPEC-changes-review-governance](docu/specs/SPEC-changes-review-governance.md) | ChangeSets, Git, gates, findings and approval |
| `local-runtime` | [SPEC-local-runtime](docu/specs/SPEC-local-runtime.md) | Services, processes, terminal, logs and tests |
| `desktop-shell` | [SPEC-desktop-shell](docu/specs/SPEC-desktop-shell.md) | Projects, Editor, navigation and the escape hatch |
| `workspace-core` | [SPEC-workspace-core](docu/specs/SPEC-workspace-core.md) | Native terminal, local tree, files and workspace context |
| `agent-providers` | [SPEC-agent-providers](docu/specs/SPEC-agent-providers.md) | Agent providers, licences, sessions and permissions |
| `native-skills` | [SPEC-native-skills](docu/specs/SPEC-native-skills.md) | Skill catalogue, installation, versioning and execution |
| `git-collaboration` | [SPEC-git-collaboration](docu/specs/SPEC-git-collaboration.md) | Local Git, GitHub, branches, worktrees and PRs |
| `living-knowledge` | [SPEC-living-knowledge](docu/specs/SPEC-living-knowledge.md) | Reference graph, living specs, diagrams and reconciliation |
| `file-workspace` | [SPEC-file-workspace](docu/specs/SPEC-file-workspace.md) | Internal text editor, safe read/write and external escape hatch |
| `cross-platform-support` | [SPEC-cross-platform-support](docu/specs/SPEC-cross-platform-support.md) | Platform boundaries, matrix verification and degrees of support |
| `run-configurations` | [SPEC-run-configurations](docu/specs/SPEC-run-configurations.md) | Project run and debug configurations, ports and per-run console |
| `agent-terminal-history` | [SPEC-agent-terminal-history](docu/specs/SPEC-agent-terminal-history.md) | Agent terminal history, resume by id, titles and the dock popup |
| `structural-gate` | [SPEC-structural-gate](docu/specs/SPEC-structural-gate.md) | External structural verdict (ASK) as a citable Task gate |

## Built on

Assay ships as a Tauri 2 shell with a TypeScript/Node sidecar, and it exists because of permissively licensed work by other people. The full inventory, with versions and sources, is in [THIRD_PARTY_LICENSES](desktop/THIRD_PARTY_LICENSES.md).

| Component | Role in Assay | Licence |
| --- | --- | --- |
| [Tauri 2](https://github.com/tauri-apps/tauri) (`tauri`, `tauri-build`, `tauri-plugin-opener`) | Desktop shell, window, native commands and sidecar supervision | Apache-2.0 OR MIT |
| [portable-pty](https://github.com/wezterm/wezterm/tree/main/pty) | Native PTY behind the terminal dock | MIT |
| [serde / serde_json](https://github.com/serde-rs/json) | JSON-RPC protocol between shell and sidecar | MIT OR Apache-2.0 |
| [xterm.js](https://github.com/xtermjs/xterm.js) (`@xterm/xterm`, `@xterm/addon-fit`) | Terminal surface | MIT |
| [CodeMirror 6](https://github.com/codemirror/dev) and its `@codemirror/lang-*` packages | Main editor engine and language support | MIT |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | Editor fallback for languages without a CodeMirror package | MIT |
| [Prettier](https://github.com/prettier/prettier) | Explicit formatting for supported languages | MIT |
| [markdown-it](https://github.com/markdown-it/markdown-it) | Markdown rendering in the Editor | MIT |
| [esbuild](https://github.com/evanw/esbuild) | Shell bundling | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) and [tsx](https://github.com/privatenumber/tsx) | Sidecar and CLI language and runner | Apache-2.0 · MIT |
| [cross-spawn](https://github.com/moxystudio/node-cross-spawn) | Portable process spawning | MIT |
| [postject](https://github.com/nodejs/postject) | Node SEA packaging of the sidecar | MIT |
| [Node.js](https://github.com/nodejs/node) with its built-in SQLite | Sidecar runtime and operational persistence | MIT · SQLite is public domain |

Assay also depends on tools it never bundles and never wraps: Git, the toolchains each Project declares, the agent CLIs ([OpenCode](https://github.com/sst/opencode), Codex and Claude Code, each under its own terms and authenticated by their own accounts) and [ASK Engine](https://github.com/HarounDominique/sourcecode) for the structural gate. None of them is redistributed here; ADE calls what the machine already has.

## Structural gate with ASK

Assay does not analyse code: it consumes structural evidence from [ASK Engine](https://github.com/HarounDominique/sourcecode) by contract and publishes it as a Task's `structural-gate`. The design is in [SPEC-structural-gate](docu/specs/SPEC-structural-gate.md) and the decision in [ADR-0037](docu/adr/0037-structural-gate-from-ask.md).

Requirements: ASK installed (`pip install sourcecode`, command `ask`) and the Project skill installed. `ADE_ASK_COMMAND` forces a specific executable when several environments coexist.

```bash
# 1. install the skill in the Project (once)
#    equivalent to skills.install with source ./skills/ask-gate.json
```

```json
{"id":"i1","method":"skills.install","params":{"repositoryPath":"/path/to/project","source":"/path/to/ADE/skills/ask-gate.json"}}
```

```json
{"id":"g1","method":"gate.ask","params":{"repositoryPath":"/path/to/project","since":"origin/main","taskId":"task-1","grantedPermissions":["run_commands"]}}
```

The response carries the verdict, the components involved, the ASK version and the exact command that ran:

```json
{"gate":{"id":"structural-gate","status":"pending","evidenceIds":["structural-gate-task-1-..."],"failureReason":"ASK could not decide: verify"},
 "verdict":"UNVERIFIED","exitCode":2,"since":"origin/main","unverifiedComponents":["verify"],
 "tool":{"name":"ask","version":"5.9.30","buildCommit":"793177c"},
 "command":["pack","gate","/path/to/project","--format","json","--compact","--since","origin/main"]}
```

| ASK verdict | Assay gate | Meaning |
|---|---|---|
| `PASS` | `passed` | no component established a block and all of them could decide |
| `BLOCK` | `failed` | a component established a blocking change |
| `UNVERIFIED` | `pending` | nothing was proven either way — it never becomes `passed` |

Without `taskId` the call is a read. With `taskId` the verdict is persisted as `structural.gate.*` evidence and appears in `change.review`. The gate is **opt-in**: a Project requires it by declaring it in `.ade/policy.json`.

```json
{"requiredGates":["build","tests","agent-review","documentation-review","structural-gate","human-approval"]}
```

### The agent uses ASK on its own

When the Project is Java and `ask` is installed, the agent's turn starts with a short capability briefing — what ASK is, the commands that pay off and its boundary — and the agent decides whether to use it. Nothing runs on its behalf.

```
[ADE] This repository is Java/Spring (pom.xml, …). ASK Engine is installed as `ask`: it answers
structural questions deterministically from a cached model of the repository, so reach for it
before re-reading the tree file by file.
- `ask . --compact` — repository shape and where to start
- `ask endpoints .` — REST surface with effective paths and security policy
- `ask impact <Type> .` — what breaks if that type changes
…
```

A repository without Java receives no briefing, and Java that only lives in a test fixture does not count as a Java repository. It is switched off with `"structuralBriefing": false` in `.ade/policy.json`. The briefing is not persisted in the conversation: the operator's prompt is what gets saved.

Without ASK installed, `gate.ask` answers `ASK_UNAVAILABLE` with the installation instruction; never an approved gate. ASK answers confidently in Java/Spring repositories: in other languages the usual verdict is `UNVERIFIED`, which is exactly what the gate publishes.

## Licence

Assay is released under the [MIT licence](LICENSE). Third-party components keep their own licences, listed in [THIRD_PARTY_LICENSES](desktop/THIRD_PARTY_LICENSES.md).
