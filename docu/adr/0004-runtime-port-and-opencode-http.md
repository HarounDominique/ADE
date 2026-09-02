# ADR-0004 — Puerto de runtime y adapter HTTP local para OpenCode

## Status

Accepted for MVP

## Date

2026-09-02

## Context

ADE debe poder cambiar de runtime sin contaminar el dominio con APIs de un proveedor. OpenCode es el primer runtime viable y ya ha demostrado health, sesiones, prompts, SSE, diff y cancelación en un repositorio efímero. También necesitamos una frontera explícita entre Implementer y Reviewer.

## Decision

Definir `AgentRuntimePort` como contrato estable de ADE y usar `OpenCodeHttpRuntime` como adapter inicial sobre HTTP local. Las sesiones llevan un `directory` explícito; las operaciones de contexto lo envían al proveedor. La aplicación decide las transiciones y persiste la evidencia, mientras el adapter sólo traduce protocolo y errores.

El Reviewer se ejecuta en una sesión nueva mediante `promptAndWait` con JSON Schema. No se reutiliza el historial del Implementer ni se acepta una respuesta no estructurada como revisión válida.

## Alternatives considered

### SDK de OpenCode como dependencia central

- Ventaja: tipos y llamadas de proveedor potencialmente más cómodos.
- Rechazo: acopla la aplicación al ciclo de releases y a los internals del proveedor.

### Proceso hijo por Task

- Ventaja: aislamiento operativo fuerte.
- Rechazo: añade gestión de procesos, logs y señales antes de validar el contrato de runtime.

### Reviewer dentro de la sesión del Implementer

- Ventaja: menos sesiones y contexto inmediato.
- Rechazo: reduce independencia, facilita el sesgo de confirmación y contradice el principio de verificación independiente.

## Consequences

- Los tests de aplicación pueden usar un fake runtime y no necesitan OpenCode.
- OpenCode puede sustituirse por otro adapter sin reescribir Task, ChangeSet o Review.
- La capa de aplicación deberá definir posteriormente timeout, retries, permisos y persistencia de observaciones.
- La integración local depende de que OpenCode esté sirviendo, pero no requiere cloud ni credenciales gestionadas por ADE en el MVP.
