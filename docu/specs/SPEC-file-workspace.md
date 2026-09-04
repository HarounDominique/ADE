# Spec: Internal File Workspace

<!-- Nexus: SPEC-NEXUS.md | Module id: file-workspace -->

**Estado:** propuesta para v0.4 — no implementada todavía.

## Objective

Permitir que seleccionar un fichero del Explorer lo abra dentro de ADE, manteniendo el Project, la Task y el contexto del workspace visibles. La apertura externa deja de ser el comportamiento implícito y queda como escape hatch explícito.

## Product contract

- Al seleccionar un fichero de texto válido dentro de la raíz canónica, ADE lo convierte en el documento activo y muestra su contenido en el workbench.
- El visor interno es de solo lectura en la primera entrega: muestra nombre, ruta relativa al Project, contenido, líneas y estados de carga/error sin introducir todavía edición, guardado ni conflictos.
- El documento activo permanece sincronizado con la selección del Explorer y con la rama compacta que el Explorer muestra como hint.
- La navegación de Project, la Task seleccionada y el dock de terminal no se pierden al abrir o cambiar de fichero.
- El botón `Open externally` es una acción explícita y conserva la validación de la raíz antes de invocar el sistema operativo.
- Los ficheros binarios, ilegibles o que superen el límite seguro de preview muestran un estado no previsualizable y ofrecen abrir externamente; nunca se lanzan fuera automáticamente por una selección.

## Native boundary

El frontend solicita el contenido mediante un comando Tauri dedicado (`read_file` o equivalente). El backend vuelve a resolver y canonizar la ruta bajo el Project seleccionado, rechaza symlinks que escapen y devuelve un resultado estructurado con ruta relativa, tipo, tamaño, contenido o causa del rechazo. La UI no lee el filesystem directamente.

La lectura debe estar limitada por tamaño y tipo para no bloquear el shell con artefactos grandes o binarios. El límite por defecto y la detección de texto se fijarán en la implementación y quedarán cubiertos por tests; no se permite degradar silenciosamente a una apertura externa.

## Interaction states

El visor representa `loading`, `ready`, `empty`, `binary`, `too-large`, `failed` y `stale`. Un fallo conserva el último documento confirmado cuando exista y ofrece reintentar o abrir externamente de forma explícita. El foco vuelve al documento activo después de cerrar un error o cambiar de fichero.

## Out of scope

Edición, escritura, guardado, undo/redo, dirty state, language server, colaboración realtime, tabs avanzadas, preview de formatos binarios y sustitución de un IDE completo.

## Acceptance criteria

1. Seleccionar un fichero de texto del Explorer abre su contenido dentro de ADE y no ejecuta `open` del sistema.
2. El documento activo muestra nombre, ruta relativa y contenido legible, y cambia al seleccionar otro fichero.
3. La lectura se realiza por Tauri con la misma frontera de autorización del workspace; una ruta externa o symlink escapado falla de forma visible.
4. Un binario, fichero ilegible o fichero demasiado grande muestra un estado explicativo y sólo se abre fuera mediante una acción explícita.
5. Project, Task, Explorer y terminal conservan su estado al cambiar de documento.
6. Existen tests nativos, de UI y de contrato para apertura interna, errores, límite seguro y escape hatch externo.

## Verification

```bash
npm run build
npm test
cargo test --manifest-path desktop/src-tauri/Cargo.toml
```

## Open Questions

- ¿Qué límite de bytes y qué detección de encoding ofrecen la mejor respuesta en macOS?
- ¿Qué componente de resaltado de sintaxis aporta valor sin convertir ADE en un editor completo?
