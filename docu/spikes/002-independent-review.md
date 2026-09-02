# Spike 002 — Reviewer independiente y findings estructurados

**Estado:** contrato y pipeline local completados; reviewer LLM real pendiente  
**Fecha:** 2026-09-02  
**Spec:** [SPEC-changes-review-governance.md](../specs/SPEC-changes-review-governance.md#gate-contract)  
**Nexus:** [SPEC-NEXUS.md](../specs/SPEC-NEXUS.md#mvp-contract)

## Objetivo

Validar que un ChangeSet puede pasar por un Reviewer independiente y producir una Review persistible, con findings accionables y una transición inequívoca de Task.

## Contrato

El Reviewer recibe sólo:

```text
taskId
intent
ChangeSet
  ├── runtime diff
  ├── Git status/patch
  └── untracked files
```

No recibe la conversación ni el razonamiento del Implementer. Devuelve reviewer, resumen, sesión opcional y findings.

## Implementación

```text
src/domain/review.ts                 → Review, Finding y decisión pass/changes_requested
src/ports/reviewer.ts                → ReviewerPort y contrato de contexto fresco
src/adapters/evidence-reviewer.ts   → reviewer determinista del spike
src/application/review-change-set.ts → orquestación y transiciones de Task
src/persistence/sqlite-store.ts     → persistencia de reviews
```

El `EvidenceReviewer` sólo verifica presencia de evidencia de cambio. No representa aún revisión semántica de código; existe para validar el contrato y evitar confundir un smoke test con calidad de revisión.

## Flujo validado

```text
IMPLEMENTED
  → UNDER_REVIEW
  → ReviewerPort (contexto fresco)
  → Review + Findings
  → READY_FOR_HUMAN       si no hay findings blocking
  → CHANGES_REQUESTED     si existe finding high/critical
```

Las reviews y findings quedan asociadas a `taskId` y `changeSetId`. El resultado se guarda en SQLite.

## Verificación

```bash
npm run build
npm test
```

Resultado: 7 tests pasan. Se verifican transiciones, contrato HTTP anterior, Git, SQLite, reviewer con evidencia y finding accionable ante ChangeSet vacío.

## Limitación conocida

La integración OpenCode real del Reviewer queda para el siguiente spike. Requiere una sesión nueva, prompt con salida estructurada o parsing robusto, permisos independientes y una estrategia para correlacionar su sesión con la Review sin reutilizar la del Implementer.
