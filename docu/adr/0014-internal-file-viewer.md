# ADR-0014 — Editor interno de ficheros como apertura por defecto

## Status

Accepted and implemented for v0.4

## Date

2026-09-04

## Context

El Explorer actual selecciona un fichero y el comando Tauri `open_file` lo entrega a macOS mediante `open`. Esto rompe el contexto del Project, la Task y la terminal, y hace que una interacción básica se comporte como un escape hatch.

ADE necesita una experiencia de workspace continua, pero la decisión no implica construir todavía un editor completo. La capacidad base es abrir un fichero de texto dentro de la aplicación, editarlo y guardarlo con una frontera nativa de autorización y un camino explícito para abrirlo fuera.

## Decision

Seleccionar un fichero de texto dentro de la raíz canónica abre por defecto un editor interno en ADE. El frontend solicita el contenido mediante un comando Tauri dedicado; el backend canoniza de nuevo la ruta, rechaza escapes y devuelve un resultado estructurado para los estados `loading`, `ready`, `binary`, `too-large` y `failed`. El editor mantiene el contenido original para representar cambios sin guardar, permite `Save`, `Discard` y `⌘/Ctrl+S`, y escribe mediante un comando Tauri separado bajo la misma raíz canónica.

La acción `Open externally` se mantiene separada y requiere una invocación explícita. Los ficheros binarios, ilegibles o demasiado grandes no se lanzan automáticamente fuera: muestran un estado explicativo y ofrecen ese escape hatch. El editor queda acotado a texto UTF-8 de hasta 2 MiB; resaltado de sintaxis, undo/redo avanzado, language server, conflictos y colaboración quedan fuera.

## Alternatives considered

### Seguir abriendo siempre con la aplicación del sistema

- Ventaja: implementación mínima y soporte amplio de formatos.
- Rechazo: rompe el contexto del workspace y no ofrece una experiencia IDE coherente.

### Construir un editor completo

- Ventaja: experiencia más potente a largo plazo.
- Rechazo: amplía innecesariamente el alcance de la siguiente iteración y mezcla lectura con edición, persistencia y conflictos.

### Editor interno acotado

- Ventaja: mantiene el contexto, reduce el cambio de aplicación y permite editar texto común con una frontera segura y verificable.
- Decisión: opción adoptada para v0.4.

## Consequences

- `workspace-core` necesita contratos autorizados de lectura y escritura de fichero, y la shell necesita un editor de documento activo.
- `open_file` deja de ser la reacción implícita a una selección; se conserva como operación externa explícita.
- El límite de 2 MiB, la detección UTF-8 y los estados de edición quedan cubiertos por tests; el resaltado se mantiene como evolución futura.
- El guardado directo es deliberadamente pequeño: no resuelve todavía conflictos externos ni proporciona un editor completo.
