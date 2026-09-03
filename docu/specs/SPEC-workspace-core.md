# Spec: Workspace Core

<!-- Nexus: SPEC-NEXUS.md | Module id: workspace-core -->

## Objective

Ofrecer un workspace local navegable donde el desarrollador vea el árbol de directorios, abra archivos y use una terminal nativa del sistema sin perder el Project y la Task activa.

## Commands

`npm run build`; `npm test`; `npm run desktop:dev`; `npm run desktop:smoke`.

## Project Structure

`desktop/src/` contiene vistas y estado; `desktop/src-tauri/` comandos nativos, PTY y validación de rutas; `src/application/` casos de uso; `tests/` contratos de filesystem, terminal y sidecar.

## Code Style

Los comandos nativos reciben rutas absolutas validadas y devuelven resultados estructurados:

```rust
#[tauri::command]
fn list_directory(path: String) -> Result<Vec<DirectoryEntry>, String> { /* validated */ }
```

## Testing Strategy

Tests de rutas fuera del Project, symlinks, permisos, orden estable, apertura de archivos y lifecycle de terminal/PTY. Smoke manual y empaquetado en macOS.

## Boundaries

- Always: validar rutas, ordenar entradas, mostrar errores y conservar contexto.
- Ask first: ejecutar comandos destructivos o fuera del Project.
- Never: seguir symlinks fuera de raíces autorizadas, ocultar procesos o escribir secretos en metadata.

## Success Criteria

El usuario puede seleccionar un Project, navegar su árbol, abrir un archivo y ejecutar comandos en una terminal integrada con cwd correcto.

## Open Questions

- ¿Editor completo o visor con apertura en editor externo?
- ¿PTY propio o librería Tauri estable?
