# ADR-0041 — Presión de uso y contexto visible en Agents

## Status

Accepted

## Date

2026-09-08

## Amends

La contabilidad por turno de [ADR-0040](0040-agent-turn-accounting.md), que registraba consumo sin exponerlo, y la superficie de `Agents` de [ADR-0029](0029-chatgpt-inspired-agent-workbench.md).

## Context

El operador decide cuándo lanzar un turno sin saber cuánto le queda de su ventana de sesión, de la semanal, ni cuánto contexto lleva ocupado la conversación. Esa información existe, pero no en el mismo sitio para todos los proveedores:

- Codex la publica entera en su evento `token_count`: `model_context_window`, `last_token_usage` y `rate_limits` con el porcentaje ya gastado y los minutos de cada ventana.
- Claude Code publica sus ventanas de plan —cinco horas y siete días— sólo en el contrato de su status line interactiva. En `--print`, que es como ADE lo ejecuta, el evento `result` lleva `usage`, `modelUsage` y coste, pero ninguna ventana de plan.
- OpenCode no expone ninguna de las dos cosas en este seam.

## Decision

`Agents` muestra tres diales en el pie del rail de conversaciones: sesión, semana y contexto. Cada uno se llena con lo gastado y su etiqueta dice lo que queda. El puntero —o el foco de teclado— revela el porcentaje; el nombre accesible lo lleva siempre.

Un dial sólo muestra número cuando el proveedor reportó el dato. Lo que no se reporta se dibuja como desconocido —un guion y un anillo discontinuo— y su tooltip lo dice. ADE no infiere una ventana de plan que el proveedor no publica, ni convierte una ausencia en cero.

Los adapters traducen su propio formato al tipo `ProviderPressure` del puerto. El contexto se mide con los tokens que la última petición dejó en la ventana, tokens de cache incluidos, porque siguen ocupándola. Cuando el proveedor no declara el tamaño de ventana, ADE la deduce del alias del modelo si lo conoce y, si no, muestra los tokens sin porcentaje.

Las ventanas de plan pertenecen a la cuenta y sobreviven a la conversación: se guardan por proveedor en `agent_pressure` y se recuperan al abrir la app. El contexto pertenece a la conversación y se guarda por sesión. Un turno vivo actualiza ambos mediante el evento `agent.pressure`, sin esperar a que termine.

## Alternatives Considered

### Estimar la ventana de plan de Claude Code contando turnos

Rechazado: produce un número plausible y falso. La shell evita estados simulados, y un aviso de agotamiento inventado es peor que no tener aviso.

### Ejecutar un turno sonda para leer límites al abrir la app

Rechazado: gasta la cuota que el dial pretende proteger.

### Mostrar sólo el contexto, que sí es portable

Rechazado: la pregunta que interrumpe el trabajo es la de la ventana de plan. Mostrar dos de tres con una ausencia honesta informa más que ocultar la carencia.

### Persistir la presión junto a los turnos en `agent_turn_usage`

Rechazado: mezcla una medida de la cuenta con el historial de una conversación. Las ventanas de plan no son un hecho del turno.

## Consequences

- Con Codex, los tres diales dicen algo real desde el primer turno.
- Con Claude Code, el dial de contexto funciona y los de plan quedan explícitamente desconocidos hasta que el CLI los publique en modo no interactivo; el lector defensivo ya los entendería.
- Con OpenCode, los tres quedan desconocidos.
- Antes del primer turno de la sesión, el contexto es desconocido y las ventanas muestran lo último que la cuenta reportó.
- La lectura del porcentaje exige puntero o foco: el pie del rail no compite por atención mientras no se pregunta.
