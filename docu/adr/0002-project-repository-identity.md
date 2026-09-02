# ADR-0002 — Project como identidad estable del repositorio

## Status

Accepted for v0.1

## Date

2026-09-02

## Context

ADE necesita agrupar Tasks, documentación, skills, políticas y metadata operativa alrededor de un repositorio local. La primera implementación recibe una ruta de directorio directamente, pero esa ruta no es una identidad suficiente: puede ser relativa, apuntar a un subdirectorio Git o cambiar de nombre sin que cambie el repositorio.

También debemos evitar acoplar el dominio a una estrategia de branches o worktrees que todavía no está decidida.

## Decision

Introducir `Project` como identidad estable y registrar un único `Repository` local por Project en v0.1. El repositorio se identifica por su `gitRoot` canónico, obtenido mediante un puerto de Git sin modificar el árbol de trabajo.

Las Tasks referencian `projectId` y conservan `repositoryPath` como snapshot operativo. El branch es metadata opcional y mutable; no forma parte de la identidad de Task y ADE no crea branches ni worktrees automáticamente en v0.1.

## Alternatives considered

### Task identificada por ruta

- Ventaja: implementación inicial mínima.
- Rechazo: no permite agrupar historial, configuración y varias Tasks de forma estable; además es vulnerable a rutas equivalentes.

### Task identificada por branch

- Ventaja: encaja con un flujo Git tradicional.
- Rechazo: fuerza una política de branches antes de resolver worktrees, cambios pequeños y tareas sin branch dedicado.

### Project con múltiples repositorios desde v0.1

- Ventaja: cubre monorepos distribuidos y dependencias externas.
- Rechazo: añade complejidad de selección de contexto sin evidencia de que sea necesaria para el MVP.

## Consequences

- La primera tarea de implementación puede validar y persistir un Project sin construir todavía la UI.
- Las rutas se normalizan y los duplicados se detectan por raíz Git.
- La futura estrategia de branches/worktrees puede evolucionar sin romper la identidad de Task.
- El modelo queda limitado a un repositorio por Project hasta que una necesidad real justifique ampliar la cardinalidad.
