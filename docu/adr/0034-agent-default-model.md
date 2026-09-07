# ADR-0034: Modelo por defecto por agente, subordinado a la conversación

## Status

Accepted

## Date

2026-09-07

## Amends

La regla «una conversación nueva arranca siempre en `Provider default`», registrada en [ADR-0027](0027-provider-scoped-model-selection.md) y en el contrato de modelo de [SPEC-agent-providers](../specs/SPEC-agent-providers.md#agents-workbench).

## Context

El catálogo de modelos es dependiente del provider y la elección pertenece a la conversación, que la persiste en `agent_sessions`. Falta la pieza intermedia: quien trabaja siempre con el mismo modelo para un agente tenía que volver a elegirlo en cada conversación nueva, porque el único punto de partida posible era `Provider default`.

Un valor por defecto introduce un conflicto de precedencia. Si el default pudiera reescribir conversaciones existentes, marcarlo cambiaría bajo los pies del operador el modelo de un hilo ya en marcha —y con él el coste y el comportamiento del siguiente turno— sin que nadie lo pidiera en esa conversación.

## Decision

Cada agente admite un modelo por defecto, marcable con una estrella desde la propia fila del menú `Model`. El menú es el sitio de la acción porque es donde el operador ya está comparando modelos; la estrella es un control aparte del que elige, de modo que marcar y seleccionar nunca se confunden.

La precedencia es explícita y en un solo sentido: **la conversación gana siempre**. El default sólo siembra el punto de partida de una conversación nueva y de un cambio de agente dentro de una conversación aún sin modelo propio. Una conversación que ya tiene modelo —`Provider default` incluido, porque elegirlo es una elección— conserva el suyo aunque el default cambie después. Marcar un default no toca la conversación abierta; el feedback lo dice con esas palabras: «New Claude Code conversations start on Claude Opus».

`Provider default` no se puede marcar: es la ausencia de override, no un modelo.

El default vive en `localStorage` de la shell, indexado por provider, y se descarta al leerlo si el alias ya no pertenece al catálogo de ese provider. No entra en SQLite: no es evidencia de una Task ni de un ChangeSet, sino una preferencia de quien opera esta instalación.

## Alternatives Considered

### Que el default se aplique a toda conversación sin turnos todavía

Rechazado: obliga al operador a saber si un hilo cuenta ya como «empezado» para predecir qué modelo se usará. La regla «la conversación gana desde que tiene modelo» es verificable mirando la cabecera.

### Persistir el default en `agent_sessions` o en la configuración del Project

Rechazado para esta iteración: el default es del operador, no del Project, y replicarlo por Project multiplicaría los sitios donde una misma preferencia puede discrepar.

### Un ajuste de preferencias fuera del menú

Rechazado: aleja la decisión del momento en que se toma y añade una superficie de configuración para un único valor por agente.

## Consequences

- Una conversación nueva arranca en el modelo que el operador marcó para ese agente, y en `Provider default` mientras no marque ninguno.
- Cambiar de modelo dentro de una conversación sigue siendo local a esa conversación y sobrevive al reinicio, como ya garantizaba la persistencia en `agent_sessions`.
- La preferencia no viaja con el repositorio ni con el Project: reinstalar o cambiar de máquina la pierde, que es el precio de no meter configuración personal en la evidencia del proyecto.
- Si un provider retira un alias, el default deja de aplicarse en silencio y el punto de partida vuelve a `Provider default`.
