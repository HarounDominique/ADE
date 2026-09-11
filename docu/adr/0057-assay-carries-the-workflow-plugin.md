# ADR-0057 — Assay lleva el plugin del workflow dentro

## Status

Accepted

## Date

2026-09-11

## Amends

[ADR-0056](0056-native-development-workflow.md), que decidió implementar el workflow nativamente y mantener SEED como proyecto independiente del que Assay no dependiera. La primera mitad se mantiene. La segunda se sustituye.

## Context

ADR-0056 registró que «ninguna de las dos superficies puede exigir la otra» y que un cambio en la metodología «se decide una vez y se aplica a las dos a mano». Eso describía una relación entre dos proyectos que había que coordinar.

La primera vez que alguien intentó usar SEED desde el terminal de Assay, el agente respondió que no veía ningún plugin `seed` en el proyecto y ofreció interpretarlo como *database seeding*. Tenía razón en que no estaba: el plugin no se había instalado en esa máquina. Pero buscó en el árbol del Project, que no es donde vive un plugin de Claude Code, y ante la ausencia inventó un significado en lugar de nombrarla.

El defecto no es del agente. Es que la presencia de la metodología era una propiedad de la máquina y no del producto. Assay prometía un workflow y luego dependía de que el operador hubiera instalado por su cuenta la pieza que lo expresa.

Mientras tanto SEED se publicó como repositorio propio. Existe, es público, cualquiera puede tomarlo, instalarlo en su agente y modificarlo sin tener nada que ver con Assay. Esa vía ya está abierta y no hace falta protegerla desde aquí.

## Decision

**Assay incorpora SEED a su propio código.** La fuente vive en `plugins/seed/` del repositorio y viaja en el bundle como recurso. Assay deja de resolver, pedir o suponer el plugin: lo lleva.

**Cada turno de Claude Code recibe `--plugin-dir` apuntando a esa copia.** El adapter lo resuelve por turno, no una vez al importar, porque un `.app` empaquetado y una ejecución desde fuente lo tienen en sitios distintos. Un turno que no encuentre plugin corre igual: sin plugin, no sin turno.

**Assay pasa a ser Assay más SEED, y se sigue llamando Assay.** No hay producto compuesto, ni marca doble, ni módulo con nombre propio dentro del producto. La metodología es parte de lo que Assay es.

**El repositorio `seed` sigue su vida por separado, y eso deja de ser asunto de Assay.** No se le debe sincronización, no se le pide permiso y no se coordina con él. Si diverge, diverge: está publicado precisamente para que cualquiera pueda tomarlo y llevarlo donde quiera. La obligación de mantener las dos superficies en sintonía que registraba ADR-0056 queda retirada.

## Alternatives Considered

### Submodule apuntando al repositorio `seed`

Ventaja: una sola historia de ficheros, actualización explícita y visible.

Rechazado: un clon sin `--recursive` deja a Assay sin la metodología que promete, y el fallo aparece en tiempo de ejecución, ante el usuario, con la misma forma que el que motivó este ADR. Una dependencia que puede faltar no es lo mismo que llevarla dentro.

### Resolver el plugin instalado en la máquina

Ventaja: cero cirugía, y aprovecha lo que el operador ya tenga.

Rechazado: es exactamente la situación que falló. Assay no controla lo que hay instalado, y «lo encuentro si está» no es una propiedad sobre la que se pueda construir un producto.

### Subtree con sincronización de vuelta al repositorio `seed`

Ventaja: una fuente, dos destinos publicables.

Rechazado por innecesario. Presupone que Assay sigue siendo responsable de lo que reciba quien instale el plugin suelto, y esa responsabilidad se acabó cuando el repositorio se publicó. Mantener el puente costaba trabajo recurrente para garantizar algo que nadie ha pedido.

### Garantizar también el terminal PTY

El dock de terminal ejecuta el shell real del operador, así que Assay no decide sus argumentos: lo que se escriba ahí usará lo que la máquina tenga instalado. Queda fuera a propósito. La superficie que Assay conduce es `Agents`, y es la que se garantiza.

## Consequences

- Un turno de `Agents` dispone del workflow sin que nadie haya instalado nada, en cualquier máquina donde Assay corra.
- El plugin viaja en el `.app`: `plugins/seed` se copia como recurso `seed` y el shell pasa `ADE_SEED_PLUGIN_DIR` cuando existe. Desde fuente, el sidecar lo encuentra por su cuenta en el repositorio.
- `ADE_SEED_PLUGIN_DIR` sustituye la búsqueda en vez de ampliarla: un build que dice dónde puso el plugin y se equivoca debe fallar de forma visible, no caer en silencio sobre una copia que hubiera por ahí.
- La copia vendida y el repositorio publicado pueden divergir. Es aceptado y esperado; no hay proceso que los reconcilie.
- El terminal PTY sigue dependiendo de lo que el operador instale. Es una diferencia real entre dos superficies y se documenta como tal en vez de dejar que parezca un fallo.
