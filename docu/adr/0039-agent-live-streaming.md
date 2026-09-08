# ADR-0039 — Streaming vivo de Agents con actividad pública

## Status

Accepted

## Date

2026-09-08

## Amends

La primera integración de Claude Code y la visibilidad de turnos de [ADR-0026](0026-claude-code-cli-adapter.md) y [ADR-0029](0029-chatgpt-inspired-agent-workbench.md).

## Context

`Agents` sólo mostraba `Thinking` hasta que el runtime terminaba. OpenCode ya tenía un stream SSE, pero Codex y Claude Code se ejecutaban como procesos CLI cuyo stdout se acumulaba antes de devolver la respuesta. La experiencia hacía indistinguible un turno lento de uno bloqueado y no aprovechaba los eventos parciales que ambos CLIs ya pueden emitir.

El requisito de «flujo de pensamiento» necesita una frontera explícita: el transcript puede mostrar la respuesta incremental y la actividad que el proveedor hace pública, pero ADE no debe solicitar ni presentar la cadena de pensamiento privada del modelo.

## Decision

El puerto `AgentRuntimePort` admite un callback interno por prompt para que el adapter entregue eventos normalizados mientras el proceso sigue vivo. El sidecar los convierte en dos mensajes de protocolo:

- `agent.output`, con deltas de texto de la respuesta, que la shell concatena en el turno pendiente.
- `agent.activity`, con acciones verificables, que la shell muestra como rastro de trabajo.

Codex conserva `--json` y se consume como JSONL; las actualizaciones de un `agent_message` se convierten en deltas calculando la diferencia con el snapshot anterior. Claude Code usa `--print --output-format stream-json --include-partial-messages` y sólo se aceptan sus `text_delta` públicos. OpenCode mantiene SSE y usa la misma normalización cuando expone partes de texto.

La normalización no convierte el protocolo del provider en interfaz: únicamente publica comandos, operaciones de fichero, búsquedas y llamadas a herramientas con contexto. Hitos como `thread.started`, `turn.started`, chunks de texto y errores transitorios sin una acción asociada se descartan.

La respuesta completa se persiste una sola vez al terminar el turno, junto con el prompt. Los deltas no se escriben individualmente en SQLite; un aborto o fallo no deja una respuesta parcial persistida. La UI conserva el turno efímero hasta `COMPLETED`, `STOPPED` o error.

## Alternatives Considered

### Mantener sólo el spinner `Thinking`

Rechazado: oculta progreso real y no permite distinguir espera, actividad y respuesta.

### Exponer el chain-of-thought completo

Rechazado: la interfaz sólo debe mostrar texto de respuesta y eventos públicos y verificables del proveedor; el razonamiento privado no forma parte del contrato de ADE.

### Persistir cada delta

Rechazado: aumenta escrituras y deja transcript parcial ambiguo al cancelar. La persistencia atómica al completar conserva el historial como conversación válida.

## Consequences

- Codex, Claude Code y OpenCode pueden actualizar `Agents` mientras trabajan.
- Un proveedor que no emita deltas sigue mostrando estado y actividad disponible, sin pasos inventados.
- Los adapters mantienen la autenticación y sus formatos; el frontend sólo conoce el protocolo del sidecar.
- La respuesta parcial se pierde al detener o fallar el turno, de forma coherente con la persistencia de conversaciones completas.
