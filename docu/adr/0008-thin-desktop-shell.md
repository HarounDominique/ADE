# ADR-0008 — Shell desktop fino y centrado en el estado de Task

## Status

Accepted for MVP

## Date

2026-09-02

## Context

La visión de ADE es una workstation, pero construir un IDE completo desviaría el MVP y duplicaría capacidades ya resueltas por editores y terminales existentes. El valor inicial está en coordinar intención, agentes, evidencia, gates y cambios de forma observable.

## Decision

Construir un shell desktop fino, local-first y centrado en Project Hub y Tasks. El shell presenta los contratos de aplicación existentes, no duplica el dominio ni ejecuta operaciones por fuera de ellos. Sus áreas son `PROJECT`, `WORK`, `KNOWLEDGE`, `CHANGES` y `RUNTIME`; incluye un escape hatch a terminal/IDE externo.

La primera plataforma objetivo es macOS. La comparación quedó resuelta por el spike 003 y ADR-0009: Tauri 2 es la elección del shell del MVP.

## Alternatives considered

### Construir un IDE completo

- Ventaja: experiencia integrada de edición.
- Rechazo: multiplica alcance y compite con herramientas maduras sin aportar evidencia sobre el workflow de ADE.

### Empezar por una aplicación web cloud

- Ventaja: distribución sencilla y colaboración potencial.
- Rechazo: contradice local-first, complica permisos sobre repositorios y no es necesaria para validar el MVP.

### Mantener sólo CLI

- Ventaja: coste inicial mínimo.
- Rechazo: no hace observable de forma continua el estado de Tasks, gates, runtime y cambios, que es el núcleo del producto.

## Consequences

- Puede validarse una vertical de usuario completa sin implementar editor ni cloud.
- El shell depende de contratos estables y tests de aplicación, no de un proveedor concreto.
- La UI debe hacer visibles fallos, evidencia y acciones peligrosas en vez de simplificarlas en un estado booleano.
- La decisión de framework se retrasa hasta disponer de criterios y una prueba técnica comparable.
