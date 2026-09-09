# ADR-0043 — El turno de agente es la entrada al pipeline

## Status

Accepted

## Date

2026-09-09

## Amends

El pipeline de [ADR-0007](0007-gated-change-review.md) y la superficie conversacional de [ADR-0029](0029-chatgpt-inspired-agent-workbench.md), que hasta ahora no se tocaban.

## Context

Assay tenía dos mitades que no se comunicaban, descrito como G1 en [product-gap-audit](../knowledge/product-gap-audit.md). `Agents` —la superficie donde el operador trabaja a diario, con Claude Code o Codex— persistía mensajes y mostraba el diff del turno, pero no producía `ChangeSet`, evidencia ni progreso de Task. El pipeline que sí lo hacía, `task.run`, instanciaba `OpenCodeHttpRuntime` de forma fija.

El resultado era que el diferenciador del producto —una Task trazable de la intención a la review— sólo existía con el proveedor que el operador menos ejecuta, y nunca desde la pantalla donde trabaja.

## Decision

Un turno de `Agents` asociado a una Task que deja cambios en el repositorio produce el mismo `ChangeSet` que produce `task.run`, con el proveedor que lo haya ejecutado. La captura vive en la aplicación, no en el adapter: combina el diff que el runtime atribuye a la sesión con el estado real del working tree, y se identifica por turno, de modo que dos turnos de la misma Task son dos ChangeSets y no una colisión.

Un turno que no cambió nada no produce ChangeSet. Un ChangeSet vacío haría pasar la gate `build`, que hoy se resuelve por la mera existencia de un ChangeSet, de forma gratuita; ese hueco (G2) se cierra aparte, y mientras tanto esta decisión no lo agranda.

Cada captura escribe además evidencia `agent.turn` con el proveedor, el modelo y cuántos ficheros cambiaron, sujeta a la política de evidencia del Project.

La Task avanza a `IMPLEMENTED` sólo por transiciones que el workflow ya permite, y se queda donde está cuando no hay camino legal —un segundo turno sobre una Task ya implementada, o una bajo revisión—. Registrar el cambio nunca depende de poder mover la Task.

`task.run` deja de cablear un proveedor: usa el que la petición pida y le transmite los permisos concedidos, porque un runtime CLI sin permisos explícitos sólo puede leer.

## Alternatives Considered

### Capturar el ChangeSet dentro de cada adapter

Rechazado: obligaría a cada proveedor a conocer Task, evidencia y política. El puerto expresa capacidades del runtime; la gobernanza es de la aplicación.

### Capturar en todos los turnos, con cambios o sin ellos

Rechazado: un ChangeSet vacío es ruido en el historial y, peor, satisface hoy una gate requerida sin que nadie haya construido nada.

### Forzar la transición de la Task a `IN_PROGRESS` desde cualquier estado

Rechazado: las transiciones son el invariante del workflow. Un turno no puede reabrir una Task que está bajo revisión sólo porque alguien escribió en el repositorio.

### Reutilizar `runSpike` para el turno conversacional

Diferido: `runSpike` crea sesión propia, colecciona eventos hasta `session.idle` y decide transiciones. El turno de `Agents` ya tiene sesión, streaming y permisos propios; compartir sólo la captura evita duplicar dos flujos de control distintos.

## Consequences

- Trabajar en `Agents` con cualquier proveedor produce ChangeSet, evidencia y progreso de Task; `Changes` deja de estar vacío salvo que se use `task.run`.
- El ChangeSet retrata el working tree en el momento de la captura, no el delta exacto del turno: cambios previos sin commitear entran en él, igual que ya ocurría en `task.run`. Un checkpoint por turno (G6) es lo que permitiría distinguirlos.
- `task.run` puede ejecutar Implementer con Claude Code o Codex, aunque sin streaming de eventos: esos adapters no exponen `events()`.
- La gate `build` sigue pasando por la existencia de un ChangeSet, que no es una build. Cerrarlo es G2 y G3, y esta decisión no lo sustituye.
