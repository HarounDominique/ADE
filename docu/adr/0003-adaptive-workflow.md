# ADR-0003 — Workflow adaptativo con fases orientativas y gates obligatorias

## Status

Accepted for MVP

## Date

2026-09-02

## Context

ADE necesita reducir omisiones durante el desarrollo asistido por agentes, pero una secuencia rígida de skills penaliza los cambios pequeños y no representa bien la incertidumbre que aparece durante la exploración o la revisión. El producto debe soportar tanto un cambio trivial como una modificación arquitectónica sin convertir ambos en el mismo ritual.

## Decision

Adoptar un workflow adaptativo compuesto por fases orientativas (`FRAME`, `EXPLORE`, `DESIGN`, `BUILD`, `VERIFY`, `REVIEW`, `RECONCILE`, `SHIP`) y gates declarativas que protegen los invariantes. Los modos `quick`, `standard`, `design-heavy` y `recovery` proponen recorridos distintos, pero el sistema puede saltar fases opcionales, escalar o reentrar en una fase anterior.

Las transition skills proponen resultados y evidencias; la aplicación valida las transiciones y el dominio conserva el historial. Sólo las gates obligatorias y la aprobación humana pueden bloquear o permitir `SHIP`.

## Alternatives considered

### Pipeline rígido de skills

- Ventaja: fácil de explicar y automatizar.
- Rechazo: impone coste innecesario a cambios pequeños y fuerza un “re-discuss” global aunque el problema esté localizado.

### Flujo totalmente libre basado en conversación

- Ventaja: máxima flexibilidad.
- Rechazo: permite omitir evidencia, dificulta reanudar el trabajo y hace ambiguo cuándo una Task puede cerrarse.

### Motor de workflow externo desde v0.1

- Ventaja: ofrece persistencia y visualización de procesos maduras.
- Rechazo: añade una dependencia estructural antes de validar el modelo de dominio y las gates propias de ADE.

## Consequences

- El flujo se adapta al riesgo sin perder trazabilidad.
- Los loops de re-build, re-verify y re-review son naturales y conservan ChangeSets y evidencias previas.
- La UI futura debe mostrar fase, gates y motivo de reentrada, no sólo una barra lineal de progreso.
- La matriz de transiciones y el contrato de gates pasan a ser interfaces estables entre workflow, runtime, knowledge y governance.
