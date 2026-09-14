# ADR-0061 — SEED ofrece superficies nativas para Claude Code y Codex

## Status

Accepted

## Date

2026-09-14

## Context

Assay integra SEED dentro de `plugins/seed/`. La primera integración sólo
contenía el manifiesto Claude Code, aunque Assay ya soportaba Claude Code y
Codex como proveedores. Eso hacía que el workflow pareciera dependiente de
Claude y dejaba fuera de la distribución la superficie nativa de Codex.

Claude Code y Codex no comparten el formato de plugin: Claude usa comandos,
agentes y hooks bajo `.claude-plugin/`, mientras Codex usa skills bajo
`.codex-plugin/`. Copiar flags de un host al otro no es una integración válida.

## Decision

SEED mantiene dos adaptadores nativos en el mismo repositorio y con la misma
versión:

- Claude Code conserva `.claude-plugin/`, `/seed:*`, agentes y hooks.
- Codex añade `.codex-plugin/plugin.json` y skills `SKILL.md` para todo el
  ciclo de workflow, y `.agents/plugins/marketplace.json` para su instalación
  desde un marketplace local.
- La metodología, invariantes y criterios de aceptación son comunes, pero la
  invocación y las capacidades específicas siguen separadas por host.
- Assay vende ambos adaptadores dentro del recurso `plugins/seed` y valida su
  paridad antes de empaquetar.

## Alternatives Considered

### Hacer que Codex interprete el plugin Claude

Rechazado: requiere flags, placeholders y semántica que pertenecen a Claude
Code y produciría una compatibilidad accidental y frágil.

### Mantener una sola copia en Assay

Rechazado: Assay debe consumir el artefacto dual de SEED, no reconstruir a mano
una segunda variante que pueda divergir.

## Consequences

- Los usuarios pueden instalar SEED como plugin nativo en ambos hosts.
- Claude conserva compatibilidad con sus comandos existentes.
- Codex recibe skills host-neutral sin depender de `${CLAUDE_PLUGIN_ROOT}`.
- El validador `plugins/seed/scripts/validate-plugin-parity.mjs` detecta
  divergencias de identidad, licencia, versión y contenido básico.
- La verificación de ejecución real sigue dependiendo de tener cada CLI
  instalado y autenticado en la plataforma correspondiente.

## Verification evidence

- Standalone `seed`: `scripts/validate-plugin-parity.mjs` pasa con Claude
  1.2.0, Codex 1.2.0 y 15 skills Codex.
- Assay: `npm run seed:check`, el validador vendorizado, los tests específicos,
  el typecheck, el build frontend y 54 tests Rust pasan localmente.
- Checkout limpio: ambos repositorios validan sin depender de cambios no
  commiteados ni de la presencia del repositorio hermano `seed`.
- CI declara runners Ubuntu y Windows para la matriz y Ubuntu, macOS y Windows
  para release. El run remoto certificado `34861539431`, sobre `7aeb6df`, pasó
  la validación SEED en ambos runners y publicó los artefactos
  `seed-parity-linux` y `seed-parity-windows`. Windows completó además tests,
  compilación, empaquetado y smoke test.
- El empaquetado Linux general puede continuar más tiempo que la validación del
  plugin; no cambia la evidencia específica de paridad ya publicada.
