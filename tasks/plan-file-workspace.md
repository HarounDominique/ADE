# Plan: Internal File Workspace v0.4

<!-- Spec: docu/specs/SPEC-file-workspace.md -->
<!-- ADR: docu/adr/0014-internal-file-viewer.md -->

**Estado:** planificado; pendiente de implementación.

## Delivery order

1. Backend Tauri: lectura estructurada y segura bajo la raíz canónica, con clasificación de texto/binario/tamaño.
2. Read model de documento activo: ruta relativa, contenido, estado y continuidad con Project/Task.
3. Visor interno: panel de solo lectura, líneas, carga, errores y acción externa explícita.
4. Integración Explorer: seleccionar abre dentro de ADE; la rama compacta y el foco se mantienen.
5. Tests nativos, UI y de contrato; smoke macOS y actualización de Nexus/reconciliación.

## Acceptance gate

La tarea sólo se cierra cuando la selección de un fichero de texto no lanza macOS, el contenido se ve dentro de ADE, las rutas externas quedan rechazadas y cualquier apertura externa requiere una acción separada.

## Out of scope

Edición, guardado, dirty state, language server, preview binario avanzado y tabs avanzadas.
