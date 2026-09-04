# Spec: Workspace Core

<!-- Nexus: SPEC-NEXUS.md | Module id: workspace-core -->

## Objective

Ofrecer un workspace local navegable donde el desarrollador vea el árbol de directorios, abra archivos dentro de ADE y use una terminal nativa del sistema sin perder el Project y la Task activa. El árbol debe mantener visible la ruta del archivo activo y permitir convertir el Explorer en el foco principal cuando el usuario lo necesite.

## Commands

`npm run build`; `npm test`; `npm run desktop:dev`; `npm run desktop:smoke`.

## Project Structure

`desktop/src/` contiene el árbol perezoso y el estado visual; `desktop/src-tauri/` conserva la raíz canónica del Project, aplica la autorización de rutas y aloja el PTY persistente; `src/application/` contiene casos de uso; `tests/` cubre contratos de filesystem, terminal y sidecar.

## Code Style

`project_context` selecciona la raíz canónica. Los comandos posteriores reciben rutas absolutas, las resuelven de nuevo y sólo actúan si siguen bajo esa raíz:

```rust
#[tauri::command]
fn list_directory(workspace: State<WorkspaceRoot>, path: String) -> Result<Vec<DirectoryEntry>, String> { /* validated */ }
```

El árbol obtiene sólo los hijos directos y expande cada directorio bajo demanda. En modo compacto, la UI muestra únicamente la rama de directorios que conduce al archivo activo desde la raíz del Project, como un breadcrumb visual en forma de árbol. El modo expandido oculta la navegación de vistas del lateral y permite explorar el árbol completo; al contraerlo, la navegación reaparece y se restaura la rama compacta. Los symlinks se muestran como información, pero una operación que los resuelva fuera del Project se rechaza.

La selección de un fichero de texto abre por defecto un editor interno en el workbench mediante lectura y escritura Tauri autorizadas. El editor conserva Project, Task, Explorer y terminal, expone nombre, ruta relativa, contenido y estados de carga/error, y permite editar, guardar o descartar cambios. Binarios, ficheros ilegibles o demasiado grandes no se abren fuera automáticamente: muestran un estado explicativo y ofrecen una acción externa explícita. La especificación detallada vive en [file-workspace](SPEC-file-workspace.md).

## Testing Strategy

Tests de rutas fuera del Project, symlinks que escapan, orden estable, apertura de archivos, cwd y un comando interactivo dentro del PTY. La superficie de terminal es un único transcript con prompt integrado: Enter ejecuta, `↑`/`↓` recorren el historial y `Tab` completa rutas de directorio usadas por `cd`; las coincidencias ambiguas se muestran como sugerencias navegables y `Esc` las cierra. El transcript interpreta las secuencias ANSI necesarias para cursor, borrado, color y pantalla alternativa, manteniendo operativas las TUIs interactivas como Claude sin mostrar bytes de control. Tests de contrato del shell para selección de archivo, rama compacta, transición a árbol completo, restauración del modo compacto y render ANSI. Smoke manual y empaquetado en macOS.

## Boundaries

- Always: seleccionar una raíz canónica antes de acceder al workspace, resolver cada ruta, ordenar entradas, mostrar errores y conservar contexto.
- Ask first: ejecutar comandos destructivos o fuera del Project.
- Never: seguir symlinks fuera de raíces autorizadas, ocultar procesos o escribir secretos en metadata.

## Success Criteria

El usuario puede seleccionar un Project, navegar su árbol de forma perezosa, seleccionar un fichero de texto y verlo dentro de ADE, y ejecutar comandos en un PTY integrado persistente con cwd correcto. La terminal no duplica bienvenida, eco ni prompt: el shell posee el transcript y muestra sólo el prompt mínimo; Enter ejecuta, `↑`/`↓` recuperan comandos previos, `Tab` completa rutas de `cd` con sugerencias cuando hay más de una coincidencia y una TUI ANSI conserva su layout interactivo. Mientras un archivo está activo, su rama desde la raíz permanece visible en modo compacto; al expandir el Explorer se oculta la navegación secundaria y se muestra el árbol completo, y al contraerlo se recupera la rama. Ningún comando de workspace puede salir de la raíz seleccionada, ni a través de un symlink.

## Open Questions

- ¿Qué componente de resaltado de sintaxis aporta valor sin convertir ADE en un editor completo? El límite de 2 MiB y la clasificación UTF-8 ya están fijados en [SPEC-file-workspace](SPEC-file-workspace.md).
