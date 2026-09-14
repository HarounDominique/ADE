# Spec: Provider contract

<!-- Nexus: SPEC-NEXUS.md | Module id: provider-contract -->

## Objective

Define the workflow once so Claude Code and Codex execute the same phases,
invariants, permissions and stopping rules without sharing provider-specific
commands or manifest syntax.

## Commands

- Validate: `node scripts/validate-plugin-parity.mjs`
- Claude tests remain the host's existing plugin checks.
- Codex tests validate the plugin manifest and every published skill.

## Project Structure

```text
commands/             → Claude slash-command adapters
agents/               → Claude dispatch adapters
context/              → shared methodology reference
skills/               → Codex-native skill adapters
.claude-plugin/       → Claude manifest
.codex-plugin/        → Codex manifest
scripts/              → cross-platform validation and project scripts
```

## Code Style

Provider-specific files may describe invocation syntax, but must not redefine
phase semantics. Shared rules use neutral terms such as “agent”, “host” and
“workflow”; Claude-only placeholders stay under the Claude adapter.

## Testing Strategy

The validator checks both manifests, skill metadata, command coverage and the
absence of Claude-only root placeholders in Codex skills. Host-level smoke
tests remain separate because Claude Code and Codex supply different tool and
session surfaces.

## Boundaries

- Always: preserve the Claude manifest and command IDs; keep scripts Node-only;
  make fallback and missing-provider behavior explicit.
- Ask first: changing workflow invariants, changing the public plugin name, or
  adding a runtime dependency.
- Never: make Codex parse Claude flags, make Claude load Codex manifests, or
  silently fork phase semantics.

## Success Criteria

- Both manifests install the same named workflow.
- The same workflow rules are available to both providers.
- Claude installation and `/seed:*` behavior remain unchanged.
- Codex receives skills without `${CLAUDE_PLUGIN_ROOT}` dependencies.
