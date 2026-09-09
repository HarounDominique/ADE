# ADR-0049 — Leer el coste donde está el trabajo

## Status

Accepted

## Date

2026-09-09

## Amends

La contabilidad por turno de [ADR-0040](0040-agent-turn-accounting.md), que decidió medir y dejó explícitamente sin decidir la superficie.

## Context

Descrito como G7 en [product-gap-audit](../knowledge/product-gap-audit.md). Desde ADR-0040 cada turno contabilizado escribe una fila en `agent_turn_usage` con entrada, salida, cache leída, cache escrita y coste declarado. Ninguna superficie la leía: el dato existía y la pregunta que el usuario se hace a diario —qué ha costado esta conversación, qué ha costado esta Task— seguía sin respuesta dentro de la aplicación.

ADR-0047 empezó a mostrar el consumo del turno junto a su respuesta, pero sumaba la cache dentro de la entrada, que es justo la distinción que ADR-0040 se molestó en persistir por separado.

## Decision

El consumo se lee en las tres unidades en que el trabajo existe, y siempre con la misma gramática: entrada, salida, cache y coste cuando el proveedor lo declara.

- **Por turno**, en la traza plegada bajo la respuesta que lo produjo. La cache se dice aparte de la entrada, porque no es lo que se pagó a precio completo.
- **Por conversación**, bajo los diales de presión del rail, que ya dicen cuánto queda; el total dice cuánto se ha gastado.
- **Por Task**, en su detalle, sumando todas las conversaciones celebradas bajo ella y sólo esas.

Una unidad sin contabilidad se muestra como desconocida, nunca como cero. La consulta devuelve ausencia —no una fila de ceros— cuando ningún turno fue contabilizado, y la shell lo dice con esas palabras: *no reportado por este agente*. Un total con turnos sin precio conserva el coste de los que sí lo declararon y dice de cuántos turnos habla, en lugar de sumar nulos como si fueran gratis. OpenCode, que hoy no expone consumo, aparece por tanto como desconocido y no como trabajo gratuito.

El total se pide al abrir una conversación y al terminar un turno, porque el turno es la unidad que se contabiliza. Una respuesta que llega para una conversación que el operador ya abandonó se descarta, como ya hacen la presión y los mensajes.

## Alternatives Considered

### Mostrar sólo el coste en dólares

Rechazado: el precio depende del proveedor y del plan, y varios no declaran ninguno. Los tokens son la medida que siempre existe; el coste acompaña cuando lo hay.

### Sumar la cache dentro de la entrada

Rechazado: es exactamente lo que ADR-0040 separó, y es la diferencia entre un turno caro y uno barato en una conversación larga.

### Un panel de costes aparte

Rechazado: obliga a salir del trabajo para preguntar por él. El coste pertenece al turno, a la conversación y a la Task, que ya tienen superficie.

### Mostrar cero cuando el proveedor no informa

Rechazado, y es la razón de ser de este ADR: un cero es una medida. La ausencia de medida se dice como tal o el operador comparará proveedores con un dato inventado.

## Consequences

- La pregunta «¿qué costó esta Task?» tiene respuesta dentro de Assay, sin abrir la base de datos.
- La comparación entre modelos y proveedores tiene por fin una superficie, que es el paso previo al enrutado estructural que ADR-0040 dejó diferido.
- Una conversación de OpenCode se lee como no contabilizada, lo que hace visible el hueco de su seam en lugar de disimularlo.
- El coste mostrado es el que declara el proveedor: ADE no aplica tarifas propias ni estima el precio de un turno que nadie preció.
