# ADR-0025: Runtime transversal y Git workspace acotado a Version control

## Status

Accepted

## Date

2026-09-05

## Context

La shell acumulaba paneles operativos compartidos fuera de la superficie que les daba sentido. En particular, `Git workspace` aparecía junto al contenido de Projects, Tasks, Project context y otras vistas, aunque su estado y sus acciones pertenecen al trabajo de control de versiones. Del mismo modo, el runtime ya no necesita una vista lateral propia: Agents, Work, terminal y el sidecar consumen su estado de forma transversal.

Esta duplicación aumentaba la densidad visual, hacía difícil entender qué se podía hacer en cada menú y restaba espacio al contenido principal. La topbar ya ofrece el contexto global de Project, Task y branch, por lo que no debe convertirse en otro panel Git operativo.

## Decision

`Git workspace` sólo se renderiza dentro de `Version control`. `Projects`, `Editor`, `Agents`, `Work` y `Project context` no muestran su estado ni sus acciones Git; conservan únicamente las responsabilidades propias de cada vista. La topbar mantiene los selectores globales `Current project`, `Current task` y `Current branch` como orientación y cambio de contexto.

El runtime y los servicios permanecen implementados en el sidecar y en los casos de uso correspondientes, pero se tratan como infraestructura transversal y no como una entrada de navegación o panel visible independiente.

## Alternatives considered

### Mantener Git workspace en todas las vistas

Rechazado: repite información y acciones fuera del contexto de control de versiones, elevando la carga cognitiva sin aportar capacidad adicional.

### Eliminar las capacidades internas de runtime y servicios

Rechazado: Agents, Work, terminal, evidencia y lifecycle del sidecar dependen de ellas aunque no necesiten un menú propio.

### Mover el Git workspace a la topbar

Rechazado: la topbar necesita ofrecer contexto global persistente, no convertirse en un segundo workbench de operaciones Git.

## Consequences

- `Version control` concentra historial, cambios pendientes, diffs y operaciones Git relacionadas con la Task.
- Las demás vistas ganan espacio y presentan una responsabilidad más clara.
- El estado del runtime sigue disponible para los consumidores que lo necesitan y no se rompe el sidecar.
- Las specs, planes, tareas y artefactos derivados deben describir el runtime como infraestructura transversal y `Git workspace` como panel exclusivo de `Version control`.
