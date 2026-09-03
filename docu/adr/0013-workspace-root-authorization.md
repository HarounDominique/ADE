# ADR-0013: Raíz autorizada para el workspace local

## Status

Accepted

## Date

2026-09-03

## Context

El shell desktop recibe rutas desde la UI para navegar archivos, abrir documentos y ejecutar terminal. Validar solamente que una ruta exista permitiría que una selección o un symlink alcanzase archivos ajenos al Project activo.

## Decision

`project_context` canoniza y registra la raíz del Project en el proceso Tauri. Cada comando de filesystem, terminal o apertura externa vuelve a canonizar su ruta y exige que permanezca bajo esa raíz. El árbol lista symlinks sin recorrerlos y las operaciones sobre uno que resuelva fuera del Project fallan.

La UI solicita sólo hijos directos y expande directorios bajo demanda. Esto limita el trabajo inicial y evita presentar como navegable una ruta que el proceso nativo no autorizaría.

## Alternatives Considered

- Confiar en que la UI envíe rutas bajo el Project: rechazada; el bridge Tauri es una frontera de seguridad.
- Autorizar cualquier ruta de la máquina: rechazada; el contexto de v0.3 es un Project activo.
- Resolver symlinks durante el listado: rechazado; mostrar el enlace es útil, seguirlo cambia el alcance autorizado.

## Consequences

Una nueva selección de Project establece explícitamente el alcance local. Las acciones fuera del Project requieren un futuro flujo de selección/autorización, no un bypass implícito. El terminal actual mantiene una sesión de shell persistente; el soporte de un emulador PTY completo sigue como decisión técnica separada.
