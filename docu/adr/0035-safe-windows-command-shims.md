# ADR-0035 — Shims Windows con argumentos estructurados

## Status

Accepted

## Date

2026-09-08

## Context

`.ade/run.json` pertenece al repositorio abierto y no es una fuente confiable. En
Windows, pasar comandos sin extensión a `spawn` o `execFile` con `shell: true`
dejaba que `cmd.exe` interpretase metacaracteres de los argumentos. Evitar la
shell por completo corrige esa inyección, pero rompe los shims `.cmd` habituales
como `npm`.

## Decision

Usar `cross-spawn` para todos los lanzamientos configurables o de CLI. Mantiene
el vector de argumentos y, cuando Windows requiere un shim, escapa el comando y
cada argumento antes de invocar `cmd.exe`. Los adaptadores que necesitan salida
bufferizada usan `startSafeCommand`, que además aplica el límite de salida y
conserva cancelación mediante el proceso hijo.

Las etiquetas de configuraciones se escapan antes de insertarse como HTML.

## Alternatives considered

### `shell: false` siempre

Rechazado: elimina la inyección pero deja de poder ejecutar `.cmd` y `.bat`.

### Construir a mano una línea para `cmd.exe`

Rechazado: el escape de comillas, carets, expansión de variables y shims anidados
es propenso a errores y ya está resuelto y probado por `cross-spawn`.

## Consequences

- Los argumentos del repositorio no se entregan como texto interpretable a la shell.
- Los comandos de desarrollador habituales siguen funcionando en Windows.
- La dependencia y las pruebas de regresión forman parte del límite de seguridad.
