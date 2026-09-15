---
slug: windows-runtime-hardening
spec: docu/specs/SPEC-windows-runtime-hardening.md
status: ready_to_archive
---

## Implementation Roadmap

- [x] Phase 1 — Separar stdout/stderr en las sondas de toolchain y añadir regresión.
- [x] Phase 2 — Añadir retry/backoff acotado para locks transitorios de Git y tests.
- [x] Phase 3 — Verificar build, suite completa, Rust y documentar el cierre.

## Execution State

**Build Status**: RUNNING
**Current Phase**: 1
**Current Step**: 3/3
**Step Attempts**: {1: 1, 2: 1, 3: 1}
**Last Block Rule**: none
**Can Resume**: YES

## Confirmed Decisions

- Los warnings de `stderr` no desplazan una versión válida de `stdout`.
- Sólo los errores de lock/uso transitorio de Git se reintentan.
- El límite es de cuatro intentos totales con backoff corto.
