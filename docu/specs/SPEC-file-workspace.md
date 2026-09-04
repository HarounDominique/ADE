# Spec: Internal File Workspace

<!-- Nexus: SPEC-NEXUS.md | Module id: file-workspace -->

**Estado:** implementada — slice v0.4 validada a nivel de build y tests; bundle `.app` generado y arrancado manualmente en macOS; smoke gráfico automatizado pendiente.

## Objective

Permitir que seleccionar un fichero del Explorer lo abra dentro de ADE, manteniendo el Project, la Task y el contexto del workspace visibles. La apertura externa deja de ser el comportamiento implícito y queda como escape hatch explícito.

## Product contract

- Al seleccionar un fichero de texto válido dentro de la raíz canónica, ADE lo convierte en el documento activo y muestra su contenido en el workbench.
- El editor interno muestra nombre, ruta relativa al Project, contenido y estados de carga/error; permite editar texto, identificar cambios sin guardar, guardar con `Save` o `⌘/Ctrl+S` y descartarlos con `Discard`.
- El editor usa CodeMirror 6 con paquetes oficiales MIT como motor principal: números de línea, resaltado sintáctico, plegado, búsqueda, undo/redo, indentación, bracket matching y wrapping legible. La detección de lenguaje se realiza por extensión para JavaScript/TypeScript, C++, Java, PHP, JSON, CSS/SCSS, HTML, Markdown, Python, Rust, SQL, XML y YAML.
- Cuando no existe un paquete CodeMirror oficial incorporado, la misma superficie cambia automáticamente a Monaco Editor MIT y carga sus definiciones básicas para C, C#, Go, Dart, Dockerfiles, Elixir, F#, GraphQL, Kotlin, Lua, Objective-C, Perl, PowerShell, Protocol Buffers, R, Ruby, Scala, Shell y Swift. El usuario conserva los mismos controles de apertura, edición, guardado, descarte, tema y atajos; el motor es una decisión interna por extensión.
- `Format` aplica Prettier, también MIT, de forma explícita para JavaScript/TypeScript, JSON, CSS/SCSS, HTML, Markdown y YAML. Para Python, Rust, SQL, XML y los lenguajes fallback se conserva resaltado e indentación del motor activo hasta incorporar formatters específicos con una estrategia de ejecución y licencia revisadas.
- `Editor` permanece montado como superficie fija y exclusiva de código incluso sin documento activo; no muestra CTA de búsqueda ni paneles auxiliares de Git, agentes o documentación. El layout usa densidad de workbench y reserva el dock de terminal como superficie transversal.
- El documento activo permanece sincronizado con la selección del Explorer y con la rama compacta que el Explorer muestra como hint.
- La navegación de Project, la Task seleccionada y el dock de terminal no se pierden al abrir o cambiar de fichero.
- Al cambiar de Project, el contexto del shell se actualiza primero y el Editor sólo conserva un documento si su ruta sigue dentro de la nueva raíz; en caso contrario invalida el documento activo.
- El botón `Open externally` es una acción explícita y conserva la validación de la raíz antes de invocar el sistema operativo.
- Los ficheros binarios, ilegibles o que superen el límite seguro de preview muestran un estado no previsualizable y ofrecen abrir externamente; nunca se lanzan fuera automáticamente por una selección.
- El guardado sólo afecta a ficheros de texto UTF-8 de hasta 2 MiB y conserva la misma frontera de seguridad que la lectura.

## Native boundary

El frontend solicita el contenido mediante un comando Tauri dedicado (`read_file`) y persiste cambios mediante `write_file`. El backend vuelve a resolver y canonizar la ruta bajo el Project seleccionado, rechaza symlinks que escapen y devuelve un resultado estructurado con ruta relativa, tipo, tamaño, contenido o causa del rechazo. La UI no lee ni escribe el filesystem directamente.

La lectura está limitada por tamaño y tipo para no bloquear el shell con artefactos grandes o binarios. La implementación usa un límite de preview de 2 MiB, clasifica contenido UTF-8 sin bytes nulos como texto y devuelve estados estructurados para el resto; no degrada silenciosamente a una apertura externa.

## Interaction states

El editor representa `loading`, `ready`, `empty`, `binary`, `too-large`, `failed` y `stale`. En `ready` distingue el estado limpio del estado `dirty`; `Save` persiste el contenido y `Discard` recupera la última versión confirmada. Un fallo de lectura o guardado muestra un estado visible y no confirma cambios localmente. Cerrar un documento con cambios pide confirmación; abrir externamente sigue siendo explícito.

## Out of scope

Language server, colaboración realtime, resolución de conflictos, formatters específicos para lenguajes no cubiertos por Prettier, tabs avanzadas, preview de formatos binarios y sustitución de un IDE completo.

## Acceptance criteria

1. ✅ Seleccionar un fichero de texto del Explorer abre su contenido dentro de ADE y no ejecuta `open` del sistema.
2. ✅ El documento activo muestra nombre, ruta relativa y contenido legible, y cambia al seleccionar otro fichero.
3. ✅ La lectura se realiza por Tauri con la misma frontera de autorización del workspace; una ruta externa o symlink escapado falla de forma visible.
4. ✅ Un binario, fichero ilegible o fichero demasiado grande muestra un estado explicativo y sólo se abre fuera mediante una acción explícita.
5. ✅ El texto se puede editar, guardar con `Save` o `⌘/Ctrl+S`, y revertir con `Discard`; el estado dirty permanece visible hasta confirmar o descartar.
6. ✅ `write_file` sólo escribe dentro del Project seleccionado y rechaza contenido binario o superior a 2 MiB.
7. ✅ Project, Task, Explorer y terminal conservan su estado al cambiar de documento.
8. ✅ Existen tests nativos, de UI y de contrato para apertura interna, edición, guardado seguro, errores, límite y escape hatch externo.
9. ✅ El Editor muestra sintaxis y estructura de código de los lenguajes soportados, permite formateado explícito donde existe formatter aprobado y mantiene edición/guardado mediante una interfaz común, independientemente de que el motor activo sea CodeMirror o Monaco.
10. ✅ C, C#, Go, Dart, Dockerfiles, Elixir, F#, GraphQL, Kotlin, Lua, Objective-C, Perl, PowerShell, Protocol Buffers, R, Ruby, Scala, Shell y Swift se abren con resaltado Monaco sin cambiar de vista ni perder estado dirty, guardado o descarte.

## Verification

```bash
npm run build
npm test
cargo test --manifest-path desktop/src-tauri/Cargo.toml
```

## Open Questions

- ¿Qué estrategia local y trazable se adoptará para formatters de Python, Rust, SQL y XML sin convertir ADE en un IDE completo?
- ¿Cuándo aporta suficiente valor una integración LSP, y qué permisos/runtime necesitaría por Project?
- ¿Qué lenguajes adicionales justifican un paquete CodeMirror dedicado frente a una definición básica de Monaco, y qué umbral de tamaño debe activar carga diferida?
