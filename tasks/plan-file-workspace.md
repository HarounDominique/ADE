# Plan: Internal File Workspace v0.4

<!-- Spec: docu/specs/SPEC-file-workspace.md -->
<!-- ADR: docu/adr/0014-internal-file-viewer.md -->

**Estado:** completado y validado a nivel de build/tests; smoke gráfico pendiente por limitación del entorno.

## Delivery order

1. Backend Tauri: lectura estructurada y segura bajo la raíz canónica, con clasificación de texto/binario/tamaño. ✅
2. Read model de documento activo: ruta relativa, contenido, estado y continuidad con Project/Task. ✅
3. Editor interno: panel con superficie completa, carga, errores, edición, estado dirty, guardado, descarte y acción externa explícita. ✅
4. Integración Explorer: seleccionar abre dentro de ADE; la rama compacta y el foco se mantienen. ✅
5. Tests nativos, UI y de contrato; actualización de Nexus/reconciliación. ✅

## Acceptance gate

La tarea queda cerrada cuando la selección de un fichero de texto no lanza macOS, el contenido se ve y puede editarse dentro de ADE, el guardado queda confinado a la raíz del Project, las rutas externas quedan rechazadas y cualquier apertura externa requiere una acción separada. Este contrato está implementado; el smoke gráfico queda pendiente por `SIGABRT` de arranque en el entorno actual.

## Out of scope

Language server, preview binario avanzado, undo/redo avanzado, colaboración y tabs avanzadas.
