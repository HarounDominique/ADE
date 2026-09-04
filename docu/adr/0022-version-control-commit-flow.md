# ADR-0022: Commit local y publicación separada en Version control

## Status

Accepted

## Date

2026-09-05

## Supersedes

[ADR-0020](0020-version-control-surface.md)

## Context

La primera versión de `Version control` agrupaba commit y publicación en una única acción. Ese flujo ocultaba un punto de decisión importante: el usuario puede querer inspeccionar el commit local, continuar trabajando o publicarlo más tarde. Además, el panel persistente de commit reducía el espacio disponible para leer el diff, que es la actividad principal de la pestaña `Changes`.

## Decision

`Version control` conserva dos pestañas:

- `History`: historial navegable, ficheros modificados y diff del commit seleccionado.
- `Changes`: lista de cambios pendientes y diff legible del fichero seleccionado.

El botón `Commit` vive junto a las pestañas y abre un diálogo modal con título obligatorio y cuerpo opcional. Sólo crea el commit local. Tras un commit correcto, `Push origin` se habilita como acción independiente y publica la rama actual bajo confirmación explícita. `Fetch origin` permanece separado. Ninguna de estas acciones elimina el diff ni la evidencia de la Task si una operación posterior falla.

## Alternatives considered

### Mantener `Commit & Push`

Rechazado: mezcla dos decisiones reversibles con distinto riesgo y no permite revisar el commit local antes de publicarlo.

### Reservar una columna fija para el formulario de commit

Rechazado: consume espacio permanente en la superficie de diff y hace que la vista `Changes` se parezca menos a un cliente Git de escritorio.

### Crear el commit desde un panel sin diálogo

Rechazado: el diálogo concentra el foco, permite introducir el mensaje completo y hace explícito el alcance de la mutación.

## Consequences

- El diff ocupa la superficie principal de `Changes` y la lista de ficheros sigue siendo seleccionable.
- Commit y push pueden verificarse y fallar de forma independiente.
- El modelo de operaciones Git conserva atribución, actor, razón y confirmación mediante el sidecar.
- ADR-0020 permanece en el historial como decisión anterior, pero ya no representa el contrato vigente.
