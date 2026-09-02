# ADR-0006 — Supervisión explícita de procesos locales

## Status

Accepted for MVP

## Date

2026-09-02

## Context

ADE debe poder verificar software local y mostrar sus servicios sin convertirse en un IDE ni dejar procesos huérfanos. Arrancar un comando y asumir que está saludable no proporciona evidencia suficiente; además, los servicios pueden fallar, ocupar puertos o requerir una parada ordenada.

## Decision

Modelar servicios mediante un lifecycle explícito (`DECLARED`, `STARTING`, `RUNNING`, `STOPPING`, `STOPPED`, `FAILED`) y encapsular la ejecución tras puertos de procesos y filesystem. Un servicio sólo pasa a `RUNNING` después de que su proceso esté vivo y su healthcheck requerido haya pasado. Cada operación conserva logs, timestamps, código de salida, comando, cwd y evidencia de health.

Los comandos se ejecutan sin shell por defecto y con el entorno del usuario actual. Los secretos se inyectan por referencia, no por valores persistidos. Detener un proceso usa un timeout y una política de escalada explícita; el supervisor no mantiene procesos huérfanos.

## Alternatives considered

### Considerar `spawn` exitoso como servicio saludable

- Ventaja: implementación mínima.
- Rechazo: un proceso puede seguir vivo mientras el servicio no escucha o no responde correctamente.

### Delegar en Docker o un supervisor externo

- Ventaja: lifecycle y aislamiento maduros.
- Rechazo: añade una dependencia operativa y no cubre necesariamente comandos nativos del Project.

### Ejecutar siempre mediante shell

- Ventaja: permite sintaxis cómoda y pipelines.
- Rechazo: amplía superficie de inyección y hace menos portable la ejecución; será una capacidad explícita, no el valor por defecto.

## Consequences

- El workflow y Reviewer reciben evidencia verificable de runtime.
- La UI futura puede mostrar estados y logs sin inventar un booleano de salud.
- La implementación deberá resolver diferencias de señales y grupos de procesos entre sistemas operativos.
- La declaración portable de servicios queda provisional hasta probar varios Projects reales.
