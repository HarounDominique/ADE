# ADR-0014 — Visor interno de ficheros como apertura por defecto

## Status

Accepted for v0.4 implementation

## Date

2026-09-04

## Context

El Explorer actual selecciona un fichero y el comando Tauri `open_file` lo entrega a macOS mediante `open`. Esto rompe el contexto del Project, la Task y la terminal, y hace que una interacción básica se comporte como un escape hatch.

ADE necesita una experiencia de workspace continua, pero la decisión no implica construir todavía un editor completo. La primera capacidad necesaria es leer un fichero de texto dentro de la aplicación, con una frontera nativa de autorización y un camino explícito para abrirlo fuera.

## Decision

Seleccionar un fichero de texto dentro de la raíz canónica abre por defecto un visor interno de solo lectura en ADE. El frontend solicita el contenido mediante un comando Tauri dedicado; el backend canoniza de nuevo la ruta, rechaza escapes y devuelve un resultado estructurado para los estados `loading`, `ready`, `binary`, `too-large` y `failed`.

La acción `Open externally` se mantiene separada y requiere una invocación explícita. Los ficheros binarios, ilegibles o demasiado grandes no se lanzan automáticamente fuera: muestran un estado explicativo y ofrecen ese escape hatch. Edición, guardado, dirty state y language server quedan fuera de esta decisión.

## Alternatives considered

### Seguir abriendo siempre con la aplicación del sistema

- Ventaja: implementación mínima y soporte amplio de formatos.
- Rechazo: rompe el contexto del workspace y no ofrece una experiencia IDE coherente.

### Construir un editor completo

- Ventaja: experiencia más potente a largo plazo.
- Rechazo: amplía innecesariamente el alcance de la siguiente iteración y mezcla lectura con edición, persistencia y conflictos.

### Visor interno de solo lectura

- Ventaja: mantiene el contexto, reduce el cambio de aplicación y permite una frontera segura y verificable.
- Decisión: opción adoptada para v0.4.

## Consequences

- `workspace-core` necesita un contrato de lectura de fichero autorizado y la shell necesita un panel de documento activo.
- `open_file` deja de ser la reacción implícita a una selección; se conserva como operación externa explícita.
- El límite de tamaño, la detección de texto/encoding y el resaltado se concretarán en la implementación y deberán quedar cubiertos por tests.
- La documentación debe distinguir siempre entre visor interno actual de la siguiente iteración y editor completo fuera de alcance.
