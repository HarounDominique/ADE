# Project Config

schema_version: 1

## Git

- protected_branches: [main]
- pr_target: main
- worktree_root: [path]

## Detected Stack

[Filled by `/seed:init` Step 1. `[none — no source yet]` for a genuine greenfield
project — never leave this section with the bracketed placeholder if source already
existed at init time.]

- Language(s): [detected from file extensions actually present]
- Source/test layout: [e.g. `src/`+`tests/`, flat root, `lib/`, monorepo packages]
- Existing test-naming convention: [e.g. `test_*.py`, `*.test.js`, `*_test.go`]
- Existing branch naming (if any pre-existing branches): [pattern observed, or "none yet"]

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

