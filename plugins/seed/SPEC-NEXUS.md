# Nexus: SEED multi-provider

## Objective

Evolucionar SEED para que conserve su plugin nativo de Claude Code y ofrezca
además una integración nativa de Codex, con una metodología común, sin
duplicar reglas ni degradar la compatibilidad existente.

## Tech Foundations

- La metodología y sus invariantes son provider-neutral.
- Claude Code conserva el manifiesto `.claude-plugin/plugin.json`, los comandos
  `/seed:*`, agentes, hooks y `${CLAUDE_PLUGIN_ROOT}`.
- Codex recibe una integración propia mediante sus instrucciones y superficies
  nativas; no se le pasan flags ni rutas exclusivas de Claude.
- Los scripts siguen siendo Node.js y deben funcionar en macOS, Ubuntu y
  Windows sin depender de Bash.
- La ausencia de un proveedor opcional debe producir fallback explícito, no
  bloquear el workflow.

## Modules

| Module id | Spec file | Responsibility | Depends on | Status | Blocked by |
|---|---|---|---|---|---|
| provider-contract | SPEC-provider-contract.md | Separar metodología común de adaptadores de agente | — | draft | — |
| codex-integration | SPEC-codex-integration.md | Integración nativa de Codex y compatibilidad de ejecución | provider-contract | blocked | provider-contract |
| portability-verification | SPEC-portability-verification.md | Tests, empaquetado y verificación multiplataforma | provider-contract, codex-integration | blocked | provider-contract, codex-integration |

Build order: provider-contract → codex-integration → portability-verification

## Change Log

- 2026-09-14 — initiative opened; boundaries and build order proposed.

## Open Questions

- Qué superficie nativa de Codex se adoptará como mecanismo principal:
  instrucciones de proyecto, skills/agentes si están disponibles, o una
  combinación versionada de ambas.
- Qué nivel de paridad se exige para hooks y comandos interactivos de Claude
  que no tengan equivalente directo en Codex.
