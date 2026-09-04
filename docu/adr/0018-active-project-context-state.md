# ADR-0018: Estado único para la identidad del Project activo

## Status

Accepted

## Date

2026-09-04

## Context

La shell permite cambiar entre Projects desde `Projects` y desde la topbar. El cambio inicial actualizaba el nombre visible, pero las respuestas asíncronas posteriores de `project.snapshot` se fusionaban con el fixture cargado al arrancar ADE. Como ese fixture representa el proyecto `ADE`, el título, breadcrumb y selector superior podían volver a mostrar `ADE` aunque el workspace operativo ya apuntase a otro directorio.

## Decision

El frontend mantiene un único `activeProject` como identidad de contexto. Cada snapshot, respuesta de contexto o cambio de rama se fusiona sobre ese estado; las superficies que muestran el Project leen de él mediante `renderSnapshot`. Al cambiar de Project se invalidan también las ramas cargadas del Project anterior.

## Alternatives considered

### Leer el nombre desde el DOM

Rechazado: el DOM es una proyección y puede conservar valores iniciales o recibir respuestas fuera de orden.

### Usar siempre el fixture inicial como base

Rechazado: el fixture sólo sirve como boundary de arranque y no representa el Project seleccionado después.

### Mantener una copia de estado por cada vista

Rechazado: multiplica las posibilidades de divergencia entre topbar, Projects, Editor y paneles operativos.

## Consequences

- Cambiar de Project actualiza de forma consistente nombre, ruta, tipo Git/No Git y branch en todas las superficies del shell.
- Los refreshes asíncronos ya no pueden restaurar el título del Project inicial.
- La UI conserva un modelo local pequeño y no duplica la fuente de verdad persistida del sidecar.
- Las pruebas cubren la fusión de identidad seleccionada con actualizaciones posteriores de branch.
