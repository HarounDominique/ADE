# ADR-0048 — Punto de retorno antes de un turno con escritura

## Status

Accepted

## Date

2026-09-09

## Amends

Los permisos por turno de [ADR-0026](0026-agent-provider-catalog.md) y la entrada al pipeline de [ADR-0043](0043-agent-turn-as-pipeline-entry.md), que hacían del turno el punto donde el repositorio cambia sin dar forma de deshacerlo.

## Context

Descrito como G6 en [product-gap-audit](../knowledge/product-gap-audit.md). Un turno con `write_code` o `write_docs` escribe directamente sobre el working tree del operador. Si el resultado no sirve, la única vuelta atrás era Git a mano, y sólo para lo que estuviera trackeado: un fichero que el agente inventó y otro que borró sin commitear no los recupera ningún `git checkout`. ADE ofrecía el riesgo y no la reversión.

El hueco tiene además una consecuencia que ya se registró en [ADR-0043](0043-agent-turn-as-pipeline-entry.md): el ChangeSet de un turno retrata el working tree entero, no lo que ese turno cambió. Sin una foto del antes, ADE no tiene con qué comparar.

## Decision

Antes de ejecutar un turno con permiso de escritura sobre una Task, ADE fotografía el working tree completo —trackeado, staged y no trackeado, respetando `.gitignore`— y lo guarda como un objeto commit que ninguna rama apunta, sostenido por una referencia bajo `refs/ade/checkpoints/`.

La foto se toma con un índice temporal, de modo que lo que el operador tuviera staged sigue igual después. `HEAD`, la rama y el índice no se mueven: **ADE no crea commits en la rama del usuario**, ni siquiera para poder deshacer. El commit se firma como `ADE`, nunca con la identidad del operador, y un repositorio sin identidad configurada puede igualmente tomarlo.

Un turno que sólo lee no deja checkpoint: no hay nada de lo que volver. Un Project sin Git no puede tener uno, y la shell lo dice antes de que el turno escriba en lugar de dejar creer que hay vuelta atrás.

Restaurar deja el working tree exactamente como estaba en la foto: se borra lo que el turno añadió y se reescribe el resto desde el checkpoint. Es destructivo por definición, así que exige una confirmación explícita en el diálogo propio de la shell, y el seam rechaza la petición sin `confirmed`. Antes de restaurar toma un checkpoint del estado actual, con lo que deshacer el deshacer es posible y aparece en la misma lista.

Los checkpoints viven en la Task, junto a las gates, la evidencia y la traza Git, porque es donde se juzga el trabajo. Una restauración se registra como operación Git de la Task y como evidencia de runtime.

## Alternatives Considered

### `git stash` sobre el repositorio del operador

Rechazado: `stash` mueve el working tree del operador en el momento de crearlo, mezcla el estado del índice y arrastra un stash visible que no es suyo. Un checkpoint debe ser invisible hasta que se pida.

### Un commit en la rama del usuario, deshecho después

Rechazado: escribe en la historia que el operador va a publicar. La reversión de un turno no puede costar una entrada en su rama ni un `reset` que pueda alcanzar a otra cosa.

### Copiar el directorio fuera del repositorio

Rechazado: duplica el árbol entero por turno, no comparte objetos con Git, y deja a ADE inventando una gestión de instantáneas que Git ya tiene resuelta.

### Restaurar automáticamente cuando el turno falla

Rechazado: un turno fallido puede haber dejado trabajo útil, y decidir por el operador que no sirve es exactamente lo que este ADR intenta devolverle. La vuelta atrás se ofrece; no se toma sola.

## Consequences

- Un turno con escritura tiene punto de retorno antes de ejecutarse, y el operador puede volver a él con una confirmación desde la Task.
- La vuelta atrás alcanza lo que Git por sí solo no devuelve: ficheros no trackeados que el turno borró y ficheros que inventó.
- Restaurar es reversible: la restauración se fotografía a sí misma antes de actuar.
- Existe por fin una referencia del antes con la que un ChangeSet podría acotarse al delta del turno. Ese cálculo no se implementa aquí.
- Los checkpoints se acumulan como refs en el repositorio y hoy no se podan; un mantenimiento de retención queda abierto.
- Un Project sin Git sigue sin punto de retorno, y lo declara en vez de simularlo.
