# Plan: Agent Terminal History

<!-- Spec: docu/specs/SPEC-agent-terminal-history.md | Module id: agent-terminal-history -->

## Objective

Implementar el historial por Project de terminales integradas que ejecutaron un
agente reconocido, con transcript de solo lectura, título económico del mismo
provider y un popup accesible en el dock.

## Implementation order

1. **Dominio y SQLite.** Crear `TerminalSession` y una tabla migrable con
   `project_id`, provider, fechas, título, transcript, truncamiento y estado de
   título; exponer guardar/listar/obtener/borrar filtrado por Project.
2. **Detección y resumen.** Añadir un parser puro para el ejecutable de la orden
   de terminal y una aplicación que identifica Claude/Codex/OpenCode, recorta y
   redacta el extracto, solicita el modelo económico mediante su adapter y deja
   fallback cuando falle.
3. **Protocolo del sidecar.** Incorporar `terminal.history.list`,
   `terminal.history.get`, `terminal.history.save` y `terminal.history.delete`,
   rechazando parámetros incompletos y acceso cruzado.
4. **Captura en la shell.** Marcar un PTY como elegible en la primera orden
   reconocida, capturar transcript a partir de ahí, persistir al cerrarlo y en
   la parada global; el resto de terminales mantiene su comportamiento actual.
5. **Popup e interacción.** Añadir disparador, popup anclado, filas con fecha,
   título y provider, reabrir transcript en tab sin entrada, y borrado con el
   diálogo de confirmación existente.
6. **Documentación y regresión.** Añadir ADR, actualizar el estado de spec y
   nexus, y ejecutar test/build/Rust UI-contract según la superficie tocada.

## Key design choices

- El transcript se captura sólo después de detectar el ejecutable, para no
  convertir una terminal manual previa en una sesión de agente por accidente.
- La persistencia ocurre antes de pedir el título. La falla de modelo nunca
  pierde el historial ni retrasa el cierre de la tab.
- La reapertura es una tab distinta de tipo `history`, sin `onData`, PTY ni
  operación `terminal_stop`.
- El sidecar es la única ruta a SQLite; la shell nunca recibe sesiones de otro
  Project ni decide permisos de resumen.

## Risks and mitigations

- **Parser de shell incompleto:** se limita a órdenes simples en posición de
  ejecutable; wrappers, aliases y pipelines no se atribuyen hasta tener un
  contrato explícito. Falso negativo es preferible a grabar una terminal manual.
- **Transcript sensible o grande:** límite fijo, truncamiento visible y resumen
  local con el mismo provider; ninguna llamada cross-provider.
- **Cierre de aplicación:** la persistencia se dispara antes del stop global y
  debe tolerar que el resumen quede pendiente/falle.
- **HTML no fiable:** los títulos y texto de historial se escapan igual que las
  etiquetas de run-config.

## Verification checkpoints

1. Tras SQLite: pruebas de migración y aislamiento de Project.
2. Tras detección/resumen: tests unitarios de provider, límite y fallback.
3. Tras sidecar: tests de protocolo para éxito, parámetros y acceso cruzado.
4. Tras shell: contract tests del popup, navegación, borrado y tab readonly.
5. Antes de entregar: `npm test`, `npm run build`, `node --check
   desktop/src/main.js`, `cargo test --manifest-path desktop/src-tauri/Cargo.toml`
   y `git diff --check`.

## Out of scope

Terminales manuales, aliases/wrappers/pipelines, reanudar procesos históricos,
buscar transcripts, exportación, sincronización cloud y una vista lateral o
permanente del historial.
