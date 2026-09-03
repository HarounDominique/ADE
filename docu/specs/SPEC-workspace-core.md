# Spec: Workspace Core

<!-- Nexus: SPEC-NEXUS.md | Module id: workspace-core -->

## Objective

Ofrecer un workspace local navegable donde el desarrollador vea el árbol de directorios, abra archivos y use una terminal nativa del sistema sin perder el Project y la Task activa.

## Commands

`npm run build`; `npm test`; `npm run desktop:dev`; `npm run desktop:smoke`.

## Project Structure

`desktop/src/` contiene el árbol perezoso y el estado visual; `desktop/src-tauri/` conserva la raíz canónica del Project y aplica la autorización de rutas para filesystem, terminal y apertura externa; `src/application/` contiene casos de uso; `tests/` cubre contratos de filesystem, terminal y sidecar.

## Code Style

`project_context` selecciona la raíz canónica. Los comandos posteriores reciben rutas absolutas, las resuelven de nuevo y sólo actúan si siguen bajo esa raíz:

```rust
#[tauri::command]
fn list_directory(workspace: State<WorkspaceRoot>, path: String) -> Result<Vec<DirectoryEntry>, String> { /* validated */ }
```

El árbol obtiene sólo los hijos directos y expande cada directorio bajo demanda. Los symlinks se muestran como información, pero una operación que los resuelva fuera del Project se rechaza.

## Testing Strategy

Tests de rutas fuera del Project, symlinks que escapan, orden estable, apertura de archivos y cwd de terminal. Smoke manual y empaquetado en macOS.

## Boundaries

- Always: seleccionar una raíz canónica antes de acceder al workspace, resolver cada ruta, ordenar entradas, mostrar errores y conservar contexto.
- Ask first: ejecutar comandos destructivos o fuera del Project.
- Never: seguir symlinks fuera de raíces autorizadas, ocultar procesos o escribir secretos en metadata.

## Success Criteria

El usuario puede seleccionar un Project, navegar su árbol de forma perezosa, abrir un archivo interno y ejecutar comandos en una terminal integrada con cwd correcto. Ningún comando de workspace puede salir de la raíz seleccionada, ni a través de un symlink.

## Open Questions

- ¿Editor completo o visor con apertura en editor externo?
- ¿PTY propio o librería Tauri estable?
