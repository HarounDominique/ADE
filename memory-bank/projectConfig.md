# Project Config

schema_version: 1

## Git

- protected_branches: [master]
- pr_target: master
- worktree_root: [path]

## Detected Stack

- Language(s): TypeScript (Node, ESM) for the core CLI/services under `src/`; Rust for the Tauri desktop shell under `desktop/src-tauri/`; plain JS/HTML/CSS for the desktop frontend under `desktop/src/`.
- Source/test layout: `src/` (domain/application/adapters/ports/persistence, hexagonal-style) with a flat top-level `tests/` directory (not colocated); `desktop/` is a separate subproject with its own `desktop/src` (frontend) and `desktop/src-tauri` (Rust backend).
- Existing test-naming convention: `*.test.ts` in flat `tests/`, run via `node --import tsx --test`.
- Existing branch naming (if any pre-existing branches): mixed — mostly `feat/<slug>` and `fix/<slug>`, some `chore/<slug>` and `feature/<slug>` (inconsistent feat vs feature), plus a handful of bare topic-slug branches with no prefix (e.g. `shell-parity-and-polish`, `ui/button-component`).

## Complexity Overrides

[Optional per-project overrides to `${CLAUDE_PLUGIN_ROOT}/context/complexity-routing.md`'s default table.]

## Agent Backends

[Optional. Uncomment and edit any line to route that seam to Codex; omit the whole
section, or any line in it, to leave that seam on the default (`anthropic`, at
`${CLAUDE_PLUGIN_ROOT}/context/model-routing.md`'s normal tier). See
`${CLAUDE_PLUGIN_ROOT}/context/agent-backends.md` for the fallback contract — a
`codex`-configured seam that can't reach Codex falls back to `anthropic` automatically
and says so, never blocking the task.]

<!--
- spec: anthropic
- tdd: anthropic
- code-review: anthropic
- creative: anthropic
-->
