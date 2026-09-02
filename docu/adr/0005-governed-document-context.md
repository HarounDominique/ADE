# ADR-0005 — Contexto documental gobernado y resolución determinista en v0.1

## Status

Accepted for MVP

## Date

2026-09-02

## Context

Los agentes necesitan contexto del proyecto, pero enviar todo el repositorio en cada prompt aumenta ruido, coste y riesgo de que una instrucción antigua prevalezca sobre la intención actual. A la vez, una memoria opaca no ofrece trazabilidad ni permite revisar el impacto de un cambio documental.

## Decision

ADE clasifica documentos como `canonical`, `operational` o `agent` y resuelve un conjunto pequeño de contexto mediante reglas deterministas en v0.1. Cada selección debe incluir el documento, su identificador y las señales que justifican su inclusión. Los documentos canónicos no se actualizan automáticamente: un impacto `required` bloquea la reconciliación hasta que exista una decisión explícita.

La metadata mínima de documentos nuevos es `id`, `class`, `status`, `updatedAt` y `source`. Las specs y ADRs mantienen sus convenciones actuales; `docu/knowledge/` es la ubicación por defecto para conocimiento adicional.

## Alternatives considered

### Enviar todo el repositorio al agente

- Ventaja: reduce el trabajo inicial de selección.
- Rechazo: produce contexto excesivo, mezcla autoridad y dificulta explicar qué información influyó.

### Embeddings como requisito del MVP

- Ventaja: recuperación semántica más flexible.
- Rechazo: añade infraestructura y opacidad antes de validar la taxonomía, metadata y reglas básicas.

### Memoria IA como fuente normativa

- Ventaja: permite recuperar contexto histórico con comodidad.
- Rechazo: no es suficientemente auditable y no sustituye documentos versionados ni decisiones humanas.

## Consequences

- El contexto seleccionado es justificable y testeable sin servicios externos.
- La cobertura inicial será menos semántica, pero podrá evolucionar con embeddings sin cambiar el contrato de impacto.
- La reconciliación documental se convierte en una gate visible del workflow.
- Los documentos canónicos requieren intervención humana cuando cambia su significado.
