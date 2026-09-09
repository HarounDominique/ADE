# ADR-0047 — La traza del turno se conserva junto a la respuesta

## Status

Accepted

## Date

2026-09-09

## Amends

El streaming de [ADR-0039](0039-agent-live-streaming.md), que publicaba la actividad en vivo y la descartaba al terminar.

## Context

Hasta ahora la conversación recordaba la respuesta y nada más. La actividad —comandos ejecutados, ficheros leídos o escritos, herramientas usadas— vivía en el turno en vuelo y desaparecía al completarse; el diff del turno se mostraba una vez y no se persistía con el mensaje; el consumo se guardaba aparte, sin relación visible con la respuesta que lo causó.

Es la costumbre de los CLIs: el spinner se apaga y se lleva por delante lo que hizo. Para un desarrollador esa información es justo la que permite comprobar una respuesta en lugar de creerla, que es la postura que da nombre al producto.

## Decision

El mensaje del agente conserva la traza del turno que lo produjo: proveedor y modelo, duración, actividad pública reportada, ficheros tocados con sus líneas añadidas y eliminadas, y el consumo con su coste cuando el proveedor lo declara. Se guarda como parte del propio mensaje, no en una tabla paralela: la evidencia pertenece a la respuesta, y borrar la conversación se lleva ambas.

En la conversación, la respuesta sigue siendo lo que se lee. La traza va debajo, plegada, y se despliega con puntero o teclado.

La traza recoge **actividad pública verificable**, no la cadena de pensamiento privada del modelo. Esa frontera la fijó [ADR-0039](0039-agent-live-streaming.md) y esta decisión no la mueve: lo que se conserva es lo que se puede comprobar —qué comando corrió, qué fichero cambió, cuánto costó—, no lo que el modelo se dijo a sí mismo. Cambiar esa frontera sería otra decisión, tomada a la vista y no de rebote.

Una conversación anterior a esta decisión no tiene traza y se lee igual; editar el contenido de un mensaje no borra la traza que ya llevaba.

## Alternatives Considered

### Una tabla de traza aparte, referenciada por el mensaje

Rechazado para esta iteración: obliga a mantener dos ciclos de vida y a recordar borrar el segundo. La traza no tiene sentido sin su respuesta.

### Reconstruir la traza a demanda desde la evidencia de la Task

Rechazado: la evidencia de Task existe sólo cuando hay Task, se poda por política y no distingue de qué turno vino. Una conversación sin Task se quedaría sin nada.

### Mostrar la traza siempre desplegada

Rechazado: la conversación se lee por las respuestas. Un turno con veinte comandos empujaría la siguiente respuesta fuera de la pantalla.

### Conservar también el razonamiento privado del proveedor

No tomada aquí. Sigue vigente la frontera de ADR-0039.

## Consequences

- Un turno deja de perder lo que hizo: la respuesta queda, y con ella lo que la produjo.
- La conversación gana peso en SQLite proporcional a la actividad; la traza guarda resúmenes, no la salida completa de cada comando.
- Con proveedores que no emiten progreso —Codex en `exec --json` no manda eventos incrementales— la traza sigue apareciendo al terminar, que es cuando ese proveedor la entrega. El directo depende del proveedor; la conservación, no.
- La respuesta copiada sigue siendo sólo la respuesta: la traza es para leer, no para pegar en otro sitio.
