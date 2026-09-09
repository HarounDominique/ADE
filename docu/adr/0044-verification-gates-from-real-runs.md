# ADR-0044 — Las gates `build` y `tests` citan ejecuciones reales

## Status

Accepted

## Date

2026-09-09

## Amends

Las gates de [ADR-0007](0007-gated-change-review.md) y el control de ejecución de [ADR-0038](0038-external-project-toolchains.md), que hasta ahora no se conocían.

## Context

Descrito como G2 y G3 en [product-gap-audit](../knowledge/product-gap-audit.md). La gate `build` se daba por pasada por la mera existencia de un `ChangeSet`, que no es una build. La gate `tests` exigía evidencia de tipo `verification` que ningún punto del código escribía, de modo que con la policy por defecto la aprobación humana quedaba bloqueada de forma permanente y el bucle no cerraba.

Mientras tanto, `run-configurations` ya sabía detectar y ejecutar build, test y lint para Node, Python, Maven/Gradle, Rust, Go y .NET, con consola por ejecución. Su código de salida se mostraba y se descartaba.

## Decision

Una configuración de ejecución puede declarar qué verifica: `verifies: "build"` o `verifies: "tests"`. La detección lo propone sola —un script `build` propone la verificación `build`, un `test` propone `tests`, `lint` no propone ninguna—, y aceptar la propuesta es lo que la convierte en verificación del Project.

Cuando el operador arranca una de esas configuraciones bajo una Task, ADE conserva la cola de su salida y, al terminar el proceso, escribe evidencia `verification.<qué>.pass` o `.fail` con el código de salida y esa cola. Las gates `build` y `tests` leen la evidencia más reciente de su tipo: su código de salida decide. Un Project que nunca ejecutó una verificación deja la gate en `pending`, no en `passed`.

Un run que el operador detiene no escribe evidencia: no prueba nada en ninguna dirección, y registrarlo como fallo culparía al código de una decisión humana.

Una configuración de tipo `service` no puede declarar verificación. Una gate cita algo que terminó; un servicio está pensado para seguir vivo, así que su código de salida no dice nada del código que corre debajo.

## Alternatives Considered

### Que ADE ejecute build y tests por su cuenta al capturar el ChangeSet

Rechazado: obligaría a ADE a adivinar el comando de cada repositorio, que es justo lo que [ADR-0038](0038-external-project-toolchains.md) decidió no hacer. El Project declara sus comandos; ADE los ejecuta cuando se lo piden.

### Deducir la verificación del nombre del comando

Rechazado: `npm test` en un repositorio puede ser un smoke y en otro la suite entera. Que el Project lo declare hace explícito lo que la gate cita.

### Aceptar cualquier ejecución como evidencia de la gate

Rechazado: arrancar el servidor de desarrollo pasaría `build`. La declaración es lo que separa una ejecución de una verificación.

### Dejar `tests` fuera de las gates requeridas por defecto

Rechazado ahora que tiene productor. Mientras no lo tuvo, exigirla era exigir lo imposible; con productor, exigirla es exactamente lo que el producto promete.

## Consequences

- `build` y `tests` sólo pasan cuando un proceso real terminó en 0, y fallan cuando terminó en otra cosa, con la cola de su salida como evidencia citable.
- La gate deja de pasar por tener un ChangeSet: capturar cambios y verificarlos vuelven a ser cosas distintas.
- Un Project sin configuraciones de verificación no puede completar el flujo por defecto. Es la lectura honesta: nadie construyó ni probó nada. Puede declarar su propia `requiredGates` en `.ade/policy.json`.
- La evidencia se ata a la Task activa cuando la ejecución se lanza con una seleccionada; sin Task, la ejecución sigue siendo una ejecución y ninguna gate la reclama.
- La cola guardada está acotada, y la política de evidencia del Project la recorta además por longitud.
