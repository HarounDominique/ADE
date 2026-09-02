# Spike 002 — Reviewer independiente y findings estructurados

**Estado:** flujo CLI completo validado con reviewer LLM real
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
src/adapters/opencode-reviewer.ts   → Reviewer OpenCode con JSON estructurado
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

Resultado: 8 tests pasan. Se verifican transiciones, contrato HTTP anterior, Git, SQLite, reviewer con evidencia y finding accionable ante ChangeSet vacío.

Smoke test real: OpenCode `1.18.26` creó una sesión distinta de la del Implementer y devolvió una Review JSON estructurada con `summary` y `findings`. Para `smoke-result.txt` produjo 0 findings.

Flujo CLI end-to-end: `npm run review` creó la Task, ejecutó el Implementer, persistió el ChangeSet, abrió una segunda sesión para el Reviewer, persistió la Review y dejó la Task en `READY_FOR_HUMAN`. La revisión produjo dos findings `low` con acción `accept-risk`, ambos respaldados por evidencia del archivo y Git.

## Limitación conocida

La integración real y el flujo CLI ya están validados. Queda pendiente probar findings semánticos sobre un ChangeSet con riesgo real, añadir gates de tests/documentación y decidir si el parsing soporta todas las variantes de provider.
