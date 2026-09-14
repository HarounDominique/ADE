# Spec: Codex native integration

<!-- Nexus: SPEC-NEXUS.md | Module id: codex-integration -->

## Objective

Expose SEED as a native Codex plugin through `.agents/plugins/marketplace.json`,
`.codex-plugin/plugin.json` and
Codex skills, preserving the existing Claude Code plugin as a parallel adapter.

## Contract

The Codex plugin publishes skills for the workflow entry point and its major
phases. Skills must state the same gates, TDD guard, memory-bank contract and
human approval boundary as the Claude commands, but use no Claude-only flags,
variables or slash-command assumptions.

## Boundaries

- Codex integration is file-based and does not require an API key or a new
  runtime dependency.
- Codex skills may direct the agent to inspect repository files and run the
  existing Node scripts.
- Claude hooks and slash commands remain Claude-only.

## Success Criteria

- Codex can install and discover the plugin from `.codex-plugin/plugin.json`.
- The local Codex marketplace points at the repository plugin without copying
  or requiring a second source tree.
- The documented local install uses `codex plugin marketplace add` followed by
  `codex plugin add seed@seed`.
- Codex exposes `seed-workflow`, `seed-spec`, `seed-plan`, `seed-build` and
  `seed-verify` skills.
- Each skill has a valid `SKILL.md` and provider-neutral instructions.
