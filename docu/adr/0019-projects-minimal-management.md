# ADR-0019: Projects como catálogo mínimo y gestión segura

## Status

Accepted

## Date

2026-09-04

## Context

La pantalla `Projects` mezclaba tres responsabilidades: elegir el workspace, resumirlo y mostrar un workbench estático de Tasks y actividad. Esa densidad duplicaba información que ya pertenece a `Work`, `Changes` y `Runtime`, y dificultaba entender qué podía hacer el usuario en esta vista.

También faltaba una operación explícita para dejar de seguir un Project desde ADE. Esa operación debe distinguirse de borrar una carpeta local: retirar el seguimiento no debe poner en riesgo el código del usuario.

## Decision

`Projects` queda limitado a:

- catálogo de Projects seleccionables;
- alta mediante selector nativo;
- retirada de un Project del registro local de ADE;
- título del Project activo;
- resumen de `Active tasks`, `In review`, `Services` y `Last ship`.

`project.remove` elimina únicamente la fila del Project en SQLite. No elimina ni modifica su carpeta, Git, Tasks ni ficheros. Para preservar una raíz operativa válida, ADE no permite retirar el único Project activo; cuando hay otro registrado, lo selecciona automáticamente después de retirar el actual.

## Alternatives considered

### Mantener el workbench dentro de Projects

Rechazado: duplica Work, Changes y Runtime y convierte la pantalla de selección en un dashboard no accionable.

### Borrar también metadata y ficheros del Project

Rechazado: “dejar de seguir” no implica destruir código ni historial operativo; además, una carpeta retirada puede volver a registrarse.

### Permitir cero Projects activos

Rechazado por ahora: el shell y el sidecar requieren una raíz activa para árbol, terminal, editor y servicios. El estado vacío completo queda como una evolución posterior.

## Consequences

- `Projects` tiene una jerarquía visual clara y una única responsabilidad principal: gestionar workspaces.
- Las operaciones de retirada son reversibles a nivel de código: los ficheros permanecen en disco y pueden volver a registrarse.
- La UI necesita confirmación explícita y feedback de éxito/error para `project.remove`.
- El contrato del sidecar expone `project.remove` y su resultado `{ id, removed: true }`.
