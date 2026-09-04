# ADR-0020: Version control como superficie Git operativa

## Status

Accepted

## Date

2026-09-04

## Context

La entrada visible `Review queue` mezclaba revisión de Tasks con una presentación estática que no ayudaba a inspeccionar el estado real del repositorio. El flujo diario del desarrollador necesita consultar commits, entender qué ficheros cambió cada uno, revisar diffs y publicar cambios pendientes sin abandonar ADE.

## Decision

La entrada conserva el icono de control de versiones y se renombra a `Version control`. La vista tiene dos pestañas:

- `History`: commits recientes, autor, fecha, ficheros modificados y diff completo o por fichero.
- `Changes`: ficheros pendientes, diff local, título de commit, cuerpo opcional y `Commit & Push`.

También ofrece `Fetch origin`. Las lecturas se implementan mediante `git.history`, `git.commit.diff` y `git.pending`; las mutaciones `git.fetch.origin` y `git.commit.push` atraviesan el sidecar y requieren confirmación, actor y razón. `Commit & Push` crea el commit y después empuja la rama actual a `origin`.

## Alternatives considered

### Mantener `Review queue`

Rechazado: el nombre y la vista no reflejan el trabajo real de inspección y publicación Git.

### Mostrar sólo el diff global

Rechazado: sin historial navegable ni selección por fichero, el usuario no puede aislar el cambio que necesita entender.

### Ejecutar Git directamente desde la UI

Rechazado: rompería la frontera del sidecar y dificultaría permisos, errores, auditoría y futuras implementaciones de otros VCS.

## Consequences

- La navegación expresa la capacidad actual sin cerrarla a Git como único VCS futuro.
- Las lecturas de historial y pendientes son rápidas, acotadas al Project activo y no mutan el árbol.
- El flujo de publicación está centralizado y exige consentimiento explícito.
- La antigua Review queue deja de ser una superficie visible; la trazabilidad de Task y Review permanece en los modelos y operaciones persistidas del dominio.
