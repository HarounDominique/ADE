# ADR-0012: Sesiones reanudables y permisos explícitos por ejecución

## Status

Accepted

## Date

2026-09-03

## Context

ADE debe retomar trabajo agéntico tras cerrar la aplicación sin almacenar credenciales ni confundir una referencia local con una sesión real del proveedor. También debe permitir skills documentales automáticas, pero pedir consentimiento visible antes de conceder capacidades de mayor riesgo.

## Decision

OpenCode conserva su identificador HTTP de sesión y Codex crea la sesión mediante `codex exec --json`, captura el `thread_id` emitido y la reanuda con `codex exec resume <id>`. ADE persiste proveedor, directorio, Task opcional y estado de cada sesión.

Los manifests declaran permisos. `read_project` y `write_docs` se conceden dentro del Project por la intención documental ya expresada; `write_code`, `run_commands` y `network` requieren aceptación por ejecución. La reconciliación documental genera evidencia `documentation.reconciled`, que satisface la gate `documentation-review` cuando se vincula a una Task.

## Alternatives Considered

- IDs sintéticos de sesión: rechazados porque no permiten reanudar un proveedor real.
- Aprobación global por Project: rechazada porque oculta el alcance de comandos, red y escritura de código.
- Mantener la reconciliación fuera de las gates: rechazada porque permitiría cerrar una Task sin evidencia documental trazable.

## Consequences

La UI puede mostrar y reanudar sesiones persistidas, y deja visible el permiso solicitado antes de cada ejecución sensible. Codex conserva sus credenciales en su propio entorno. El enforcement se realiza en ADE; el sandbox nativo de cada proveedor sigue siendo un límite independiente que se endurecerá en una iteración posterior.
