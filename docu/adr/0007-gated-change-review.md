# ADR-0007 — Gates declarativas para aceptar y enviar cambios

## Status

Accepted for MVP

## Date

2026-09-02

## Context

Un agente puede terminar una sesión sin que el cambio compile, pase los tests, respete la documentación o sea aceptable para el usuario. El ChangeSet debe conservarse aunque una comprobación falle, y el workflow debe indicar dónde continuar sin perder evidencia.

## Decision

Representar build, tests, review independiente, reconciliación documental, aprobación humana y commit como gates declarativas con estado, actor, evidencia y recomendación de reentrada. Las gates obligatorias bloquean `SHIP`; los findings se resuelven, asignan, aceptan con riesgo o descartan de forma explícita.

Cada ciclo de implementación genera un ChangeSet nuevo y cada re-review una Review nueva. El MVP persiste checkpoints y deja la restauración automática para una decisión posterior. El commit siempre requiere aprobación humana previa.

## Alternatives considered

### Confiar en el estado final del agente

- Ventaja: flujo corto.
- Rechazo: el agente no es autoridad independiente sobre la aceptabilidad del resultado.

### Un único estado booleano de calidad

- Ventaja: UI y persistencia simples.
- Rechazo: oculta qué evidencia falta y no ofrece una reentrada localizada.

### Hacer commit automático tras tests verdes

- Ventaja: maximiza automatización.
- Rechazo: no cubre impacto documental, findings ni intención humana; contradice `human-in-command`.

## Consequences

- El estado de una Task puede explicarse mediante gates y evidencias concretas.
- Los fallos no destruyen trabajo y conducen a BUILD, VERIFY, REVIEW o RECONCILE.
- La futura UI debe hacer visibles gates, findings y decisiones antes de mostrar la acción de commit.
- La policy de cada Project podrá endurecer o relajar gates informativas sin cambiar el dominio base.
